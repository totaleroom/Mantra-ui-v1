import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
}

/**
 * Consistent empty state used by any list/table when there's no data yet.
 * Keeps the tone: friendly + one clear next action.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-4',
        className
      )}
    >
      {/* Dot matrix backdrop (Nothing-OS) + Apple-style icon tile */}
      <div className="relative mb-6">
        <div
          aria-hidden
          className="absolute inset-0 -m-8 bg-dots opacity-50 [mask-image:radial-gradient(circle,black_30%,transparent_70%)]"
        />
        <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl border-hairline bg-card shadow-soft-md">
          <Icon className="w-6 h-6 text-foreground" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.015em]">{title}</h3>
      {description && (
        <p className="text-[13px] text-[var(--fg-muted)] mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Button size="sm" asChild>
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
