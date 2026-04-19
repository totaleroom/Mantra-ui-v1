'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE } from '@/lib/auth'
import { serverConfig } from '@/lib/config'

export interface ChangePasswordState {
  error?: string
}

/**
 * Calls the Go backend's POST /api/auth/change-password.
 * Runs as a Server Action so we can:
 *   1. Read the HttpOnly session cookie (not accessible from JS).
 *   2. Forward it as a cookie on the outgoing fetch.
 *   3. Pick up the freshly-minted cookie from the backend response and
 *      set it on the Next.js response — this clears the `mcp=true`
 *      claim so every subsequent request from the browser works.
 */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const currentPassword = formData.get('currentPassword')?.toString() ?? ''
  const newPassword = formData.get('newPassword')?.toString() ?? ''
  const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

  if (!currentPassword || !newPassword) {
    return { error: 'Password lama dan baru wajib diisi.' }
  }
  if (newPassword.length < 8) {
    return { error: 'Password baru minimal 8 karakter.' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Konfirmasi password tidak cocok.' }
  }
  if (newPassword === currentPassword) {
    return { error: 'Password baru harus berbeda dari password lama.' }
  }

  const cookieStore = await cookies()
  const existing = cookieStore.get(SESSION_COOKIE)?.value
  if (!existing) {
    redirect('/login')
  }

  const backend =
    serverConfig?.backendInternalUrl ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'

  let res: Response
  try {
    res = await fetch(`${backend}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the browser's session cookie so the backend's
        // JWTProtected middleware recognises the caller.
        Cookie: `${SESSION_COOKIE}=${existing}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
      cache: 'no-store',
    })
  } catch {
    return { error: 'Tidak dapat menghubungi server. Coba lagi.' }
  }

  const data = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    return {
      error:
        (data as { error?: string }).error ||
        'Gagal mengubah password. Cek password lama.',
    }
  }

  // The backend returns a freshly-signed JWT in the body AND as a
  // Set-Cookie header. Server Actions can't forward Set-Cookie from an
  // outbound fetch directly, so we re-set the cookie here manually.
  const newToken = (data as { token?: string }).token
  if (newToken) {
    cookieStore.set(SESSION_COOKIE, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // match backend sessionDuration
      path: '/',
    })
  }

  redirect('/')
}
