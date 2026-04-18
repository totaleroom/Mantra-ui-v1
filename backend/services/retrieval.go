package services

import (
	"fmt"
	"mantra-backend/database"
	"mantra-backend/models"
	"strings"
)

// RetrievalService assembles relevant context for an inbound message.
//
// Strategy (applied in order):
//
//  1. Exact / fuzzy FAQ match by trigger_keywords and tags. FAQs are
//     human-authored and generally higher quality than semantic search,
//     so when one matches we prepend it to the context.
//  2. Semantic vector search against client_knowledge_chunks using the
//     query's embedding (top-K, cosine distance). This catches the
//     long-tail where no FAQ keyword matches.
//
// Both sources are scoped by client_id. The caller injects the assembled
// context block into the system prompt.
type RetrievalService struct {
	embed *EmbeddingService
}

func NewRetrievalService() *RetrievalService {
	return &RetrievalService{embed: NewEmbeddingService()}
}

// RetrievedContext is the output of Retrieve. `Blob` is the fully formatted
// text block ready to inject into the system prompt (or empty if nothing
// relevant was found). `FAQIDs` and `ChunkIDs` are for audit logging into
// inbox_messages.ai_thought_process.
type RetrievedContext struct {
	Blob     string   `json:"blob"`
	FAQIDs   []uint64 `json:"faqIds"`
	ChunkIDs []uint64 `json:"chunkIds"`
	Provider string   `json:"provider"` // which embedding provider was used
}

// Retrieve builds the context block for a client + query.
// Returns a zero-value RetrievedContext (empty strings/slices) if nothing
// relevant is found — callers should treat that as "skip injection".
//
// Never returns a fatal error for retrieval issues: vector search is a
// best-effort enhancement. If the embedding provider is misconfigured,
// we degrade to FAQ-only. If the FAQ lookup fails, we degrade to
// vector-only. If both fail, we return empty context and a warning.
func (r *RetrievalService) Retrieve(clientID uint, query string, topK int) RetrievedContext {
	if topK <= 0 {
		topK = 4
	}
	out := RetrievedContext{}

	// 1. FAQ matches by trigger keyword or tag (lowercase substring match)
	faqs := r.matchFAQs(clientID, query)
	for _, f := range faqs {
		out.FAQIDs = append(out.FAQIDs, f.ID)
	}

	// 2. Vector search for top-K chunks
	chunks, provider, err := r.vectorSearch(clientID, query, topK)
	if err == nil {
		out.Provider = provider
		for _, c := range chunks {
			out.ChunkIDs = append(out.ChunkIDs, c.ID)
		}
	}

	out.Blob = formatContextBlob(faqs, chunks)
	return out
}

// matchFAQs scans this client's FAQs for any whose trigger_keywords or tags
// appear as substrings in the query (case-insensitive). Returns up to 3
// matches ordered by priority DESC.
//
// Why not SQL-level JSONB contains? pq text[] (jsonb array) containment is
// exact-match only. Real-world customer queries rarely contain the exact
// keyword string — they say "ongkirnya berapa" not "ongkir". Simple Go
// substring scan gives us the flexibility we need without fuzzy-match deps.
func (r *RetrievalService) matchFAQs(clientID uint, query string) []models.FAQ {
	if database.DB == nil {
		return nil
	}
	lowerQuery := strings.ToLower(query)

	var active []models.FAQ
	if err := database.DB.
		Where("client_id = ? AND is_active = ?", clientID, true).
		Order("priority DESC, id DESC").
		Find(&active).Error; err != nil {
		return nil
	}

	var matched []models.FAQ
	seen := map[uint64]bool{}
	for _, f := range active {
		// Try trigger_keywords first (higher signal than tags)
		for _, kw := range f.TriggerKeywords {
			if kw == "" {
				continue
			}
			if strings.Contains(lowerQuery, strings.ToLower(kw)) {
				if !seen[f.ID] {
					matched = append(matched, f)
					seen[f.ID] = true
				}
				break
			}
		}
		if seen[f.ID] {
			continue
		}
		// Fall back to tag match
		for _, t := range f.Tags {
			if t == "" {
				continue
			}
			if strings.Contains(lowerQuery, strings.ToLower(t)) {
				if !seen[f.ID] {
					matched = append(matched, f)
					seen[f.ID] = true
				}
				break
			}
		}
		if len(matched) >= 3 {
			break
		}
	}
	return matched
}

// chunkHit is a minimal row type since we don't need the pgvector back.
type chunkHit struct {
	ID       uint64  `gorm:"column:id"`
	Content  string  `gorm:"column:content"`
	Source   *string `gorm:"column:source"`
	Category *string `gorm:"column:category"`
	Distance float64 `gorm:"column:distance"`
}

// vectorSearch embeds the query and runs an ANN search against
// client_knowledge_chunks using pgvector's cosine distance operator.
// Returns the top-K hits ordered by ascending distance (closer = better).
func (r *RetrievalService) vectorSearch(clientID uint, query string, topK int) ([]chunkHit, string, error) {
	if database.DB == nil {
		return nil, "", fmt.Errorf("database not connected")
	}
	if strings.TrimSpace(query) == "" {
		return nil, "", nil
	}

	vec, provider, err := r.embed.EmbedOne(&clientID, "", query)
	if err != nil {
		return nil, "", err
	}

	var hits []chunkHit
	err = database.DB.Raw(`
		SELECT id, content, source, category,
		       (embedding <=> $1::vector) AS distance
		FROM client_knowledge_chunks
		WHERE client_id = $2 AND embedding IS NOT NULL
		ORDER BY embedding <=> $1::vector
		LIMIT $3
	`, VectorLiteral(vec), clientID, topK).Scan(&hits).Error
	if err != nil {
		return nil, provider, err
	}

	// Filter out low-quality matches. Cosine distance ranges 0-2 in pgvector
	// (0 = identical, 1 = orthogonal, 2 = opposite). Threshold 0.5 means
	// "reasonably similar"; tune if recall/precision is off.
	const maxDistance = 0.55
	filtered := hits[:0]
	for _, h := range hits {
		if h.Distance <= maxDistance {
			filtered = append(filtered, h)
		}
	}
	return filtered, provider, nil
}

// formatContextBlob renders the retrieved FAQs + chunks as a single string
// to inject after the system prompt. Empty string means "no context worth
// injecting" — orchestrator should skip the injection entirely.
func formatContextBlob(faqs []models.FAQ, chunks []chunkHit) string {
	if len(faqs) == 0 && len(chunks) == 0 {
		return ""
	}

	var b strings.Builder
	b.WriteString("\n\n[KNOWLEDGE BASE — use only when relevant]\n")

	if len(faqs) > 0 {
		b.WriteString("\n## FAQ matches\n")
		for _, f := range faqs {
			fmt.Fprintf(&b, "- Q: %s\n  A: %s\n", strings.TrimSpace(f.Question), strings.TrimSpace(f.Answer))
		}
	}

	if len(chunks) > 0 {
		b.WriteString("\n## Reference chunks\n")
		for _, c := range chunks {
			label := ""
			if c.Source != nil && *c.Source != "" {
				label = " [" + *c.Source + "]"
			}
			fmt.Fprintf(&b, "-%s %s\n", label, strings.TrimSpace(c.Content))
		}
	}

	b.WriteString("\n[END KNOWLEDGE BASE]\n")
	return b.String()
}
