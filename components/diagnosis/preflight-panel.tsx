'use client'

/**
 * Preflight Panel — the "Blackbox" Diagnosis Center.
 *
 * Consumes GET /api/system/preflight (SUPER_ADMIN only).
 *
 * Render model:
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  Overall: OK / WARN / FAIL   (banner with color semantics)│
 *   │  Counts: users=2  clients=1  tables=11                    │
 *   └───────────────────────────────────────────────────────────┘
 *   ┌─ Infrastructure ──┐ ┌─ Config ─────────┐ ┌─ Bootstrap ────┐
 *   │ • PostgreSQL  ✓   │ │ • JWT secret  ✓  │ │ • Users    ✓   │
 *   │ • Redis       ✓   │ │ • Webhook     ⚠  │ │ • Tenants  ✓   │
 *   │ • Evolution   ✓   │ │ • Frontend    ✓  │ │ • Rotation ⚠   │
 *   └───────────────────┘ └──────────────────┘ └────────────────┘
 *
 * On any failing/warn card the user can expand to see:
 *   - message (what we observed)
 *   - remediation (concrete shell / SQL fix)
 *   - docRef link (e.g. ".agent/05-gotchas.md#g16")
 */

import { useCallback, useEffect, useState } from 'react'
import { apiClient, ApiError } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'

type PreflightStatus = 'ok' | 'warn' | 'fail' | 'skip'

interface PreflightCheck {
  id: string
  category: string
  label: string
  status: PreflightStatus
  message: string
  latencyMs?: number
  remediation?: string
  docRef?: string
}

interface PreflightReport {
  overall: PreflightStatus
  timestamp: string
  version: string
  runtime: string
  env: string
  counts?: Record<string, number>
  checks: PreflightCheck[]
}

const CATEGORY_ORDER = [
  'infrastructure',
  'config',
  'bootstrap',
  'security',
  'runtime',
]

const CATEGORY_LABEL: Record<string, string> = {
  infrastructure: 'Infrastructure',
  config: 'Configuration',
  bootstrap: 'Bootstrap',
  security: 'Security',
  runtime: 'Runtime',
}

function statusIcon(s: PreflightStatus, className = 'h-4 w-4') {
  switch (s) {
    case 'ok':
      return <CheckCircle2 className={`${className} text-emerald-500`} />
    case 'warn':
      return <AlertTriangle className={`${className} text-amber-500`} />
    case 'fail':
      return <XCircle className={`${className} text-red-500`} />
    case 'skip':
      return <Circle className={`${className} text-muted-foreground`} />
  }
}

function statusBadge(s: PreflightStatus) {
  const variants: Record<PreflightStatus, string> = {
    ok: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    warn: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
    fail: 'bg-red-500/15 text-red-600 border-red-500/30',
    skip: 'bg-muted text-muted-foreground border-muted',
  }
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[10px] tracking-wider uppercase ${variants[s]}`}
    >
      {s}
    </Badge>
  )
}

export function PreflightPanel() {
  const [report, setReport] = useState<PreflightReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<PreflightReport>('/api/system/preflight')
      setReport(data)
      setLastFetched(new Date())
    } catch (e) {
      // The preflight endpoint deliberately returns 503 when overall=fail.
      // ApiError carries the body as .data so we can still render it.
      if (e instanceof ApiError && e.data && typeof e.data === 'object') {
        setReport(e.data as PreflightReport)
        setLastFetched(new Date())
        setError(null)
      } else {
        setError(
          e instanceof Error ? e.message : 'Preflight endpoint unreachable'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport()
    const interval = setInterval(fetchReport, 30_000)
    return () => clearInterval(interval)
  }, [fetchReport])

  if (loading && !report) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading blackbox report…
        </CardContent>
      </Card>
    )
  }
  if (error && !report) {
    return (
      <Card className="border-red-500/40 bg-red-500/5">
        <CardContent className="p-6 text-sm text-red-600">
          <p className="font-medium">Preflight fetch failed</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }
  if (!report) return null

  const grouped = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    label: CATEGORY_LABEL[cat] ?? cat,
    checks: report.checks.filter((c) => c.category === cat),
  })).filter((g) => g.checks.length > 0)

  const overallColor =
    report.overall === 'ok'
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : report.overall === 'warn'
        ? 'border-amber-500/40 bg-amber-500/5'
        : 'border-red-500/40 bg-red-500/5'

  const overallText =
    report.overall === 'ok'
      ? 'All systems operational'
      : report.overall === 'warn'
        ? 'Degraded — review warnings below'
        : 'One or more checks are failing — see remediation'

  const failCount = report.checks.filter((c) => c.status === 'fail').length
  const warnCount = report.checks.filter((c) => c.status === 'warn').length

  return (
    <div className="space-y-4">
      {/* Overall banner */}
      <Card className={overallColor}>
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {statusIcon(report.overall, 'h-6 w-6')}
            <div>
              <p className="font-semibold tracking-tight">{overallText}</p>
              <p className="text-xs text-muted-foreground font-mono">
                env={report.env} · runtime={report.runtime} ·{' '}
                {report.checks.length} checks ·{' '}
                <span className="text-red-600">{failCount} fail</span>
                {' · '}
                <span className="text-amber-600">{warnCount} warn</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {report.counts && (
              <div className="hidden md:flex items-center gap-3 text-xs font-mono text-muted-foreground">
                {Object.entries(report.counts).map(([k, v]) => (
                  <span key={k}>
                    {k}=<span className="text-foreground">{v}</span>
                  </span>
                ))}
              </div>
            )}
            <Button
              onClick={fetchReport}
              disabled={loading}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grouped check grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map((group) => (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm label-mono">
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-0">
              <ul className="divide-y divide-border">
                {group.checks.map((c) => {
                  const expanded = expandedId === c.id
                  const hasDetails = !!(c.remediation || c.docRef)
                  return (
                    <li key={c.id} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : c.id)
                        }
                        disabled={!hasDetails}
                        className="flex w-full items-start justify-between gap-3 text-left"
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="mt-0.5">
                            {statusIcon(c.status)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">
                              {c.label}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {c.message}
                              {typeof c.latencyMs === 'number' && (
                                <span className="ml-1 font-mono">
                                  · {c.latencyMs}ms
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {statusBadge(c.status)}
                          {hasDetails &&
                            (expanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ))}
                        </div>
                      </button>

                      {expanded && hasDetails && (
                        <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-3 space-y-2">
                          {c.remediation && (
                            <div>
                              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                                How to fix
                              </p>
                              <p className="text-xs leading-relaxed whitespace-pre-wrap">
                                {c.remediation}
                              </p>
                            </div>
                          )}
                          {c.docRef && (
                            <a
                              href={`https://github.com/search?q=${encodeURIComponent(c.docRef)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-blue)] hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span className="font-mono">{c.docRef}</span>
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {lastFetched && (
        <p className="text-[11px] text-muted-foreground text-right font-mono">
          Last fetched: {lastFetched.toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
