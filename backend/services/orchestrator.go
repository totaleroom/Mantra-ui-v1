package services

import (
	"errors"
	"fmt"
	"log"
	"mantra-backend/database"
	"mantra-backend/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Orchestrator coordinates the happy path of "inbound WhatsApp message ->
// persisted -> AI reply -> outbound WhatsApp message -> persisted".
//
// It deliberately does NOT know about HTTP, Fiber, websockets, or Evolution
// payload shapes. Those are the webhook handler's job. This keeps the
// orchestrator unit-testable and provider-agnostic.
type Orchestrator struct {
	ai        *AIFallbackService
	memory    *MemoryService
	evolution *EvolutionService

	// onMessagePersisted is called whenever the orchestrator saves a new
	// inbox message (inbound OR outbound). The webhook handler sets this
	// to the InboxHub broadcast function so the dashboard updates live.
	onMessagePersisted func(msg *models.InboxMessage)
}

// NewOrchestrator wires the default services together.
func NewOrchestrator() *Orchestrator {
	return &Orchestrator{
		ai:        NewAIFallbackService(),
		memory:    NewMemoryService(),
		evolution: NewEvolutionService(),
	}
}

// OnMessagePersisted lets callers (main.go / webhook handler) hook in the
// realtime broadcast without creating an import cycle with the ws package.
func (o *Orchestrator) OnMessagePersisted(fn func(msg *models.InboxMessage)) {
	o.onMessagePersisted = fn
}

// InboundMessage is the provider-neutral shape the webhook handler passes in.
type InboundMessage struct {
	InstanceName   string
	CustomerNumber string // E.164 bare digits, e.g. "6281234567890"
	Text           string
	ProviderMsgID  string // optional, for idempotency
	Timestamp      time.Time
}

// HandleInbound is the single entry point for every new customer message.
// It is safe to call from a goroutine — every DB/Evo failure is logged and
// returned, never panicked.
//
// Flow:
//  1. Resolve instance -> client
//  2. Skip if client inactive / over token limit
//  3. Idempotency guard (skip duplicate provider message IDs)
//  4. Persist inbound message
//  5. Load client AI config + conversation memory
//  6. Call AI with system prompt + history + current message
//  7. Send reply via Evolution
//  8. Persist outbound message
//  9. Update conversation memory
//
// Returns (reply, error). Caller usually ignores the reply — it's already sent.
func (o *Orchestrator) HandleInbound(in InboundMessage) (string, error) {
	if database.DB == nil {
		return "", errors.New("database not connected")
	}

	// 1. Resolve instance -> client
	var instance models.WhatsAppInstance
	if err := database.DB.
		Where("instance_name = ?", in.InstanceName).
		First(&instance).Error; err != nil {
		return "", fmt.Errorf("instance %q not found: %w", in.InstanceName, err)
	}

	var client models.Client
	if err := database.DB.First(&client, instance.ClientID).Error; err != nil {
		return "", fmt.Errorf("client %d not found: %w", instance.ClientID, err)
	}

	// 2. Gate: inactive client
	if !client.IsActive {
		log.Printf("[Orchestrator] skipping inbound for inactive client %d", client.ID)
		return "", nil
	}

	// 2b. Gate: token budget exhausted
	if client.TokenLimit > 0 && client.TokenBalance >= client.TokenLimit {
		log.Printf("[Orchestrator] client %d over token limit (%d/%d), skipping AI reply",
			client.ID, client.TokenBalance, client.TokenLimit)
		// Still persist inbound so operator can see it
		o.persistInbound(in, client.ID)
		return "", nil
	}

	// 3. Idempotency — Evolution may retry webhooks
	if in.ProviderMsgID != "" {
		var existing int64
		database.DB.Model(&models.InboxMessage{}).
			Where("id = ?", in.ProviderMsgID).
			Count(&existing)
		if existing > 0 {
			log.Printf("[Orchestrator] duplicate message %s, skipping", in.ProviderMsgID)
			return "", nil
		}
	}

	// 4. Persist inbound
	inboundSaved := o.persistInbound(in, client.ID)

	// 5. Load client AI config
	var aiCfg models.ClientAIConfig
	if err := database.DB.
		Where("client_id = ?", client.ID).
		First(&aiCfg).Error; err != nil {
		log.Printf("[Orchestrator] no AI config for client %d, not replying", client.ID)
		return "", nil // inbound saved, but no auto-reply configured
	}

	// 6. Build conversation
	messages := o.buildConversation(client.ID, in.CustomerNumber, aiCfg, in.Text)

	chatResp, providerName, err := o.ai.Chat(
		&client.ID,
		aiCfg.ModelID,
		messages,
		aiCfg.Temperature,
	)
	if err != nil {
		log.Printf("[Orchestrator] AI call failed for client %d: %v", client.ID, err)
		return "", fmt.Errorf("AI call failed: %w", err)
	}
	if chatResp == nil || len(chatResp.Choices) == 0 {
		return "", errors.New("AI returned no choices")
	}
	reply := chatResp.Choices[0].Message.Content
	if reply == "" {
		return "", errors.New("AI returned empty reply")
	}

	// 7. Send via Evolution
	if err := o.evolution.SendText(in.InstanceName, in.CustomerNumber, reply); err != nil {
		log.Printf("[Orchestrator] send text failed: %v", err)
		return reply, fmt.Errorf("send failed: %w", err)
	}

	// 8. Persist outbound
	outbound := &models.InboxMessage{
		ID:             uuid.NewString(),
		ClientID:       client.ID,
		CustomerNumber: in.CustomerNumber,
		Message:        reply,
		Direction:      models.MessageDirectionOutbound,
		Timestamp:      time.Now(),
		ModelUsed:      &providerName,
	}
	if err := database.DB.Create(outbound).Error; err != nil {
		log.Printf("[Orchestrator] failed to persist outbound: %v", err)
	} else if o.onMessagePersisted != nil {
		o.onMessagePersisted(outbound)
	}

	// 9. Update memory (append turn, increment approximate token count)
	o.updateMemory(client.ID, in.CustomerNumber, aiCfg, in.Text, reply)

	// Approximate token accounting: 4 chars ~ 1 token. Conservative upper bound.
	approxTokens := (len(in.Text) + len(reply)) / 3
	database.DB.Model(&models.Client{}).
		Where("id = ?", client.ID).
		UpdateColumn("token_balance", gorm.Expr("token_balance + ?", approxTokens))

	_ = inboundSaved // keep reference for clarity; nothing else uses it
	return reply, nil
}

// persistInbound saves an inbound message and fires the broadcast hook.
// Never panics; logs DB errors and returns the saved row (or nil on failure).
func (o *Orchestrator) persistInbound(in InboundMessage, clientID uint) *models.InboxMessage {
	id := in.ProviderMsgID
	if id == "" {
		id = uuid.NewString()
	}
	msg := &models.InboxMessage{
		ID:             id,
		ClientID:       clientID,
		CustomerNumber: in.CustomerNumber,
		Message:        in.Text,
		Direction:      models.MessageDirectionInbound,
		Timestamp:      in.Timestamp,
	}
	if msg.Timestamp.IsZero() {
		msg.Timestamp = time.Now()
	}
	if err := database.DB.Create(msg).Error; err != nil {
		log.Printf("[Orchestrator] failed to persist inbound: %v", err)
		return nil
	}
	if o.onMessagePersisted != nil {
		o.onMessagePersisted(msg)
	}
	return msg
}

// buildConversation assembles the [system, ...history, user] slice the AI expects.
// History is sourced from CustomerMemory.RawHistory (last N turns).
func (o *Orchestrator) buildConversation(
	clientID uint,
	customerNumber string,
	cfg models.ClientAIConfig,
	currentText string,
) []ChatMessage {
	msgs := []ChatMessage{{Role: "system", Content: cfg.SystemPrompt}}

	mem, _ := o.memory.GetMemory(clientID, customerNumber)
	if mem != nil && len(mem.RawHistory) > 0 {
		// Cap at last 10 turns to keep prompt cost bounded
		start := 0
		if len(mem.RawHistory) > 10 {
			start = len(mem.RawHistory) - 10
		}
		for _, turn := range mem.RawHistory[start:] {
			role, _ := turn["role"].(string)
			content, _ := turn["content"].(string)
			if role == "" || content == "" {
				continue
			}
			msgs = append(msgs, ChatMessage{Role: role, Content: content})
		}
	}

	msgs = append(msgs, ChatMessage{Role: "user", Content: currentText})
	return msgs
}

// updateMemory appends the new turn and persists with the client's TTL.
func (o *Orchestrator) updateMemory(
	clientID uint,
	customerNumber string,
	cfg models.ClientAIConfig,
	userText, assistantText string,
) {
	existing, _ := o.memory.GetMemory(clientID, customerNumber)

	history := []map[string]interface{}{}
	if existing != nil && existing.RawHistory != nil {
		history = existing.RawHistory
	}
	history = append(history,
		map[string]interface{}{"role": "user", "content": userText},
		map[string]interface{}{"role": "assistant", "content": assistantText},
	)
	// Cap history length
	if len(history) > 40 {
		history = history[len(history)-40:]
	}

	summary := ""
	if existing != nil && existing.Summary != nil {
		summary = *existing.Summary
	}

	ttl := cfg.MemoryTTLDays
	if ttl <= 0 {
		ttl = 4
	}

	if _, err := o.memory.UpsertMemory(clientID, customerNumber, summary, history, ttl); err != nil {
		log.Printf("[Orchestrator] failed to update memory: %v", err)
	}
}

// SendManual is used by the dashboard "Reply" button. It sends text via
// Evolution and persists the outbound message. No AI involved.
func (o *Orchestrator) SendManual(instanceID uint, to, text string) (*models.InboxMessage, error) {
	if database.DB == nil {
		return nil, errors.New("database not connected")
	}
	if to == "" || text == "" {
		return nil, errors.New("to and text are required")
	}

	var instance models.WhatsAppInstance
	if err := database.DB.First(&instance, instanceID).Error; err != nil {
		return nil, fmt.Errorf("instance not found: %w", err)
	}

	if err := o.evolution.SendText(instance.InstanceName, to, text); err != nil {
		return nil, err
	}

	msg := &models.InboxMessage{
		ID:             uuid.NewString(),
		ClientID:       instance.ClientID,
		CustomerNumber: to,
		Message:        text,
		Direction:      models.MessageDirectionOutbound,
		Timestamp:      time.Now(),
	}
	if err := database.DB.Create(msg).Error; err != nil {
		return nil, fmt.Errorf("failed to persist manual outbound: %w", err)
	}
	if o.onMessagePersisted != nil {
		o.onMessagePersisted(msg)
	}
	return msg, nil
}
