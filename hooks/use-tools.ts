'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

// Shapes mirror backend/models/tool.go JSON tags.

export interface ClientTool {
  id: number
  clientId: number
  name: string
  description: string
  parametersSchema: Record<string, unknown>
  handlerType: 'builtin' | 'webhook'
  handlerConfig: Record<string, unknown>
  isActive: boolean
  timeoutMs: number
  createdAt: string
  updatedAt: string
}

export interface ToolInput {
  name: string
  description: string
  parametersSchema: Record<string, unknown>
  handlerType: 'builtin' | 'webhook'
  handlerConfig: Record<string, unknown>
  isActive?: boolean
  timeoutMs?: number
}

export const toolKeys = {
  all: ['tools'] as const,
  list: (clientId: number) => [...toolKeys.all, 'list', clientId] as const,
}

export function useTools(clientId: number) {
  return useQuery({
    queryKey: toolKeys.list(clientId),
    queryFn: () =>
      apiClient.get<{ tools: ClientTool[] }>(`/api/clients/${clientId}/tools`),
    enabled: Number.isFinite(clientId) && clientId > 0,
  })
}

export function useCreateTool(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ToolInput) =>
      apiClient.post<ClientTool>(`/api/clients/${clientId}/tools`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: toolKeys.list(clientId) }),
  })
}

export function useUpdateTool(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ toolId, ...input }: Partial<ToolInput> & { toolId: number }) =>
      apiClient.patch<ClientTool>(
        `/api/clients/${clientId}/tools/${toolId}`,
        input
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: toolKeys.list(clientId) }),
  })
}

export function useDeleteTool(clientId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (toolId: number) =>
      apiClient.delete<{ deleted: boolean; id: number }>(
        `/api/clients/${clientId}/tools/${toolId}`
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: toolKeys.list(clientId) }),
  })
}
