'use client'

import { useState, useMemo } from 'react'
import { Send, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  useSendWhatsAppMessage,
  useWhatsAppInstances,
} from '@/hooks/use-whatsapp'

interface ReplyComposerProps {
  clientId: number
  customerNumber: string
  customerLabel?: string
}

/**
 * Manual reply composer shown in the Inbox when a message is selected.
 * Picks the first CONNECTED instance belonging to the message's client
 * to dispatch the reply. If no connected instance exists, surfaces a
 * clear error rather than attempting to send.
 */
export function ReplyComposer({
  clientId,
  customerNumber,
  customerLabel,
}: ReplyComposerProps) {
  const [text, setText] = useState('')
  const { data: instances = [] } = useWhatsAppInstances()
  const send = useSendWhatsAppMessage()

  const instance = useMemo(() => {
    const forClient = instances.filter((i) => i.clientId === clientId)
    const connected = forClient.find((i) => i.status === 'CONNECTED')
    return connected ?? forClient[0] ?? null
  }, [instances, clientId])

  const disabled =
    !instance ||
    instance.status !== 'CONNECTED' ||
    text.trim().length === 0 ||
    send.isPending

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || !instance) return
    try {
      await send.mutateAsync({
        instanceId: instance.id,
        to: customerNumber,
        text: text.trim(),
      })
      toast.success('Reply sent')
      setText('')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send reply'
      )
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="py-3 border-b border-border">
        <CardTitle className="text-sm flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          Manual Reply
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            <span className="text-foreground">To:</span>{' '}
            <span className="font-mono">
              {customerLabel ?? customerNumber}
            </span>
          </div>
          <div>
            <span className="text-foreground">Via:</span>{' '}
            {instance ? (
              <span>
                <span className="font-mono">{instance.instanceName}</span>
                {instance.status !== 'CONNECTED' && (
                  <span className="text-warning ml-1">
                    ({instance.status.toLowerCase()})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-destructive">
                no instance for this client
              </span>
            )}
          </div>
        </div>

        {instance && instance.status !== 'CONNECTED' && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-xs text-warning">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Instance is {instance.status.toLowerCase()}. Reconnect it
              from the WhatsApp page before sending.
            </span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a reply…"
            rows={3}
            maxLength={4000}
            className="bg-secondary border-border text-sm resize-none"
            disabled={!instance || instance.status !== 'CONNECTED'}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono">
              {text.length} / 4000
            </span>
            <Button type="submit" size="sm" disabled={disabled}>
              {send.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Send
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
