'use client'

import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorFallbackProps {
  /** The error caught by the boundary. */
  error: Error & { digest?: string }
  /** Provided by Next.js error.tsx — re-renders the route segment. */
  reset?: () => void
  /** Optional override title. */
  title?: string
  /** Optional override description. */
  description?: string
  /** If true, renders full-page centered; otherwise inline in current flow. */
  fullPage?: boolean
}

export function ErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  description = "We've logged the error and will look into it. You can try again, or head back to the dashboard.",
  fullPage = true,
}: ErrorFallbackProps) {
  const content = (
    <Card className="max-w-lg w-full border-destructive/30 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/15 shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {process.env.NODE_ENV !== 'production' && (
          <details className="group rounded-md border border-border bg-muted/40 text-xs">
            <summary className="cursor-pointer select-none px-3 py-2 font-mono text-muted-foreground hover:text-foreground">
              Developer details
            </summary>
            <pre className="px-3 pb-3 pt-1 overflow-x-auto text-[11px] leading-relaxed text-destructive">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <div className="flex flex-wrap gap-2">
          {reset && (
            <Button onClick={reset} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try again
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  if (!fullPage) return content

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      {content}
    </div>
  )
}
