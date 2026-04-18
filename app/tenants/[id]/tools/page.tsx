'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/feedback/empty-state'
import {
  ArrowLeft,
  Plus,
  Save,
  Wrench,
  Loader2,
  Globe,
  Cpu,
} from 'lucide-react'
import { useTenant } from '@/hooks/use-tenant'
import {
  useTools,
  useCreateTool,
  useUpdateTool,
  useDeleteTool,
  type ClientTool,
  type ToolInput,
} from '@/hooks/use-tools'

/* -------------------- helpers -------------------- */

const BUILTIN_TOOLS = [
  {
    value: 'lookup_memory',
    label: 'lookup_memory',
    description:
      'Returns the CustomerMemory record for the current customer. Safe, read-only, no args.',
    schema: { type: 'object', properties: {}, required: [] },
  },
] as const

const WEBHOOK_SAMPLE_SCHEMA = `{
  "type": "object",
  "properties": {
    "orderId": {
      "type": "string",
      "description": "The customer's order ID (e.g. ORD-12345)"
    }
  },
  "required": ["orderId"]
}`

function tryParseJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/* -------------------- page -------------------- */

export default function TenantToolsPage() {
  const params = useParams()
  const clientId = Number(params.id)
  const { data: tenant } = useTenant(clientId)
  const { data, isLoading } = useTools(clientId)
  const createTool = useCreateTool(clientId)
  const [showForm, setShowForm] = useState(false)

  if (!Number.isFinite(clientId) || clientId <= 0) {
    return (
      <DashboardLayout title="Tools">
        <EmptyState
          icon={Wrench}
          title="Invalid tenant"
          description="We couldn't find a tenant from this URL."
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={`${tenant?.name ?? 'Tenant'} · Tools`}
      description="Per-tenant functions the AI can call during a conversation."
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href={`/tenants/${clientId}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)] hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Back to tenant
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.015em]">
              Registered Tools
            </h3>
            <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
              The AI sees each active tool's name + description and decides when
              to call. Webhook tools POST to your URL with customer + args.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowForm((s) => !s)}
            className="h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
            New Tool
          </Button>
        </div>

        {showForm && (
          <ToolForm
            onSubmit={async (input) => {
              await createTool.mutateAsync(input)
              setShowForm(false)
            }}
            onCancel={() => setShowForm(false)}
            isPending={createTool.isPending}
            error={createTool.error as Error | null}
          />
        )}

        <div className="rounded-xl border-hairline bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-[12px] text-[var(--fg-muted)] text-center">
              <span className="label-mono">Loading</span>
            </div>
          ) : !data || data.tools.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No tools configured"
              description="Add your first tool so the AI can fetch data from your systems during a chat."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.tools.map((tool) => (
                <ToolRow key={tool.id} tool={tool} clientId={clientId} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

/* -------------------- row -------------------- */

function ToolRow({ tool, clientId }: { tool: ClientTool; clientId: number }) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateTool(clientId)
  const del = useDeleteTool(clientId)

  if (editing) {
    return (
      <li className="p-5 bg-surface/40">
        <ToolForm
          initial={tool}
          onSubmit={async (input) => {
            await update.mutateAsync({ toolId: tool.id, ...input })
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
          isPending={update.isPending}
          error={update.error as Error | null}
        />
      </li>
    )
  }

  const isBuiltin = tool.handlerType === 'builtin'
  const url = (tool.handlerConfig?.url as string) || ''
  const builtinName = (tool.handlerConfig?.name as string) || ''

  return (
    <li className="px-5 py-4 hover:bg-surface/40 transition-colors duration-150">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="kbd">#{tool.id}</span>
            <span className="font-mono text-[13px] text-foreground font-medium">
              {tool.name}
            </span>
            {!tool.isActive && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)] border-hairline px-1.5 py-0.5 rounded">
                Inactive
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider border-hairline px-1.5 py-0.5 rounded ${
                isBuiltin
                  ? 'text-[var(--accent-blue)] border-[color-mix(in_srgb,var(--accent-blue)_30%,transparent)]'
                  : 'text-[var(--fg-muted)]'
              }`}
            >
              {isBuiltin ? (
                <>
                  <Cpu className="w-2.5 h-2.5" strokeWidth={2} />
                  builtin
                </>
              ) : (
                <>
                  <Globe className="w-2.5 h-2.5" strokeWidth={2} />
                  webhook
                </>
              )}
            </span>
            <span className="text-[11px] text-[var(--fg-subtle)] tabular-nums">
              {tool.timeoutMs} ms
            </span>
          </div>
          <div className="text-[12.5px] text-foreground">{tool.description}</div>
          <div className="text-[11px] text-[var(--fg-subtle)] font-mono break-all">
            {isBuiltin ? `→ ${builtinName}` : `→ ${url}`}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="h-7 px-2 text-[11px]"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(`Delete tool "${tool.name}"?`)) del.mutate(tool.id)
            }}
            className="h-7 px-2 text-[11px] text-[var(--fg-muted)] hover:text-[var(--accent-red)]"
          >
            Delete
          </Button>
        </div>
      </div>
    </li>
  )
}

