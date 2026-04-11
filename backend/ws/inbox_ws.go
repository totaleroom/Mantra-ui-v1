package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
)

type InboxHub struct {
	mu          sync.RWMutex
	clients     map[*websocket.Conn]map[uint]bool
	broadcast   chan []byte
}

var InboxHubInstance = &InboxHub{
	clients:   make(map[*websocket.Conn]map[uint]bool),
	broadcast: make(chan []byte, 256),
}

func (h *InboxHub) Run() {
	for msg := range h.broadcast {
		h.mu.RLock()
		for conn := range h.clients {
			if err := conn.WriteMessage(1, msg); err != nil {
				log.Printf("[InboxWS] Write error: %v", err)
			}
		}
		h.mu.RUnlock()
	}
}

func (h *InboxHub) BroadcastMessage(msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case h.broadcast <- data:
	default:
		log.Println("[InboxWS] Broadcast channel full, dropping message")
	}
}

func InboxLiveWebSocket(c *websocket.Conn) {
	InboxHubInstance.mu.Lock()
	InboxHubInstance.clients[c] = make(map[uint]bool)
	InboxHubInstance.mu.Unlock()

	log.Printf("[InboxWS] Client connected: %s", c.RemoteAddr())

	defer func() {
		InboxHubInstance.mu.Lock()
		delete(InboxHubInstance.clients, c)
		InboxHubInstance.mu.Unlock()
		c.Close()
		log.Printf("[InboxWS] Client disconnected: %s", c.RemoteAddr())
	}()

	pingTicker := make(chan struct{})
	go func() {
		defer close(pingTicker)
		for {
			ping, _ := json.Marshal(map[string]string{"type": "ping"})
			if err := c.WriteMessage(1, ping); err != nil {
				return
			}
			select {
			case <-pingTicker:
				return
			default:
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
			if clientMsg.ClientID > 0 {
				InboxHubInstance.clients[c][clientMsg.ClientID] = true
			}
		case "unsubscribe":
			delete(InboxHubInstance.clients[c], clientMsg.ClientID)
		}
		InboxHubInstance.mu.Unlock()
	}
}
