'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { InboxMessage, Client } from '@/lib/types'

// Query Keys
export const inboxKeys = {
  all: ['inbox'] as const,
  messages: (filters?: InboxFilters) => [...inboxKeys.all, 'messages', filters] as const,
  clients: () => [...inboxKeys.all, 'clients'] as const,
  stats: () => [...inboxKeys.all, 'stats'] as const,
}

export interface InboxFilters {
  clientId?: number
  direction?: 'inbound' | 'outbound'
  search?: string
  limit?: number
  offset?: number
}

export interface InboxStats {
  total: number
  inbound: number
  outbound: number
  aiProcessed: number
}

// Fetch inbox messages with filters
export function useInboxMessages(filters?: InboxFilters) {
  return useQuery({
    queryKey: inboxKeys.messages(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.clientId) params.set('clientId', filters.clientId.toString())
      if (filters?.direction) params.set('direction', filters.direction)
      if (filters?.search) params.set('search', filters.search)
      if (filters?.limit) params.set('limit', filters.limit.toString())
      if (filters?.offset) params.set('offset', filters.offset.toString())

      const query = params.toString()
      return apiClient.get<InboxMessage[]>(`/api/inbox/messages${query ? `?${query}` : ''}`)
    },
    staleTime: 1000 * 30, // 30 seconds
  })
}

// Fetch inbox stats
export function useInboxStats() {
  return useQuery({
    queryKey: inboxKeys.stats(),
    queryFn: () => apiClient.get<InboxStats>('/api/inbox/stats'),
    refetchInterval: 10000, // Refresh every 10 seconds
  })
}

// Fetch clients for filtering
export function useClients() {
  return useQuery({
    queryKey: inboxKeys.clients(),
    queryFn: () => apiClient.get<Client[]>('/api/clients'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

// WebSocket hook for real-time inbox updates
export function useInboxWebSocket(onMessage?: (message: InboxMessage) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const queryClient = useQueryClient()

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const WS_URL = API_URL.replace(/^http/, 'ws')

  const connect = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    setConnectionError(null)

    const ws = new WebSocket(`${WS_URL}/api/inbox/live`)

    ws.onopen = () => {
      setIsConnected(true)
      setConnectionError(null)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'message') {
          const message: InboxMessage = {
            id: data.id,
            clientId: data.clientId,
            clientName: data.clientName,
            customerNumber: data.customerNumber,
            message: data.message,
            direction: data.direction,
            timestamp: new Date(data.timestamp),
            aiThoughtProcess: data.aiThoughtProcess,
            modelUsed: data.modelUsed,
          }

          // Call the callback if provided
          if (onMessage) {
            onMessage(message)
          }

          // Invalidate messages query to trigger refetch
          queryClient.invalidateQueries({ queryKey: inboxKeys.messages() })
          queryClient.invalidateQueries({ queryKey: inboxKeys.stats() })
        } else if (data.type === 'stats_update') {
          // Update stats cache directly
          queryClient.setQueryData(inboxKeys.stats(), data.stats)
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    ws.onerror = () => {
      setConnectionError('Connection error')
      setIsConnected(false)
    }

    ws.onclose = (event) => {
      setIsConnected(false)

      // Auto-reconnect after 3 seconds if not a clean close
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    }

    wsRef.current = ws
  }, [WS_URL, onMessage, queryClient])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close(1000) // Clean close
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    connectionError,
    reconnect: connect,
    disconnect,
  }
}

// Combined hook for inbox with real-time updates
export function useRealtimeInbox(filters?: InboxFilters) {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const queryClient = useQueryClient()

  // Initial fetch
  const { data: initialMessages, isLoading, error } = useInboxMessages(filters)

  // Handle new messages from WebSocket
  const handleNewMessage = useCallback(
    (message: InboxMessage) => {
      setMessages((prev) => {
        // Check if message matches current filters
        if (filters?.clientId && message.clientId !== filters.clientId) {
          return prev
        }
        if (filters?.direction && message.direction !== filters.direction) {
          return prev
        }
        if (
          filters?.search &&
          !message.message.toLowerCase().includes(filters.search.toLowerCase()) &&
          !message.customerNumber.includes(filters.search) &&
          !message.clientName.toLowerCase().includes(filters.search.toLowerCase())
        ) {
          return prev
        }

        // Prepend new message and limit to 100
        return [message, ...prev].slice(0, 100)
      })
    },
    [filters]
  )

  // WebSocket connection
  const { isConnected, connectionError, reconnect } = useInboxWebSocket(handleNewMessage)

  // Sync with query data
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages)
    }
  }, [initialMessages])

  // Clear messages when filters change
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: inboxKeys.messages(filters) })
  }, [filters, queryClient])

  return {
    messages,
    isLoading,
    error,
    isLive: isConnected,
    connectionError,
    reconnect,
  }
}
