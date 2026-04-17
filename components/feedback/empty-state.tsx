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
      {/* Geometric backdrop + icon */}
      <div className="relative mb-5">
        <div
          aria-hidden
          className="absolute inset-0 -m-6 rounded-full bg-orb-violet blur-2xl opacity-40"
        />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl border border-border bg-card shadow-soft-md">
          <Icon className="w-7 h-7 text-primary" strokeWidth={1.75} />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">{description}</p>
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
