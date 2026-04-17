'use client'

import { useEffect } from 'react'
import { ErrorFallback } from '@/components/feedback/error-fallback'

/**
 * Default error boundary for every route under `app/`.
 * Next.js wraps each segment with this — individual routes can override
 * by dropping their own `error.tsx` next to `page.tsx`.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO: pipe to Sentry / structured logger once added (Wave 5).
    // For now keep it in the browser console with a clear prefix.
    // eslint-disable-next-line no-console
    console.error('[route-error]', error)
  }, [error])

  return <ErrorFallback error={error} reset={reset} />
}
