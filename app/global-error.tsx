'use client'

/**
 * Last-resort error boundary that even replaces the root layout.
 * Used when the RootLayout itself throws (e.g. env validation failure,
 * provider crash). Must include <html> and <body> because it replaces
 * the entire document tree.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          background: '#0b0b0f',
          color: '#fafafa',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: 480, width: '100%' }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px 0' }}>
            Mantra AI — critical error
          </h1>
          <p style={{ margin: '0 0 16px 0', color: '#a1a1aa', fontSize: 14 }}>
            The application failed to render. This usually means an environment
            variable is missing or a provider crashed. Your data is safe.
          </p>
          {process.env.NODE_ENV !== 'production' && (
            <pre
              style={{
                background: '#18181b',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                overflow: 'auto',
                border: '1px solid #27272a',
                color: '#fca5a5',
              }}
            >
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
