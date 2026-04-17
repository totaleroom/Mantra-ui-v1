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
      className="group relative w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-glow hover:shadow-[0_4px_32px_-4px_oklch(0.68_0.22_284/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.68_0.22_284)] focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.12_0.01_264)] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
      style={{
        background:
          'linear-gradient(135deg, oklch(0.55 0.22 284) 0%, oklch(0.62 0.18 200) 100%)',
      }}
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
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-xs font-medium uppercase tracking-wider text-neutral-400"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="admin@mantra.ai"
          className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-xs font-medium uppercase tracking-wider text-neutral-400"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
        />
      </div>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  )
}
