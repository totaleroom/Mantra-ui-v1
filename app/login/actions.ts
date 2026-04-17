'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { callLoginAPI, SESSION_COOKIE } from '@/lib/auth'

export interface LoginState {
  error?: string
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' }
  }

  const result = await callLoginAPI(email, password)

  if (!result.ok || !result.token) {
    return { error: result.error ?? 'Email atau password salah.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Must match backend sessionDuration (backend/handlers/auth.go).
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  })

  const redirectTo = formData.get('redirectTo')?.toString() || '/'
  redirect(redirectTo)
}
