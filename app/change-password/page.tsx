import { ChangePasswordForm } from './change-password-form'
import { ShieldAlert } from 'lucide-react'

// This page is deliberately reachable while the caller still has
// must_change_password=TRUE. The edge middleware lets authenticated
// users through to /change-password precisely so they can land here
// and clear the flag. Unauthenticated users are bounced to /login.
export default function ChangePasswordPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dots opacity-40"
      />

      <div className="relative z-10 w-full max-w-sm animate-in-fade">
        <div className="flex flex-col items-center gap-5 mb-8">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-amber)] shadow-soft-md">
            <ShieldAlert className="h-6 w-6 text-background" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-[22px] font-semibold text-foreground">
              Ganti Password
            </h1>
            <p className="label-mono">Wajib sebelum akses dashboard</p>
          </div>
        </div>

        <div className="vibrancy-card rounded-2xl p-7">
          <ChangePasswordForm />
        </div>

        <hr className="divider-dots mt-8 mb-4" />

        <p className="text-[11px] text-muted text-center leading-relaxed px-2">
          Akun default sistem wajib merotasi password pada login pertama.
          Setelah ini kamu akan langsung diarahkan ke dashboard.
        </p>
      </div>
    </div>
  )
}
