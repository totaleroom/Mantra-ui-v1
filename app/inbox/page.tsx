'use client'

import { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { MessageCard } from '@/components/inbox/message-card'
import { ThoughtProcessPanel } from '@/components/inbox/thought-process-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Circle,
  ArrowDownUp,
  Inbox as InboxIcon,
  MessageSquare,
  Bot,
  WifiOff,
  RefreshCw,
} from 'lucide-react'
import { useRealtimeInbox, useInboxStats, useClients } from '@/hooks/use-inbox'
import type { InboxMessage } from '@/lib/types'

export default function InboxPage() {
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null)

  // Build filters object
  const filters = useMemo(
    () => ({
      clientId: clientFilter !== 'all' ? parseInt(clientFilter, 10) : undefined,
      direction: directionFilter !== 'all' ? (directionFilter as 'inbound' | 'outbound') : undefined,
      search: search || undefined,
    }),
    [clientFilter, directionFilter, search]
  )

  // Fetch data with real-time updates
  const { messages, isLoading, isLive, connectionError, reconnect } = useRealtimeInbox(filters)
  const { data: stats } = useInboxStats()
  const { data: clients } = useClients()

  // Filter messages client-side for immediate feedback
  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      const matchesSearch =
        !search ||
        message.message.toLowerCase().includes(search.toLowerCase()) ||
        message.customerNumber.includes(search) ||
        message.clientName.toLowerCase().includes(search.toLowerCase())
      const matchesClient =
        clientFilter === 'all' || message.clientId.toString() === clientFilter
      const matchesDirection =
        directionFilter === 'all' || message.direction === directionFilter
      return matchesSearch && matchesClient && matchesDirection
    })
  }, [messages, search, clientFilter, directionFilter])

  return (
    <DashboardLayout
      title="Omniscient Inbox"
      description="Live message feed from all clients"
    >
      <div className="flex gap-6 h-[calc(100vh-10rem)]">
        {/* Main Inbox */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Stats Bar */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{stats?.total ?? messages.length}</p>
                  </div>
                  <InboxIcon className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Inbound</p>
                    <p className="text-xl font-bold text-info">
                      {stats?.inbound ?? messages.filter((m) => m.direction === 'inbound').length}
                    </p>
                  </div>
                  <ArrowDownUp className="w-5 h-5 text-info" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Outbound</p>
                    <p className="text-xl font-bold text-primary">
                      {stats?.outbound ?? messages.filter((m) => m.direction === 'outbound').length}
                    </p>
                  </div>
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">AI Processed</p>
                    <p className="text-xl font-bold text-accent">
                      {stats?.aiProcessed ?? messages.filter((m) => m.aiThoughtProcess).length}
                    </p>
                  </div>
                  <Bot className="w-5 h-5 text-accent" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-card border-border mb-4">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search messages, numbers, or clients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-secondary border-border"
                  />
                </div>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-[180px] bg-secondary border-border">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={directionFilter} onValueChange={setDirectionFilter}>
                  <SelectTrigger className="w-[140px] bg-secondary border-border">
                    <SelectValue placeholder="Direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Live Status Indicator */}
                {isLive ? (
                  <Badge variant="outline" className="bg-success/10 border-success text-success flex items-center gap-2 px-3">
                    <Circle className="w-2 h-2 fill-success animate-pulse" />
                    Live
                  </Badge>
                ) : connectionError ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reconnect}
                    className="border-error text-error hover:bg-error/10"
                  >
                    <WifiOff className="w-4 h-4 mr-2" />
                    Reconnect
                  </Button>
                ) : (
                  <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-2 px-3">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Connecting...
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Messages List */}
          <Card className="bg-card border-border flex-1 overflow-hidden">
            <CardHeader className="py-3 border-b border-border">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Messages</span>
                <Badge variant="outline" className="bg-secondary">
                  {filteredMessages.length} messages
                </Badge>
              </CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(100%-3.5rem)]">
              <div className="p-4 space-y-2">
                {isLoading ? (
                  // Loading skeletons
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg bg-secondary/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))
                ) : filteredMessages.length > 0 ? (
                  filteredMessages.map((message) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      isSelected={selectedMessage?.id === message.id}
                      onClick={() => setSelectedMessage(message)}
                    />
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <InboxIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No messages found</p>
                    {(search || clientFilter !== 'all' || directionFilter !== 'all') && (
                      <p className="text-sm mt-2">Try adjusting your filters</p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Thought Process Panel */}
        <ThoughtProcessPanel message={selectedMessage} />
      </div>
    </DashboardLayout>
  )
}
