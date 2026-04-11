'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Brain, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import type { InboxMessage } from '@/lib/types'

interface MessageCardProps {
  message: InboxMessage
  isSelected: boolean
  onClick: () => void
}

export function MessageCard({ message, isSelected, onClick }: MessageCardProps) {
  const isInbound = message.direction === 'inbound'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-all',
        isSelected
          ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
          : 'bg-secondary/50 border-border hover:bg-secondary hover:border-border/80'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Direction indicator */}
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
            isInbound ? 'bg-info/10' : 'bg-primary/10'
          )}
        >
          {isInbound ? (
            <ArrowDownLeft className="w-4 h-4 text-info" />
          ) : (
            <ArrowUpRight className="w-4 h-4 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm text-foreground">
              {message.clientName}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {message.customerNumber}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                isInbound
                  ? 'bg-info/10 text-info border-info/20'
                  : 'bg-primary/10 text-primary border-primary/20'
              )}
            >
              {message.direction}
            </Badge>
          </div>

          {/* Message content */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {message.message}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-2 flex-wrap">
            {message.aiThoughtProcess && (
              <Badge
                variant="outline"
                className="text-xs bg-accent/10 text-accent border-accent/20 cursor-pointer hover:bg-accent/20"
              >
                <Brain className="w-3 h-3 mr-1" />
                Thought Process
              </Badge>
            )}
            {message.modelUsed && (
              <Badge variant="outline" className="text-xs bg-secondary border-border">
                {message.modelUsed}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
