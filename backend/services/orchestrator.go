package services

import (
	"context"
	"encoding/json"
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
	retrieval *RetrievalService
	evolution *EvolutionService
	tools     *ToolService

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
		retrieval: NewRetrievalService(),
		evolution: NewEvolutionService(),
		tools:     NewToolService(),
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

	// 6. Build conversation (with per-tenant RAG retrieval)
	messages, retrieved := o.buildConversation(client.ID, in.CustomerNumber, aiCfg, in.Text)

	// 6b. Run the AI reply loop with tool calling (Phase 4). This may make
	// multiple round-trips to the model; each tool invocation is captured
	// in `toolTrace` for audit logging.
	reply, providerName, toolTrace, err := o.runReplyLoop(client.ID, in.CustomerNumber, aiCfg, messages)
	if err != nil {
		log.Printf("[Orchestrator] AI call failed for client %d: %v", client.ID, err)
		return "", err
	}
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
	// Attach retrieval + tool-call audit to the message so the operator
	// can inspect the AI's reasoning in the dashboard.
	audit := map[string]interface{}{}
	if retrieved.Blob != "" || len(retrieved.FAQIDs) > 0 || len(retrieved.ChunkIDs) > 0 {
		audit["retrievedFaqs"] = retrieved.FAQIDs
		audit["retrievedChunks"] = retrieved.ChunkIDs
		audit["embedProvider"] = retrieved.Provider
	}
	if len(toolTrace) > 0 {
		audit["toolCalls"] = toolTrace
	}
	if len(audit) > 0 {
		if blob, err := json.Marshal(audit); err == nil {
			s := string(blob)
			outbound.AIThoughtProcess = &s
		}
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

// toolTraceEntry records one completed tool invocation for audit logging.
// Persisted into InboxMessage.AIThoughtProcess so the dashboard can show
// "AI called tool X with args Y and got back Z".
type toolTraceEntry struct {
	Name      string `json:"name"`
	CallID    string `json:"callId"`
	Arguments string `json:"args"`
	Result    string `json:"result"`
	DurationMs int64 `json:"durationMs"`
}

// runReplyLoop drives the AI ↔ tools conversation up to MaxToolIterations.
// It returns the final assistant reply, the provider that produced it, and
// an audit trace of each tool call. On the first turn it loads the
// tenant's active tools; subsequent iterations feed `role: "tool"` results
// back to the model until the model returns a content-only message or we
// hit the iteration cap.
func (o *Orchestrator) runReplyLoop(
	clientID uint,
	customerNumber string,
	cfg models.ClientAIConfig,
	initialMessages []ChatMessage,
) (reply string, providerName string, trace []toolTraceEntry, err error) {
	// 1. Resolve tools for this tenant (empty list disables function calling)
	defs, byName, _ := o.tools.LoadToolsForClient(clientID)

	// Working message slice. We append assistant + tool turns as we loop.
	messages := make([]ChatMessage, len(initialMessages))
	copy(messages, initialMessages)

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	for iter := 0; iter < MaxToolIterations+1; iter++ {
		// On the last allowed iteration, force the model to stop using tools
		// so we always end with a human-readable reply.
		activeDefs := defs
		if iter == MaxToolIterations {
			activeDefs = nil
		}

		resp, pName, callErr := o.ai.ChatWithTools(&clientID, cfg.ModelID, messages, cfg.Temperature, activeDefs)
		if callErr != nil {
			return "", "", trace, callErr
		}
		if resp == nil || len(resp.Choices) == 0 {
			return "", "", trace, errors.New("AI returned no choices")
		}
		providerName = pName

		choice := resp.Choices[0]
		msg := choice.Message

		// Happy path: no tool calls → we're done, return the content.
		if len(msg.ToolCalls) == 0 {
			return msg.Content, providerName, trace, nil
		}

		// The model wants to call one or more tools. Append the assistant
		// turn (content may be empty, that's fine) then execute each call.
		messages = append(messages, msg)

		for _, call := range msg.ToolCalls {
			t, ok := byName[call.Function.Name]
			var result string
			if !ok {
				result = fmt.Sprintf(`{"error":"tool %q not registered for this tenant"}`, call.Function.Name)
			} else {
				start := time.Now()
				callCtx, callCancel := context.WithTimeout(ctx, 35*time.Second)
				result = o.tools.Execute(callCtx, t, clientID, customerNumber, call.Function.Arguments)
				callCancel()
				trace = append(trace, toolTraceEntry{
					Name:       call.Function.Name,
					CallID:     call.ID,
					Arguments:  call.Function.Arguments,
					Result:     truncateForAudit(result),
					DurationMs: time.Since(start).Milliseconds(),
				})
			}

			// Feed the result back to the model. Response body is verbatim —
			// Execute() already guarantees it's valid JSON (or wrapped so).
			messages = append(messages, ChatMessage{
				Role:       "tool",
				ToolCallID: call.ID,
				Name:       call.Function.Name,
				Content:    result,
			})
		}
	}

	// Exhausted the iteration budget without a final reply.
	return "", providerName, trace, fmt.Errorf("AI exceeded %d tool iterations without a final reply", MaxToolIterations)
}

// truncateForAudit keeps the ai_thought_process column from ballooning if
// a tool returns a large blob. The LLM still saw the full value — we just
// don't persist more than ~1 KiB per call.
func truncateForAudit(s string) string {
	const maxLen = 1024
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "…"
}

// buildConversation assembles the [system, ...history, user] slice the AI expects.
// History is sourced from CustomerMemory.RawHistory (last N turns).
//
// It also runs RAG retrieval against the tenant's knowledge base: matching
// FAQs (by trigger_keywords/tags) and top-K vector-similar chunks. When
// anything relevant is found, the KB block is appended to the system
// prompt. The retrieval audit (IDs used, embedding provider) is returned
// separately so the caller can log it into the outbound message.
func (o *Orchestrator) buildConversation(
	clientID uint,
	customerNumber string,
	cfg models.ClientAIConfig,
	currentText string,
) ([]ChatMessage, RetrievedContext) {
	// 1. Start from the configured system prompt
	systemPrompt := cfg.SystemPrompt

	// 2. Retrieve relevant KB context (FAQs + vector chunks). Best-effort:
	//    if retrieval fails it just returns an empty struct; never fatal.
	var retrieved RetrievedContext
	if o.retrieval != nil {
		retrieved = o.retrieval.Retrieve(clientID, currentText, 4)
		if retrieved.Blob != "" {
			systemPrompt += retrieved.Blob
		}
	}

	msgs := []ChatMessage{{Role: "system", Content: systemPrompt}}

	// 3. Short conversation memory (last N turns)
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
	return msgs, retrieved
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
