package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"log"
	"mantra-backend/config"
	"mantra-backend/services"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Orchestrator is initialized in main.go and wired to the InboxHub broadcaster
// there, so the webhook handler just calls it.
var Orchestrator = services.NewOrchestrator()

// EvolutionWebhookEnvelope is the outer shape Evolution POSTs for every event.
// We only care about MESSAGES_UPSERT; other events are ack'd and ignored.
type EvolutionWebhookEnvelope struct {
	Event    string `json:"event"`
	Instance string `json:"instance"`
	Data     struct {
		Key struct {
			RemoteJid string `json:"remoteJid"`
			FromMe   bool   `json:"fromMe"`
			ID       string `json:"id"`
		} `json:"key"`
		PushName string `json:"pushName"`
		Message  struct {
			Conversation         string `json:"conversation"`
			ExtendedTextMessage  *struct {
				Text string `json:"text"`
			} `json:"extendedTextMessage"`
		} `json:"message"`
		MessageType      string `json:"messageType"`
		MessageTimestamp int64  `json:"messageTimestamp"`
	} `json:"data"`
}

// EvolutionWebhook receives every event Evolution API forwards to us.
//
// Auth model: Evolution sends our shared WEBHOOK_SECRET in the
// `X-Webhook-Secret` header. We compare in constant time to avoid
// timing oracles. Requests without a valid secret are rejected with 401
// (not 403 — we want to make it clear the caller is unauthenticated, not
// forbidden from a specific resource).
//
// This endpoint MUST NOT be mounted behind JWTProtected middleware.
func EvolutionWebhook(c *fiber.Ctx) error {
	// 1. Auth
	if config.C == nil || config.C.WebhookSecret == "" {
		// Fail closed if the secret isn't configured — otherwise a missing
		// env var would silently open the endpoint to anyone on the internet.
		log.Println("[Webhook] WEBHOOK_SECRET not configured, rejecting")
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "webhook receiver not configured",
		})
	}

	// Layer 1: shared-secret header. Constant-time to avoid timing oracle.
	got := c.Get("X-Webhook-Secret")
	if subtle.ConstantTimeCompare([]byte(got), []byte(config.C.WebhookSecret)) != 1 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid webhook secret",
		})
	}

	// Layer 2 (optional-but-recommended): HMAC signature + timestamp.
	//
	// Evolution API may not emit these headers out of the box, so we
	// only enforce them when X-Webhook-Timestamp is present. Once your
	// Evolution fork signs every delivery, you can flip this to "always
	// required" by deleting the tsHeader guard.
	//
	// Replay window: ±5 minutes. Captured requests older than that are
	// rejected even with a valid signature.
	if tsHeader := c.Get("X-Webhook-Timestamp"); tsHeader != "" {
		tsUnix, parseErr := strconv.ParseInt(tsHeader, 10, 64)
		if parseErr != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid X-Webhook-Timestamp",
			})
		}
		skew := time.Since(time.Unix(tsUnix, 0))
		if skew < -5*time.Minute || skew > 5*time.Minute {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "timestamp outside replay window",
			})
		}

		sigHeader := c.Get("X-Webhook-Signature")
		if sigHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing X-Webhook-Signature",
			})
		}
		mac := hmac.New(sha256.New, []byte(config.C.WebhookSecret))
		mac.Write([]byte(tsHeader))
		mac.Write([]byte{'.'})
		mac.Write(c.Body())
		expected := hex.EncodeToString(mac.Sum(nil))
		if subtle.ConstantTimeCompare([]byte(sigHeader), []byte(expected)) != 1 {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "signature mismatch",
			})
		}
	}

	// 2. Parse
	var env EvolutionWebhookEnvelope
	if err := c.BodyParser(&env); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid body",
		})
	}

	// 3. We only care about inbound text messages. Everything else is ack'd.
	if env.Event != "messages.upsert" && env.Event != "MESSAGES_UPSERT" {
		return c.JSON(fiber.Map{"ok": true, "skipped": "event_not_handled"})
	}
	if env.Data.Key.FromMe {
		// Ignore echoes of our own outbound messages
		return c.JSON(fiber.Map{"ok": true, "skipped": "from_me"})
	}

	text := strings.TrimSpace(env.Data.Message.Conversation)
	if text == "" && env.Data.Message.ExtendedTextMessage != nil {
		text = strings.TrimSpace(env.Data.Message.ExtendedTextMessage.Text)
	}
	if text == "" {
		// Media / reaction / status — nothing to reply to yet
		return c.JSON(fiber.Map{"ok": true, "skipped": "non_text"})
	}

	customerNumber := jidToE164(env.Data.Key.RemoteJid)
	if customerNumber == "" {
		return c.JSON(fiber.Map{"ok": true, "skipped": "bad_jid"})
	}

	ts := time.Unix(env.Data.MessageTimestamp, 0)
	if ts.IsZero() || ts.Year() < 2020 {
		ts = time.Now()
	}

	// 4. Hand off async — return 200 to Evolution quickly so it doesn't retry.
	inbound := services.InboundMessage{
		InstanceName:   env.Instance,
		CustomerNumber: customerNumber,
		Text:           text,
		ProviderMsgID:  env.Data.Key.ID,
		Timestamp:      ts,
	}
	go func() {
		// A panicked goroutine would crash the entire process. Wrapping
		// here turns the failure into a log line so one bad inbound
		// message can't take the whole backend down.
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[Webhook] PANIC in orchestrator goroutine: %v", r)
			}
		}()
		if _, err := Orchestrator.HandleInbound(inbound); err != nil {
			log.Printf("[Webhook] orchestrator error: %v", err)
		}
	}()

	return c.JSON(fiber.Map{"ok": true, "accepted": true})
}

// jidToE164 normalizes WhatsApp JIDs like "6281234567890@s.whatsapp.net"
// or "6281234567890@c.us" down to just the phone number "6281234567890".
// Group JIDs (ending in @g.us) and status broadcasts are rejected.
func jidToE164(jid string) string {
	if jid == "" {
		return ""
	}
	at := strings.IndexByte(jid, '@')
	if at < 0 {
		return jid // already bare
	}
	suffix := jid[at+1:]
	// Reject groups and status broadcasts — we only handle 1:1 chats
	if suffix == "g.us" || suffix == "broadcast" || suffix == "status@broadcast" {
		return ""
	}
	return jid[:at]
}
