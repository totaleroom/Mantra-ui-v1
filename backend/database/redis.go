package database

import (
	"context"
	"log"
	"mantra-backend/config"

	"github.com/redis/go-redis/v9"
)

var Redis *redis.Client

func ConnectRedis() {
	redisURL := config.C.RedisURL
	if redisURL == "" {
		log.Println("[Redis] REDIS_URL not set — skipping Redis connection")
		return
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("[Redis] Invalid REDIS_URL: %v — skipping", err)
		return
	}

	client := redis.NewClient(opt)

	ctx := context.Background()
	if _, err := client.Ping(ctx).Result(); err != nil {
		log.Printf("[Redis] Failed to connect: %v — running without Redis", err)
		return
	}

	Redis = client
	log.Println("[Redis] Connected successfully")
}
