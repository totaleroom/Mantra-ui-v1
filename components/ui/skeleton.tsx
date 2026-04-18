import { cn } from '@/lib/utils'

/**
 * Flat loading placeholder. Deliberately NO animation (no pulse, no shimmer)
 * per design direction: Apple × Nothing OS — static, restrained, no UI noise.
 * If a true shimmer is needed somewhere, pass `animate-pulse` via className.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