/* -------------------- form -------------------- */

function ToolForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  initial?: ClientTool
  onSubmit: (input: ToolInput) => Promise<void>
  onCancel: () => void
  isPending: boolean
  error: Error | null
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [handlerType, setHandlerType] = useState<'builtin' | 'webhook'>(
    initial?.handlerType ?? 'webhook'
  )
  const [builtinName, setBuiltinName] = useState(
    (initial?.handlerConfig?.name as string) ?? 'lookup_memory'
  )
  const [webhookUrl, setWebhookUrl] = useState(
    (initial?.handlerConfig?.url as string) ?? ''
  )
  const [webhookSecret, setWebhookSecret] = useState(
    (initial?.handlerConfig?.secret as string) ?? ''
  )
  const [schemaText, setSchemaText] = useState(
    initial ? JSON.stringify(initial.parametersSchema, null, 2) : WEBHOOK_SAMPLE_SCHEMA
  )
  const [timeoutMs, setTimeoutMs] = useState(initial?.timeoutMs ?? 8000)
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const canSubmit = Boolean(
    name.trim() &&
      description.trim() &&
      (handlerType === 'builtin' ? builtinName : webhookUrl) &&
      !isPending
  )

  async function handleSave() {
    const parsed = tryParseJSON<Record<string, unknown>>(schemaText)
    if (!parsed) {
      setSchemaError('Parameters schema is not valid JSON.')
      return
    }
    setSchemaError(null)

    const handlerConfig: Record<string, unknown> =
      handlerType === 'builtin'
        ? { name: builtinName }
        : { url: webhookUrl, ...(webhookSecret ? { secret: webhookSecret } : {}) }

    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      parametersSchema: parsed,
      handlerType,
      handlerConfig,
      isActive,
      timeoutMs,
    })
  }

  return (
    <div className="rounded-xl border-hairline bg-card p-5 space-y-4">
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="label-mono">Name (snake_case)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. lookup_order_status"
              className="h-9 text-[13px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-mono">Handler type</Label>
            <Select
              value={handlerType}
              onValueChange={(v) => setHandlerType(v as 'builtin' | 'webhook')}
            >
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">Webhook (your URL)</SelectItem>
                <SelectItem value="builtin">Builtin (Go handler)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="label-mono">Description (LLM reads this)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Plain English description of what this tool does, when to call it, and what it returns."
            className="min-h-[72px] text-[13px]"
          />
        </div>

        {handlerType === 'builtin' ? (
          <div className="space-y-1.5">
            <Label className="label-mono">Builtin handler</Label>
            <Select value={builtinName} onValueChange={setBuiltinName}>
              <SelectTrigger className="h-9 text-[13px] font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUILTIN_TOOLS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="font-mono">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-[var(--fg-subtle)]">
              {BUILTIN_TOOLS.find((t) => t.value === builtinName)?.description}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="label-mono">Webhook URL</Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-api.example.com/mantra/tool"
                className="h-9 text-[13px] font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-mono">
                Shared secret (optional, sent as X-Mantra-Secret)
              </Label>
              <Input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="leave blank for public endpoint"
                className="h-9 text-[13px] font-mono"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="label-mono">
            Parameters schema (JSON Schema, OpenAI function-calling)
          </Label>
          <Textarea
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            className="min-h-[140px] text-[12px] font-mono resize-y"
          />
          {schemaError && (
            <div className="text-[11px] text-[var(--accent-red)]">{schemaError}</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="label-mono">Timeout (ms, 1000–30000)</Label>
            <Input
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value) || 8000)}
              min={1000}
              max={30000}
              step={500}
              className="h-9 text-[13px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-mono">Active</Label>
            <div className="flex items-center h-9 gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent-blue)]"
              />
              <span className="text-[13px] text-[var(--fg-muted)]">
                {isActive ? 'AI can call this tool' : 'Hidden from AI'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border-hairline border-[color-mix(in_srgb,var(--accent-red)_30%,transparent)] bg-[var(--accent-red-muted)] px-3 py-2 text-[12px] text-[var(--accent-red)]">
          {error.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSubmit}
          className="h-8"
        >
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
