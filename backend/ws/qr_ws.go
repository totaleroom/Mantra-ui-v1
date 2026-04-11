package ws

import (
	"encoding/json"
	"log"
	"mantra-backend/services"
	"time"

	"github.com/gofiber/contrib/websocket"
)

func QRCodeWebSocket(c *websocket.Conn) {
	instanceName := c.Params("name")
	log.Printf("[QRWS] Client connected for instance: %s", instanceName)

	evoSvc := services.NewEvolutionService()

	defer func() {
		c.Close()
		log.Printf("[QRWS] Client disconnected for instance: %s", instanceName)
	}()

	sendQR := func() {
		qrCode, err := evoSvc.GetQRCode(instanceName)
		if err != nil {
			errMsg, _ := json.Marshal(map[string]string{
				"type":    "error",
				"message": "Failed to generate QR code: " + err.Error(),
			})
			c.WriteMessage(1, errMsg)
			return
		}

		qrPayload, _ := json.Marshal(map[string]string{
			"type":   "qr",
			"qrCode": qrCode,
		})
		c.WriteMessage(1, qrPayload)
	}

	sendQR()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			_, msgBytes, err := c.ReadMessage()
			if err != nil {
				return
			}
			var clientMsg struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(msgBytes, &clientMsg); err != nil {
				continue
			}
			if clientMsg.Type == "refresh" {
				sendQR()
			}
		}
	}()

	timeout := time.NewTimer(3 * time.Minute)
	defer timeout.Stop()

	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			statusStr, err := evoSvc.GetInstanceStatus(instanceName)
			if err == nil && statusStr == "CONNECTED" {
				connectedMsg, _ := json.Marshal(map[string]string{
					"type":        "connected",
					"phoneNumber": "",
				})
				c.WriteMessage(1, connectedMsg)
				return
			}
			sendQR()
		case <-timeout.C:
			timeoutMsg, _ := json.Marshal(map[string]string{
				"type":    "timeout",
				"message": "QR code expired. Request a new one.",
			})
			c.WriteMessage(1, timeoutMsg)
			return
		}
	}
}
