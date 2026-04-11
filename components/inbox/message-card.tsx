'use client'

import { cn } from '@/lib/utils'
import { sanitizeMessage, sanitizePhoneNumber } from '@/lib/sanitize'
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
  
  // Sanitize all dynamic content
  const safeClientName = sanitizeMessage(message.clientName)
  const safeCustomerNumber = sanitizePhoneNumber(message.customerNumber)
  const safeMessageContent = sanitizeMessage(message.message)
  const safeModelUsed = sanitizeMessage(message.modelUsed)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 md:p-4 rounded-lg border transition-all',
        isSelected
          ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
          : 'bg-secondary/50 border-border hover:bg-secondary hover:border-border/80'
      )}
    >
      <div className="flex items-start gap-2 md:gap-3">
        {/* Direction indicator */}
        <div
          className={cn(
            'flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-lg shrink-0',
            isInbound ? 'bg-info/10' : 'bg-primary/10'
          )}
        >
          {isInbound ? (
            <ArrowDownLeft className="w-3.5 h-3.5 md:w-4 md:h-4 text-info" />
          ) : (
            <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
            <span className="font-medium text-xs md:text-sm text-foreground truncate max-w-[120px] md:max-w-none">
              {safeClientName}
            </span>
            <span className="text-[10px] md:text-xs text-muted-foreground font-mono hidden sm:inline">
              {safeCustomerNumber}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] md:text-xs px-1.5 py-0',
                isInbound
                  ? 'bg-info/10 text-info border-info/20'
                  : 'bg-primary/10 text-primary border-primary/20'
              )}
            >
              {message.direction}
            </Badge>
          </div>

          {/* Message content - sanitized */}
          <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-2">
            {safeMessageContent}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            {message.aiThoughtProcess && (
              <Badge
                variant="outline"
                className="text-[10px] md:text-xs bg-accent/10 text-accent border-accent/20 cursor-pointer hover:bg-accent/20 px-1.5 py-0"
              >
                <Brain className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1" />
                <span className="hidden sm:inline">Thought Process</span>
                <span className="sm:hidden">AI</span>
              </Badge>
            )}
            {safeModelUsed && (
              <Badge variant="outline" className="text-[10px] md:text-xs bg-secondary border-border px-1.5 py-0 hidden sm:flex">
                {safeModelUsed}
              </Badge>
            )}
            <span className="text-[10px] md:text-xs text-muted-foreground ml-auto">
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
  const messageDate = date instanceof Date ? date : new Date(date)
  const diff = now.getTime() - messageDate.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return messageDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
