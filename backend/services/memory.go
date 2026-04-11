package services

import (
	"context"
	"encoding/json"
	"fmt"
	"mantra-backend/database"
	"mantra-backend/models"
	"time"
)

const defaultTTLDays = 4

type MemoryService struct{}

func NewMemoryService() *MemoryService {
	return &MemoryService{}
}

func redisKey(clientID uint, customerNumber string) string {
	return fmt.Sprintf("memory:%d:%s", clientID, customerNumber)
}

func (m *MemoryService) GetMemory(clientID uint, customerNumber string) (*models.CustomerMemory, error) {
	ctx := context.Background()

	if database.Redis != nil {
		key := redisKey(clientID, customerNumber)
		val, err := database.Redis.Get(ctx, key).Result()
		if err == nil {
			var mem models.CustomerMemory
			if jsonErr := json.Unmarshal([]byte(val), &mem); jsonErr == nil {
				return &mem, nil
			}
		}
	}

	if database.DB == nil {
		return nil, nil
	}

	var mem models.CustomerMemory
	result := database.DB.
		Where("client_id = ? AND customer_number = ? AND expires_at > ?", clientID, customerNumber, time.Now()).
		First(&mem)
	if result.Error != nil {
		return nil, nil
	}

	if database.Redis != nil {
		m.cacheMemory(ctx, &mem)
	}
	return &mem, nil
}

func (m *MemoryService) UpsertMemory(clientID uint, customerNumber string, summary string, rawHistory []map[string]interface{}, ttlDays int) (*models.CustomerMemory, error) {
	if ttlDays <= 0 {
		ttlDays = defaultTTLDays
	}

	expiresAt := time.Now().AddDate(0, 0, ttlDays)
	now := time.Now()

	if database.DB == nil {
		return nil, fmt.Errorf("database not connected")
	}

	var mem models.CustomerMemory
	result := database.DB.Where("client_id = ? AND customer_number = ?", clientID, customerNumber).First(&mem)

	if result.Error != nil {
		mem = models.CustomerMemory{
			ClientID:       clientID,
			CustomerNumber: customerNumber,
		}
	}

	mem.Summary = &summary
	mem.RawHistory = rawHistory
	mem.ExpiresAt = expiresAt
	mem.UpdatedAt = now

	if err := database.DB.Save(&mem).Error; err != nil {
		return nil, err
	}

	if database.Redis != nil {
		ctx := context.Background()
		m.cacheMemory(ctx, &mem)
	}

	return &mem, nil
}

func (m *MemoryService) DeleteMemory(clientID uint, customerNumber string) error {
	if database.DB != nil {
		database.DB.Where("client_id = ? AND customer_number = ?", clientID, customerNumber).Delete(&models.CustomerMemory{})
	}

	if database.Redis != nil {
		ctx := context.Background()
		database.Redis.Del(ctx, redisKey(clientID, customerNumber))
	}
	return nil
}

func (m *MemoryService) PurgeExpiredMemory() (int64, error) {
	if database.DB == nil {
		return 0, nil
	}
	result := database.DB.Where("expires_at < ?", time.Now()).Delete(&models.CustomerMemory{})
	return result.RowsAffected, result.Error
}

func (m *MemoryService) cacheMemory(ctx context.Context, mem *models.CustomerMemory) {
	key := redisKey(mem.ClientID, mem.CustomerNumber)
	data, err := json.Marshal(mem)
	if err != nil {
		return
	}
	ttl := time.Until(mem.ExpiresAt)
	if ttl > 0 {
		database.Redis.Set(ctx, key, data, ttl)
	}
}
