'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { AIProvider, AIModel } from '@/lib/types'
import type { AIProviderFormData } from '@/lib/validations'

// Query Keys
export const aiProviderKeys = {
  all: ['ai-providers'] as const,
  list: () => [...aiProviderKeys.all, 'list'] as const,
  detail: (id: number) => [...aiProviderKeys.all, 'detail', id] as const,
  models: (providerId: number) =>
    [...aiProviderKeys.all, 'models', providerId] as const,
  allModels: () => [...aiProviderKeys.all, 'models', 'all'] as const,
}

// Fetch all AI providers
export function useAIProviders() {
  return useQuery({
    queryKey: aiProviderKeys.list(),
    queryFn: () => apiClient.get<AIProvider[]>('/api/ai-providers'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Fetch single AI provider
export function useAIProvider(id: number) {
  return useQuery({
    queryKey: aiProviderKeys.detail(id),
    queryFn: () => apiClient.get<AIProvider>(`/api/ai-providers/${id}`),
    enabled: !!id,
  })
}

// Fetch models from a specific provider
export function useProviderModels(providerId: number) {
  return useQuery({
    queryKey: aiProviderKeys.models(providerId),
    queryFn: () =>
      apiClient.get<AIModel[]>(`/api/ai-providers/${providerId}/models`),
    enabled: !!providerId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

// Fetch all available models (aggregated from all active providers)
export function useAllModels() {
  return useQuery({
    queryKey: aiProviderKeys.allModels(),
    queryFn: () => apiClient.get<AIModel[]>('/api/ai-providers/models'),
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

// Create AI provider
export function useCreateAIProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AIProviderFormData) =>
      apiClient.post<AIProvider>('/api/ai-providers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiProviderKeys.all })
    },
  })
}

// Update AI provider
export function useUpdateAIProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AIProviderFormData> }) =>
      apiClient.patch<AIProvider>(`/api/ai-providers/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: aiProviderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: aiProviderKeys.list() })
    },
  })
}

// Delete AI provider
export function useDeleteAIProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete<{ success: boolean }>(`/api/ai-providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiProviderKeys.all })
    },
  })
}

// Toggle AI provider active status
export function useToggleAIProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiClient.patch<AIProvider>(`/api/ai-providers/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiProviderKeys.all })
    },
  })
}

// Update provider priorities (for drag-and-drop reordering)
export function useUpdateProviderPriorities() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (priorities: { id: number; priority: number }[]) =>
      apiClient.put<{ success: boolean }>('/api/ai-providers/priorities', {
        priorities,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiProviderKeys.list() })
    },
  })
}

// Test AI provider connection
export function useTestAIProvider() {
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.post<{ success: boolean; latency: number; error?: string }>(
        `/api/ai-providers/${id}/test`
      ),
  })
}
