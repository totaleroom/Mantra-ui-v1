import { LoginForm } from './login-form'

interface Props {
  searchParams: Promise<{ redirect?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const redirectTo = params.redirect || '/'

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
      {/* Dot matrix background — Nothing-OS signature */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dots opacity-40"
      />

      {/* Apple vibrancy card sits above dots */}
      <div className="relative z-10 w-full max-w-sm animate-in-fade">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-5 mb-8">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-foreground shadow-soft-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-background"
            >
              <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
              <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
              <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
            </svg>
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-[22px] font-semibold text-foreground">Mantra AI</h1>
            <p className="label-mono">Command Center</p>
          </div>
        </div>

        {/* Login card */}
        <div className="vibrancy-card rounded-2xl p-7">
          <LoginForm redirectTo={redirectTo} />
        </div>

        {/* Dotted divider */}
        <hr className="divider-dots mt-8 mb-4" />

        {/* Live status */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted">
          <span className="dot-live" aria-hidden />
          <span className="font-mono tracking-wide">ALL SYSTEMS OPERATIONAL</span>
        </div>
      </div>
    </div>
  )
}
