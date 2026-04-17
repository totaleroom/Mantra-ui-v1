'use client'

import { useEffect, useState } from 'react'

export interface ClientSession {
  userId: string
  email: string
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'STAFF'
}

/**
 * Decode JWT session from cookie on the client.
 * Does NOT verify signature (server-side middleware handles that).
 * Used for displaying user info in UI.
 */
function decodeJwtPayload(token: string): ClientSession | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(json)
    return {
      userId: String(data.userId ?? ''),
      email: String(data.email ?? ''),
      role: (data.role ?? 'STAFF') as ClientSession['role'],
    }
  } catch {
    return null
  }
}

function readSessionFromCookie(): ClientSession | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)mantra_session=([^;]+)/)
  if (!match) return null
  return decodeJwtPayload(decodeURIComponent(match[1]))
}

export function useSession(): {
  session: ClientSession | null
  isLoading: boolean
} {
  const [session, setSession] = useState<ClientSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSession(readSessionFromCookie())
    setIsLoading(false)
  }, [])

  return { session, isLoading }
}

export function getInitials(email: string): string {
  if (!email) return '?'
  const name = email.split('@')[0]
  return name.slice(0, 2).toUpperCase()
}

export function getRoleLabel(role?: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin'
    case 'CLIENT_ADMIN':
      return 'Client Admin'
    case 'STAFF':
      return 'Staff'
    default:
      return 'User'
  }
}
