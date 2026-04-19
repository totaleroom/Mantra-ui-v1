package services

import (
	"context"
	"fmt"
	"mantra-backend/database"
	"os"
	"strconv"
	"time"
)

// Budget gates expensive per-tenant operations (embedding, LLM tokens)
// behind a rolling daily cap. Counters live in Redis with a 25-hour TTL
// so the rollover window is self-healing: no cron, no DB table needed.
//
// Failure mode: if Redis is unreachable we ALLOW the call through and
// log a warning. That's consistent with retrieval.go's "degrade, don't
// fail" posture — budget enforcement is a cost guardrail, not an auth
// boundary. Pair it with Postgres-level token_limit on the clients
// table for audit-grade accounting.
type Budget struct{}

func NewBudget() *Budget { return &Budget{} }

// key returns the Redis key for a metric on the current UTC day.
// Example: budget:cid=42:embed_tokens:2026-04-19
func (b *Budget) key(clientID uint, metric string) string {
	return fmt.Sprintf("budget:cid=%d:%s:%s",
		clientID, metric, time.Now().UTC().Format("2006-01-02"))
}

// envLimit reads LIMIT_<METRIC_UPPER> from env with a default fallback.
// e.g. envLimit("embed_tokens", 200000) reads LIMIT_EMBED_TOKENS.
func (b *Budget) envLimit(metric string, fallback int64) int64 {
	key := "LIMIT_" + upperSnake(metric)
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

// Check returns an error if adding `add` to the metric would exceed the
// per-day cap. It does NOT increment — call Add after the work is done.
// The two-step design lets us reject BEFORE spending on the provider.
func (b *Budget) Check(ctx context.Context, clientID uint, metric string, add int64, fallback int64) error {
	if database.Redis == nil || clientID == 0 {
		return nil
	}
	cap := b.envLimit(metric, fallback)
	cur, err := database.Redis.Get(ctx, b.key(clientID, metric)).Int64()
	if err != nil {
		// Key missing → 0 used; any other error fails open.
		return nil
	}
	if cur+add > cap {
		return fmt.Errorf("daily %s budget exceeded (used %d, cap %d)", metric, cur, cap)
	}
	return nil
}

// Add increments the per-day counter and refreshes the 25-hour TTL.
// Call AFTER the provider has been charged.
func (b *Budget) Add(ctx context.Context, clientID uint, metric string, n int64) {
	if database.Redis == nil || clientID == 0 || n <= 0 {
		return
	}
	k := b.key(clientID, metric)
	// Pipeline for one round-trip.
	pipe := database.Redis.TxPipeline()
	pipe.IncrBy(ctx, k, n)
	pipe.Expire(ctx, k, 25*time.Hour)
	_, _ = pipe.Exec(ctx)
}

func upperSnake(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch >= 'a' && ch <= 'z' {
			ch = ch - 'a' + 'A'
		}
		out = append(out, ch)
	}
	return string(out)
}
