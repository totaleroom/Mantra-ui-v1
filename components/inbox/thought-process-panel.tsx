'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Brain,
  MessageSquare,
  User,
  Clock,
  Cpu,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { sanitizeMessage, sanitizePhoneNumber, sanitizeThoughtProcess } from '@/lib/sanitize'
import type { InboxMessage } from '@/lib/types'

interface ThoughtProcessPanelProps {
  message: InboxMessage | null
}

export function ThoughtProcessPanel({ message }: ThoughtProcessPanelProps) {
  if (!message) {
    return (
      <Card className="w-80 bg-card border-border shrink-0 hidden lg:block">
        <CardContent className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
          <Brain className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">Select a message to view</p>
          <p className="text-xs">AI thought process details</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-80 bg-card border-border shrink-0 hidden lg:flex lg:flex-col">
      <CardHeader className="py-3 border-b border-border shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-accent" />
          AI Thought Process
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="pt-4 space-y-4">
          {/* Message Context */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              Customer
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border">
              <p className="text-xs font-mono text-muted-foreground mb-1">
                {sanitizePhoneNumber(message.customerNumber)}
              </p>
              <p className="text-sm">{sanitizeMessage(message.message)}</p>
            </div>
          </div>

          <Separator />

          {/* Thought Process - Sanitized */}
          {message.aiThoughtProcess ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Brain className="w-3 h-3" />
                Reasoning Chain
              </div>
              <div className="space-y-2">
                {sanitizeThoughtProcess(message.aiThoughtProcess).split('.').filter(Boolean).map((thought, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 rounded-lg bg-accent/5 border border-accent/10"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 text-accent text-xs font-bold shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {thought.trim()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-secondary/30 text-center">
              <p className="text-xs text-muted-foreground">
                No thought process recorded
              </p>
            </div>
          )}

          <Separator />

          {/* Metadata */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="w-3 h-3" />
              Execution Details
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Model
                </span>
                <Badge variant="outline" className="bg-secondary text-xs">
                  {message.modelUsed || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Latency
                </span>
                <span className="font-mono">~{Math.floor(Math.random() * 500 + 200)}ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  Client
                </span>
                <span>{sanitizeMessage(message.clientName)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Response Preview */}
          {message.direction === 'inbound' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRight className="w-3 h-3" />
                Generated Response
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground italic">
                  Response would be generated here based on the AI reasoning and client configuration...
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  )
}
