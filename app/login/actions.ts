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

  // Force seeded / bootstrapped accounts straight to /change-password.
  // The edge middleware would do this too on the next request, but
  // hopping there from the server action avoids a flash of the
  // dashboard shell loading endpoints that will 428.
  const mustChange =
    (result.user as { mustChangePassword?: boolean } | undefined)
      ?.mustChangePassword === true
  if (mustChange) {
    redirect('/change-password')
  }

  const redirectTo = formData.get('redirectTo')?.toString() || '/'
  redirect(redirectTo)
}
