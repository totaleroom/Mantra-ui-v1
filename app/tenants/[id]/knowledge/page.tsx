'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/feedback/empty-state'
import {
  ArrowLeft,
  Upload,
  FileText,
  HelpCircle,
  Trash2,
  Plus,
  Save,
  Loader2,
  BookOpen,
  Hash,
} from 'lucide-react'
import { useTenant } from '@/hooks/use-tenant'
import {
  useKnowledgeStats,
  useKnowledgeChunks,
  useUploadChunks,
  useDeleteChunk,
  useFAQs,
  useCreateFAQ,
  useUpdateFAQ,
  useDeleteFAQ,
  type FAQ,
} from '@/hooks/use-knowledge'

/* --------------------------- Utilities --------------------------- */

function formatRelative(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return d.toLocaleDateString()
}

function parseCSV(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ------------------------- Main Page ------------------------- */

export default function TenantKnowledgePage() {
  const params = useParams()
  const clientId = Number(params.id)

  const { data: tenant } = useTenant(clientId)
  const { data: stats } = useKnowledgeStats(clientId)

  if (!Number.isFinite(clientId) || clientId <= 0) {
    return (
      <DashboardLayout title="Knowledge Base">
        <div className="p-6">
          <EmptyState
            icon={BookOpen}
            title="Invalid tenant"
            description="We couldn't find a tenant from this URL."
          />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={`${tenant?.name ?? 'Tenant'} · Knowledge Base`}
      description="FAQs + documents the AI can retrieve at reply-time."
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back link */}
        <Link
          href={`/tenants/${clientId}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-muted)] hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Back to tenant
        </Link>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            label="Documents"
            value={stats?.totalChunks ?? 0}
            sub="chunks embedded"
          />
          <StatTile
            label="FAQs"
            value={stats?.activeFaqs ?? 0}
            sub={`of ${stats?.totalFaqs ?? 0} total`}
          />
          <StatTile
            label="Last update"
            value={formatRelative(
              stats?.lastChunkAddedAt || stats?.lastFaqUpdatedAt
            )}
            sub=""
            isString
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList className="bg-surface border-hairline p-1 h-9">
            <TabsTrigger value="documents" className="text-[12.5px] data-[state=active]:bg-background">
              <FileText className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />
              Documents
            </TabsTrigger>
            <TabsTrigger value="faq" className="text-[12.5px] data-[state=active]:bg-background">
              <HelpCircle className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.75} />
              FAQ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <DocumentsTab clientId={clientId} />
          </TabsContent>

          <TabsContent value="faq" className="space-y-4">
            <FAQTab clientId={clientId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

/* ------------------------- Stat Tile ------------------------- */

function StatTile({
  label,
  value,
  sub,
  isString,
}: {
  label: string
  value: number | string
  sub: string
  isString?: boolean
}) {
  return (
    <div className="rounded-xl border-hairline bg-card p-4">
      <span className="label-mono">{label}</span>
      <div className="mt-2">
        {isString ? (
          <div className="text-[18px] font-medium text-foreground tracking-[-0.015em]">
            {value}
          </div>
        ) : (
          <div className="display-num text-[32px] text-foreground">{value}</div>
        )}
        {sub && <div className="text-[11px] text-[var(--fg-subtle)] mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

/* ------------------------- Documents Tab ------------------------- */

function DocumentsTab({ clientId }: { clientId: number }) {
  const { data, isLoading } = useKnowledgeChunks(clientId, { limit: 50 })
  const upload = useUploadChunks(clientId)
  const del = useDeleteChunk(clientId)

  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [category, setCategory] = useState('')

  const canSubmit = text.trim().length >= 20 && !upload.isPending

  async function handleUpload() {
    if (!canSubmit) return
    try {
      await upload.mutateAsync({
        text,
        source: source || undefined,
        category: category || undefined,
      })
      setText('')
      setSource('')
      setCategory('')
    } catch {
      /* error shown via mutation.error below */
    }
  }

  return (
    <>
      {/* Upload card */}
      <div className="rounded-xl border-hairline bg-card p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-foreground" strokeWidth={1.75} />
            <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.015em]">
              Add Knowledge
            </h3>
          </div>
          <p className="text-[12px] text-[var(--fg-muted)] mt-1">
            Paste raw text. We'll split it into chunks, embed each, and store
            them for retrieval at reply-time.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="source" className="label-mono">
                Source
              </Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. product-manual.pdf"
                className="h-9 text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category" className="label-mono">
                Category
              </Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. shipping, returns"
                className="h-9 text-[13px]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="text" className="label-mono">
              Text (min 20 chars)
            </Label>
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your knowledge base text here…"
              className="min-h-[160px] text-[13px] font-mono resize-y"
            />
            <div className="flex justify-between text-[11px] text-[var(--fg-subtle)]">
              <span>{text.length.toLocaleString()} chars</span>
              <span>{Math.ceil(text.length / 2000)} chunk(s) approx</span>
            </div>
          </div>
        </div>

        {upload.isError && (
          <div className="rounded-md border-hairline border-[color-mix(in_srgb,var(--accent-red)_30%,transparent)] bg-[var(--accent-red-muted)] px-3 py-2 text-[12px] text-[var(--accent-red)]">
            {(upload.error as Error)?.message ?? 'Upload failed.'}
          </div>
        )}
        {upload.isSuccess && (
          <div className="rounded-md border-hairline border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-3 py-2 text-[12px] text-[var(--success)]">
            Embedded {upload.data.chunksAdded} chunk(s) via {upload.data.provider}.
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={!canSubmit}
            className="h-9"
          >
            {upload.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Embedding…
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 mr-2" strokeWidth={1.75} />
                Upload & Embed
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Chunks list */}
      <div className="rounded-xl border-hairline bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="label-mono">Indexed Chunks</span>
          <span className="text-[11px] text-[var(--fg-subtle)] tabular-nums">
            {data?.total ?? 0} total
          </span>
        </div>

        {isLoading ? (
          <div className="p-6 text-[12px] text-[var(--fg-muted)] text-center">
            <span className="label-mono">Loading</span>
          </div>
        ) : !data || data.chunks.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Paste text above and click Upload to index your first knowledge chunk."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.chunks.map((chunk) => (
              <li
                key={chunk.id}
                className="px-5 py-3.5 flex gap-4 items-start hover:bg-surface/60 transition-colors duration-150"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fg-subtle)]">
                    <span className="kbd">#{chunk.id}</span>
                    {chunk.source && <span>· {chunk.source}</span>}
                    {chunk.category && <span>· {chunk.category}</span>}
                    <span>· {formatRelative(chunk.createdAt)}</span>
                    {chunk.tokenCount && (
                      <span>· ~{chunk.tokenCount} tok</span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-foreground leading-relaxed line-clamp-3">
                    {chunk.content}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm('Delete this chunk?')) del.mutate(chunk.id)
                  }}
                  className="h-7 w-7 shrink-0 text-[var(--fg-muted)] hover:text-[var(--accent-red)]"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/* ------------------------- FAQ Tab ------------------------- */

function FAQTab({ clientId }: { clientId: number }) {
  const { data, isLoading } = useFAQs(clientId, true)
  const create = useCreateFAQ(clientId)

  const [showForm, setShowForm] = useState(false)

  return (
    <>
      {/* Header / New button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground tracking-[-0.015em]">
            Frequently Asked Questions
          </h3>
          <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
            Human-authored Q&A, matched first before vector retrieval.
          </p>
        </div>
        <Button
          onClick={() => setShowForm((s) => !s)}
          size="sm"
          className="h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
          New FAQ
        </Button>
      </div>

      {/* New form */}
      {showForm && (
        <FAQForm
          onSubmit={async (input) => {
            await create.mutateAsync(input)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
          isPending={create.isPending}
          error={create.error as Error | null}
        />
      )}

      {/* List */}
      <div className="rounded-xl border-hairline bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-[12px] text-[var(--fg-muted)] text-center">
            <span className="label-mono">Loading</span>
          </div>
        ) : !data || data.faqs.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title="No FAQs yet"
            description="Click 'New FAQ' above to add your first question & answer pair."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-border">
            {data.faqs.map((faq) => (
              <FAQRow key={faq.id} faq={faq} clientId={clientId} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function FAQRow({ faq, clientId }: { faq: FAQ; clientId: number }) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateFAQ(clientId)
  const del = useDeleteFAQ(clientId)

  if (editing) {
    return (
      <li className="p-5 bg-surface/40">
        <FAQForm
          initial={faq}
          onSubmit={async (input) => {
            await update.mutateAsync({ faqId: faq.id, ...input })
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
          isPending={update.isPending}
          error={update.error as Error | null}
        />
      </li>
    )
  }

  return (
    <li className="px-5 py-4 hover:bg-surface/40 transition-colors duration-150">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="kbd">#{faq.id}</span>
            {!faq.isActive && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)] border-hairline px-1.5 py-0.5 rounded">
                Inactive
              </span>
            )}
            {faq.priority > 0 && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--accent-red)] border-hairline border-[color-mix(in_srgb,var(--accent-red)_30%,transparent)] px-1.5 py-0.5 rounded">
                Priority {faq.priority}
              </span>
            )}
          </div>
          <div>
            <div className="text-[13px] font-medium text-foreground">
              {faq.question}
            </div>
            <div className="text-[13px] text-[var(--fg-muted)] mt-1 whitespace-pre-wrap">
              {faq.answer}
            </div>
          </div>
          {(faq.tags.length > 0 || faq.triggerKeywords.length > 0) && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {faq.tags.map((t) => (
                <span
                  key={`t-${t}`}
                  className="inline-flex items-center gap-1 text-[var(--fg-muted)] border-hairline px-1.5 py-0.5 rounded"
                >
                  <Hash className="w-2.5 h-2.5" strokeWidth={2} />
                  {t}
                </span>
              ))}
              {faq.triggerKeywords.map((k) => (
                <span
                  key={`k-${k}`}
                  className="text-[var(--accent-blue)] border-hairline border-[color-mix(in_srgb,var(--accent-blue)_30%,transparent)] px-1.5 py-0.5 rounded font-mono"
                >
                  {k}
                </span>
              ))}
            </div>
          )}
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
              if (confirm('Delete this FAQ?')) del.mutate(faq.id)
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

function FAQForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  initial?: FAQ
  onSubmit: (input: {
    question: string
    answer: string
    tags: string[]
    triggerKeywords: string[]
    priority: number
    isActive: boolean
  }) => Promise<void>
  onCancel: () => void
  isPending: boolean
  error: Error | null
}) {
  const [question, setQuestion] = useState(initial?.question ?? '')
  const [answer, setAnswer] = useState(initial?.answer ?? '')
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [keywords, setKeywords] = useState(
    initial?.triggerKeywords.join(', ') ?? ''
  )
  const [priority, setPriority] = useState(initial?.priority ?? 0)
  const [isActive, setIsActive] = useState(initial?.isActive ?? true)

  const canSubmit = question.trim().length > 0 && answer.trim().length > 0 && !isPending

  return (
    <div className="rounded-xl border-hairline bg-card p-5 space-y-4">
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label className="label-mono">Question</Label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How long is shipping?"
            className="h-9 text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="label-mono">Answer</Label>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="The answer the AI will use verbatim or adapt."
            className="min-h-[96px] text-[13px]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="label-mono">Tags (comma-separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="shipping, returns"
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-mono">Trigger keywords</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="kirim, ongkir, berapa lama"
              className="h-9 text-[13px] font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="label-mono">Priority (higher = shown first)</Label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
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
                {isActive ? 'FAQ is live' : 'Hidden from AI'}
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
          onClick={() =>
            onSubmit({
              question: question.trim(),
              answer: answer.trim(),
              tags: parseCSV(tags),
              triggerKeywords: parseCSV(keywords),
              priority,
              isActive,
            })
          }
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
