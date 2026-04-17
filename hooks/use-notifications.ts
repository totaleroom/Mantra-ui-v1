'use client'

import { useCallback, useEffect, useState } from 'react'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  description: string
  /** ISO timestamp */
  timestamp: string
  read: boolean
  /** Optional link to navigate on click */
  href?: string
}

const STORAGE_KEY = 'mantra_notifications'

function defaultNotifications(): AppNotification[] {
  const now = Date.now()
  return [
    {
      id: 'n-wa-disconnect',
      type: 'warning',
      title: 'WhatsApp instance disconnected',
      description: 'Instance "demo_tenant_01" lost connection. Tap to re-scan QR.',
      timestamp: new Date(now - 5 * 60 * 1000).toISOString(),
      read: false,
      href: '/whatsapp',
    },
    {
      id: 'n-ai-fallback',
      type: 'info',
      title: 'AI provider fallback triggered',
      description: 'Groq rate-limited, switched to OpenRouter for tenant Acme Co.',
      timestamp: new Date(now - 32 * 60 * 1000).toISOString(),
      read: false,
      href: '/ai-hub',
    },
    {
      id: 'n-token-limit',
      type: 'warning',
      title: 'Token limit approaching',
      description: 'Tenant "Beta Corp" used 87% of monthly quota (26k / 30k).',
      timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      read: false,
      href: '/tenants',
    },
  ]
}

function load(): AppNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultNotifications()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : defaultNotifications()
  } catch {
    return defaultNotifications()
  }
}

function save(items: AppNotification[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota errors
  }
}

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setItems(load())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) save(items)
  }, [items, hydrated])

  const unreadCount = items.filter((n) => !n.read).length

  const markAsRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllAsRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
  }, [])

  const add = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newItem: AppNotification = {
      ...notif,
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      read: false,
    }
    setItems((prev) => [newItem, ...prev])
  }, [])

  return {
    items,
    unreadCount,
    hydrated,
    markAsRead,
    markAllAsRead,
    clearAll,
    add,
  }
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}
