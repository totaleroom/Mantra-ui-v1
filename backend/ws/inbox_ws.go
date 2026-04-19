package ws

import (
	"encoding/json"
	"log"
	"mantra-backend/models"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
)

// pingInterval is how often the server sends a heartbeat frame to each
// connected client. Browsers and proxies (Cloudflare, nginx) typically
// drop idle WebSocket connections after 60-120 s; 30 s stays well below
// the most aggressive of those.
const pingInterval = 30 * time.Second

// subscriber is a connected client's session state. We track:
//   - role + tenant claim (authoritative, set at handshake, NEVER from client)
//   - subscribed set of clientIds (SUPER_ADMIN can subscribe to many)
//
// The subscribe/unsubscribe messages from the client can ONLY widen or
// shrink within what the role+claim allow — a CLIENT_ADMIN of tenant 42
// cannot subscribe to tenant 43 no matter what JSON they send.
type subscriber struct {
	role          string
	claimClientID *uint
	subscribed    map[uint]bool
}

type InboxHub struct {
	mu        sync.RWMutex
	clients   map[*websocket.Conn]*subscriber
	broadcast chan *models.InboxMessage
}

var InboxHubInstance = &InboxHub{
	clients:   make(map[*websocket.Conn]*subscriber),
	broadcast: make(chan *models.InboxMessage, 256),
}

// Run fans broadcast messages out to subscribers that explicitly asked to
// receive messages for that message's client_id. SUPER_ADMIN effectively
// can subscribe to any tenant; others are restricted to their own.
func (h *InboxHub) Run() {
	for msg := range h.broadcast {
		if msg == nil {
			continue
		}
		payload, err := json.Marshal(msg)
		if err != nil {
			continue
		}
		h.mu.RLock()
		for conn, sub := range h.clients {
			if !sub.subscribed[msg.ClientID] {
				continue
			}
			if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
				log.Printf("[InboxWS] Write error: %v", err)
			}
		}
		h.mu.RUnlock()
	}
}

// BroadcastMessage is called by the orchestrator after each persisted
// message. It keeps a pointer so the fan-out loop can use the ClientID
// field without re-decoding.
func (h *InboxHub) BroadcastMessage(msg *models.InboxMessage) {
	if msg == nil {
		return
	}
	select {
	case h.broadcast <- msg:
	default:
		log.Println("[InboxWS] Broadcast channel full, dropping message")
	}
}

// canSubscribeTo returns true if the authenticated caller is allowed to
// watch messages for the given clientId.
func (s *subscriber) canSubscribeTo(clientID uint) bool {
	if s.role == string(models.UserRoleSuperAdmin) {
		return clientID > 0
	}
	return s.claimClientID != nil && *s.claimClientID == clientID
}

// InboxLiveWebSocket is the upgrade handler. It reads role/clientID from
// c.Locals (populated by the HTTP middleware chain before upgrade) so we
// never trust the client's first JSON payload for identity decisions.
func InboxLiveWebSocket(c *websocket.Conn) {
	role, _ := c.Locals("role").(string)
	claimClientID, _ := c.Locals("clientID").(*uint)

	// Any principal reaching this point has a valid JWT (the upgrade
	// fiber handler runs JWTProtected + BlockUntilPasswordChanged first).
	// A tenant-scoped role with a nil claim is a bug upstream; bail.
	if role != string(models.UserRoleSuperAdmin) && claimClientID == nil {
		c.Close()
		return
	}

	sub := &subscriber{
		role:          role,
		claimClientID: claimClientID,
		subscribed:    map[uint]bool{},
	}

	// CLIENT_ADMIN / STAFF: auto-subscribe to their own tenant so the UI
	// doesn't have to send an explicit subscribe message. SUPER_ADMIN
	// must subscribe explicitly to avoid getting firehosed.
	if claimClientID != nil {
		sub.subscribed[*claimClientID] = true
	}

	InboxHubInstance.mu.Lock()
	InboxHubInstance.clients[c] = sub
	InboxHubInstance.mu.Unlock()

	log.Printf("[InboxWS] Client connected: role=%s remote=%s", role, c.RemoteAddr())

	defer func() {
		InboxHubInstance.mu.Lock()
		delete(InboxHubInstance.clients, c)
		InboxHubInstance.mu.Unlock()
		c.Close()
		log.Printf("[InboxWS] Client disconnected: %s", c.RemoteAddr())
	}()

	// Periodic ping so intermediate proxies don't reap the connection.
	// Runs until the outer ReadMessage loop exits (we close `stopPing`
	// in the defer below). Any write error terminates the ticker.
	stopPing := make(chan struct{})
	defer close(stopPing)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[InboxWS] PANIC in ping goroutine: %v", r)
			}
		}()
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		ping, _ := json.Marshal(map[string]string{"type": "ping"})
		for {
			select {
			case <-stopPing:
				return
			case <-ticker.C:
				if err := c.WriteMessage(websocket.TextMessage, ping); err != nil {
					return
				}
			}
		}
	}()

	for {
		_, msgBytes, err := c.ReadMessage()
		if err != nil {
			break
		}

		var clientMsg struct {
			Type     string `json:"type"`
			ClientID uint   `json:"clientId"`
		}
		if err := json.Unmarshal(msgBytes, &clientMsg); err != nil {
			continue
		}

		InboxHubInstance.mu.Lock()
		switch clientMsg.Type {
		case "subscribe":
			if clientMsg.ClientID > 0 && sub.canSubscribeTo(clientMsg.ClientID) {
				sub.subscribed[clientMsg.ClientID] = true
			}
		case "unsubscribe":
			delete(sub.subscribed, clientMsg.ClientID)
		}
		InboxHubInstance.mu.Unlock()
	}
}
