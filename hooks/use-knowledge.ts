'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

// ──────────── Types (match backend/models/knowledge.go JSON) ────────────

export interface KnowledgeChunk {
  id: number
  clientId: number
  content: string
  source: string | null
  category: string | null
  metadata: Record<string, unknown>
  tokenCount: number | null
  createdAt: string
  updatedAt: string
}

export interface FAQ {
  id: number
  clientId: number
  question: string
  answer: string
  tags: string[]
  triggerKeywords: string[]
  priority: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface KnowledgeStats {
  clientId: number
  totalChunks: number
  totalFaqs: number
  activeFaqs: number
  lastChunkAddedAt?: string
  lastFaqUpdatedAt?: string
}

export interface UploadChunksInput {
  text: string
  source?: string
  category?: string
  metadata?: Record<string, unknown>
  model?: string
}

export interface UploadChunksResponse {
  clientId: number
  chunksAdded: number
  chunkIds: number[]
  provider: string
  model: string
}

export interface FAQInput {
  question: string
  answer: string
  tags?: string[]
  triggerKeywords?: string[]
  priority?: number
  isActive?: boolean
}

// ──────────── Query keys ────────────

export const knowledgeKeys = {
  all: ['knowledge'] as const,
  stats: (clientId: number) => [...knowledgeKeys.all, 'stats', clientId] as const,
  chunks: (clientId: number) => [...knowledgeKeys.all, 'chunks', clientId] as const,
  faqs: (clientId: number) => [...knowledgeKeys.all, 'faqs', clientId] as const,
}

// ──────────── Queries ────────────

export function useKnowledgeStats(clientId: number) {
  return useQuery({
    queryKey: knowledgeKeys.stats(clientId),
    queryFn: () =>
      apiClient.get<KnowledgeStats>(`/api/clients/${clientId}/knowledge/stats`),
    enabled: Number.isFinite(clientId) && clientId > 0,
  })
}

export function useKnowledgeChunks(clientId: number, opts?: { limit?: number; offset?: number; category?: string }) {
  const params = new URLSearchParams()
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.offset) params.set('offset', String(opts.offset))
  if (opts?.category) params.set('category', opts.category)
  const q = params.toString()
  const url = `/api/clients/${clientId}/knowledge/chunks${q ? `?${q}` : ''}`

  return useQuery({
    queryKey: [...knowledgeKeys.chunks(clientId), opts ?? {}],
    queryFn: () =>
      apiClient.get<{ total: number; limit: number; offset: number; chunks: KnowledgeChunk[] }>(url),
    enabled: Number.isFinite(clientId) && clientId > 0,
  })
}

export function useFAQs(clientId: number, includeInactive = true) {
  return useQuery({
    queryKey: [...knowledgeKeys.faqs(clientId), includeInactive],
    queryFn: () =>
      apiClient.get<{ faqs: FAQ[] }>(
        `/api/clients/${clientId}/knowledge/faqs?includeInactive=${includeInactive}`
      ),
    enabled: Number.isFinite(clientId) && clientId > 0,
  })
}

// ──────────── Mutations ────────────

export function useUploadChunks(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UploadChunksInput) =>
      apiClient.post<UploadChunksResponse>(
        `/api/clients/${clientId}/knowledge/chunks`,
        input
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.chunks(clientId) })
      qc.invalidateQueries({ queryKey: knowledgeKeys.stats(clientId) })
    },
  })
}

export function useDeleteChunk(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (chunkId: number) =>
      apiClient.delete<{ deleted: boolean; id: number }>(
        `/api/clients/${clientId}/knowledge/chunks/${chunkId}`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.chunks(clientId) })
      qc.invalidateQueries({ queryKey: knowledgeKeys.stats(clientId) })
    },
  })
}

export function useCreateFAQ(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FAQInput) =>
      apiClient.post<FAQ>(`/api/clients/${clientId}/knowledge/faqs`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.faqs(clientId) })
      qc.invalidateQueries({ queryKey: knowledgeKeys.stats(clientId) })
    },
  })
}

export function useUpdateFAQ(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ faqId, ...input }: FAQInput & { faqId: number }) =>
      apiClient.patch<FAQ>(
        `/api/clients/${clientId}/knowledge/faqs/${faqId}`,
        input
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.faqs(clientId) })
      qc.invalidateQueries({ queryKey: knowledgeKeys.stats(clientId) })
    },
  })
}

export function useDeleteFAQ(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (faqId: number) =>
      apiClient.delete<{ deleted: boolean; id: number }>(
        `/api/clients/${clientId}/knowledge/faqs/${faqId}`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.faqs(clientId) })
      qc.invalidateQueries({ queryKey: knowledgeKeys.stats(clientId) })
    },
  })
}
