'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { loginAction, type LoginState } from './actions'
import { Loader2, AlertCircle } from 'lucide-react'

const initialState: LoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 bg-[var(--accent-blue)] hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing in…
        </>
      ) : (
        'Sign In'
      )}
    </button>
  )
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState(loginAction, initialState)

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {state.error && (
        <div className="flex items-start gap-2.5 rounded-lg border-hairline border-[color-mix(in_srgb,var(--accent-red)_30%,transparent)] bg-[var(--accent-red-muted)] px-3.5 py-2.5 text-[13px] text-[var(--accent-red)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="label-mono block">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="admin@mantra.ai"
          className="w-full rounded-lg border-hairline bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-[var(--fg-subtle)] outline-none transition-colors duration-150 focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)]"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="label-mono block">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full rounded-lg border-hairline bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-[var(--fg-subtle)] outline-none transition-colors duration-150 focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent-blue)_20%,transparent)]"
        />
      </div>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  )
}
