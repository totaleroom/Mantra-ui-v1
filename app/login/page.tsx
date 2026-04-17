import { LoginForm } from './login-form'

interface Props {
  searchParams: Promise<{ redirect?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const redirectTo = params.redirect || '/'

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[oklch(0.12_0.01_264)]">
      {/* Ambient dual-orb background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[560px] w-[560px] rounded-full bg-orb-violet blur-3xl opacity-70" />
        <div className="absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-orb-emerald blur-3xl opacity-60" />
        <div className="absolute inset-0 bg-grain" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8 animate-in-fade">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Brand tile with gradient */}
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-xl ring-1 ring-white/15 shadow-glow"
            style={{
              background:
                'linear-gradient(135deg, oklch(0.52 0.22 284) 0%, oklch(0.58 0.15 158) 100%)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-white"
            >
              <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
              <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
              <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Mantra <span className="text-gradient-brand">AI</span>
            </h1>
            <p className="text-sm text-neutral-400">Command Center</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-8 shadow-soft-xl">
          <LoginForm redirectTo={redirectTo} />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
          <span className="dot-live" aria-hidden />
          <span>All systems operational</span>
        </div>
      </div>
    </div>
  )
}
