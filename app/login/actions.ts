'use server'

import { redirect } from 'next/navigation'
import { callLoginAPI } from '@/lib/auth'

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
    return { error: 'Email and password are required.' }
  }

  const result = await callLoginAPI(email, password)

  if (!result.ok) {
    return { error: result.error ?? 'Invalid credentials.' }
  }

  redirect('/')
}
