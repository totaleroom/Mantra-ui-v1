'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Client, ClientAIConfig } from '@/lib/types'
import type { ClientFormData, ClientAIConfigFormData } from '@/lib/validations'

// Query Keys
export const tenantKeys = {
  all: ['tenants'] as const,
  list: () => [...tenantKeys.all, 'list'] as const,
  detail: (id: number) => [...tenantKeys.all, 'detail', id] as const,
  aiConfig: (clientId: number) => [...tenantKeys.all, 'aiConfig', clientId] as const,
}

// Fetch all tenants (clients)
export function useTenants() {
  return useQuery({
    queryKey: tenantKeys.list(),
    queryFn: () => apiClient.get<Client[]>('/api/clients'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// Fetch single tenant
export function useTenant(id: number) {
  return useQuery({
    queryKey: tenantKeys.detail(id),
    queryFn: () => apiClient.get<Client>(`/api/clients/${id}`),
    enabled: !!id,
  })
}

// Fetch tenant AI config
export function useTenantAIConfig(clientId: number) {
  return useQuery({
    queryKey: tenantKeys.aiConfig(clientId),
    queryFn: () =>
      apiClient.get<ClientAIConfig>(`/api/clients/${clientId}/ai-config`),
    enabled: !!clientId,
  })
}

// Create tenant
export function useCreateTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ClientFormData) =>
      apiClient.post<Client>('/api/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.list() })
    },
  })
}

// Update tenant
export function useUpdateTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClientFormData> }) =>
      apiClient.patch<Client>(`/api/clients/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: tenantKeys.list() })
    },
  })
}

// Update tenant AI config
export function useUpdateTenantAIConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      clientId,
      data,
    }: {
      clientId: number
      data: Omit<ClientAIConfigFormData, 'clientId'>
    }) => apiClient.put<ClientAIConfig>(`/api/clients/${clientId}/ai-config`, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.aiConfig(clientId) })
    },
  })
}

// Toggle tenant active status
export function useToggleTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiClient.patch<Client>(`/api/clients/${id}`, { isActive }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: tenantKeys.list() })
    },
  })
}

// Delete tenant
export function useDeleteTenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete<{ success: boolean }>(`/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.all })
    },
  })
}

// Update token limit
export function useUpdateTokenLimit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, tokenLimit }: { id: number; tokenLimit: number }) =>
      apiClient.patch<Client>(`/api/clients/${id}`, { tokenLimit }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: tenantKeys.list() })
    },
  })
}
