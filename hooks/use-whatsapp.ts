'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { WhatsAppInstance, WhatsAppProviderDefinition } from '@/lib/types'
import type { WhatsAppInstanceFormData } from '@/lib/validations'

// Query Keys
export const whatsappKeys = {
  all: ['whatsapp'] as const,
  instances: () => [...whatsappKeys.all, 'instances'] as const,
  providers: () => [...whatsappKeys.all, 'providers'] as const,
  instance: (id: number) => [...whatsappKeys.all, 'instance', id] as const,
  qrCode: (instanceName: string) =>
    [...whatsappKeys.all, 'qr', instanceName] as const,
  status: (instanceName: string) =>
    [...whatsappKeys.all, 'status', instanceName] as const,
}

// Fetch all WhatsApp instances
export function useWhatsAppInstances() {
  return useQuery({
    queryKey: whatsappKeys.instances(),
    queryFn: () => apiClient.get<WhatsAppInstance[]>('/api/whatsapp/instances'),
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

export function useWhatsAppProviders() {
  return useQuery({
    queryKey: whatsappKeys.providers(),
    queryFn: () => apiClient.get<WhatsAppProviderDefinition[]>('/api/whatsapp/providers'),
    staleTime: 1000 * 60 * 30,
  })
}

// Fetch single instance
export function useWhatsAppInstance(id: number) {
  return useQuery({
    queryKey: whatsappKeys.instance(id),
    queryFn: () => apiClient.get<WhatsAppInstance>(`/api/whatsapp/instances/${id}`),
    enabled: !!id,
  })
}

// Create WhatsApp instance
export function useCreateWhatsAppInstance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: WhatsAppInstanceFormData) =>
      apiClient.post<WhatsAppInstance>('/api/whatsapp/instances', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappKeys.instances() })
    },
  })
}

// Delete WhatsApp instance
export function useDeleteWhatsAppInstance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) =>
      apiClient.delete<{ success: boolean }>(`/api/whatsapp/instances/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappKeys.instances() })
    },
  })
}

// Send a manual WhatsApp message from the dashboard.
// Backend: POST /api/whatsapp/instances/:id/send
export function useSendWhatsAppMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      instanceId,
      to,
      text,
    }: {
      instanceId: number
      to: string
      text: string
    }) =>
      apiClient.post(`/api/whatsapp/instances/${instanceId}/send`, {
        to,
        text,
      }),
    onSuccess: () => {
      // Refresh inbox so the new outbound message appears immediately
      // (the WebSocket broadcast also pushes it, this is the belt-and-suspenders path)
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
  })
}

// Disconnect WhatsApp instance
export function useDisconnectWhatsAppInstance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (instanceName: string) =>
      apiClient.post<{ success: boolean }>(
        `/api/whatsapp/instances/${instanceName}/disconnect`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappKeys.instances() })
    },
  })
}

// QR Code Stream Hook - handles base64 QR code updates from backend
export function useQRCodeStream(instanceName: string | null) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(60)
  const wsRef = useRef<WebSocket | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const queryClient = useQueryClient()

  const WS_URL =
    process.env.NEXT_PUBLIC_WS_URL ||
    'ws://localhost:3001'

  const startCountdown = useCallback(() => {
    setCountdown(60)
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
    }
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const connect = useCallback(() => {
    if (!instanceName) return

    setIsLoading(true)
    setError(null)
    setQrCode(null)
    setIsConnected(false)

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = new WebSocket(
      `${WS_URL}/api/whatsapp/instances/${instanceName}/qr`
    )

    ws.onopen = () => {
      setIsLoading(false)
      startCountdown()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'qr') {
          // QR code received as base64
          setQrCode(data.qrCode)
          startCountdown() // Reset countdown on new QR
        } else if (data.type === 'connected') {
          setIsConnected(true)
          setQrCode(null)
          if (countdownRef.current) {
            clearInterval(countdownRef.current)
          }
          // Invalidate instances query to refresh status
          queryClient.invalidateQueries({ queryKey: whatsappKeys.instances() })
        } else if (data.type === 'error') {
          setError(data.message)
        } else if (data.type === 'timeout') {
          setQrCode(null)
          setCountdown(0)
        }
      } catch {
        // Handle raw base64 string (legacy format)
        if (typeof event.data === 'string' && event.data.startsWith('data:image')) {
          setQrCode(event.data)
          startCountdown()
        }
      }
    }

    ws.onerror = () => {
      setError('Connection failed. Please try again.')
      setIsLoading(false)
    }

    ws.onclose = () => {
      setIsLoading(false)
    }

    wsRef.current = ws
  }, [instanceName, WS_URL, startCountdown, queryClient])

  const refresh = useCallback(() => {
    connect()
  }, [connect])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setQrCode(null)
    setIsConnected(false)
    setIsLoading(false)
    setError(null)
    setCountdown(60)
  }, [])

  // Auto-connect when instanceName changes
  useEffect(() => {
    if (instanceName) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [instanceName, connect, disconnect])

  return {
    qrCode,
    isConnected,
    isLoading,
    error,
    countdown,
    refresh,
    disconnect,
  }
}

// Fetch instance status (polling fallback if WS not available)
export function useInstanceStatus(instanceName: string | null) {
  return useQuery({
    queryKey: whatsappKeys.status(instanceName || ''),
    queryFn: () =>
      apiClient.get<{ status: WhatsAppInstance['status'] }>(
        `/api/whatsapp/instances/${instanceName}/status`
      ),
    enabled: !!instanceName,
    refetchInterval: 5000, // Poll every 5 seconds
  })
}
