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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
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
  Brain,
  X,
} from 'lucide-react'
import { useRealtimeInbox, useInboxStats, useClients } from '@/hooks/use-inbox'
import { ReplyComposer } from '@/components/inbox/reply-composer'
import type { InboxMessage } from '@/lib/types'

export default function InboxPage() {
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null)
  const [mobileThoughtOpen, setMobileThoughtOpen] = useState(false)

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

  const handleMessageClick = (message: InboxMessage) => {
    setSelectedMessage(message)
    if (message.aiThoughtProcess) {
      setMobileThoughtOpen(true)
    }
  }

  return (
    <DashboardLayout
      title="Omniscient Inbox"
      description="Live message feed from all clients"
    >
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-auto lg:h-[calc(100vh-10rem)]">
        {/* Main Inbox */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Stats Bar - Responsive Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Total</p>
                    <p className="text-lg md:text-xl font-bold">{stats?.total ?? messages.length}</p>
                  </div>
                  <InboxIcon className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Inbound</p>
                    <p className="text-lg md:text-xl font-bold text-info">
                      {stats?.inbound ?? messages.filter((m) => m.direction === 'inbound').length}
                    </p>
                  </div>
                  <ArrowDownUp className="w-4 h-4 md:w-5 md:h-5 text-info" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Outbound</p>
                    <p className="text-lg md:text-xl font-bold text-primary">
                      {stats?.outbound ?? messages.filter((m) => m.direction === 'outbound').length}
                    </p>
                  </div>
                  <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3 md:pt-4 md:pb-4 px-3 md:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">AI</p>
                    <p className="text-lg md:text-xl font-bold text-accent">
                      {stats?.aiProcessed ?? messages.filter((m) => m.aiThoughtProcess).length}
                    </p>
                  </div>
                  <Bot className="w-4 h-4 md:w-5 md:h-5 text-accent" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters - Responsive */}
          <Card className="bg-card border-border mb-3 md:mb-4">
            <CardContent className="py-3 md:py-4">
              <div className="flex flex-col gap-2 md:gap-3">
                {/* Search - Full width on mobile */}
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search messages..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-secondary border-border text-sm"
                  />
                </div>
                
                {/* Filter row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="w-[140px] md:w-[180px] bg-secondary border-border text-xs md:text-sm h-9">
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
                    <SelectTrigger className="w-[100px] md:w-[140px] bg-secondary border-border text-xs md:text-sm h-9">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Live Status Indicator */}
                  <div className="ml-auto">
                    {isLive ? (
                      <Badge variant="outline" className="bg-success/10 border-success text-success flex items-center gap-1.5 px-2 py-1 text-xs">
                        <Circle className="w-1.5 h-1.5 fill-success animate-pulse" />
                        Live
                      </Badge>
                    ) : connectionError ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={reconnect}
                        className="border-error text-error hover:bg-error/10 h-7 text-xs px-2"
                      >
                        <WifiOff className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground flex items-center gap-1.5 px-2 py-1 text-xs">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        ...
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Messages List */}
          <Card className="bg-card border-border flex-1 overflow-hidden min-h-[400px] lg:min-h-0">
            <CardHeader className="py-2 md:py-3 border-b border-border px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm flex items-center justify-between">
                <span>Messages</span>
                <Badge variant="outline" className="bg-secondary text-xs">
                  {filteredMessages.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(100%-3rem)]">
              <div className="p-2 md:p-4 space-y-2">
                {isLoading ? (
                  // Loading skeletons
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-3 md:p-4 rounded-lg bg-secondary/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 md:h-4 w-24 md:w-32" />
                        <Skeleton className="h-2 md:h-3 w-16 md:w-20" />
                      </div>
                      <Skeleton className="h-3 md:h-4 w-full" />
                      <Skeleton className="h-3 md:h-4 w-3/4" />
                    </div>
                  ))
                ) : filteredMessages.length > 0 ? (
                  filteredMessages.map((message) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      isSelected={selectedMessage?.id === message.id}
                      onClick={() => handleMessageClick(message)}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 md:py-12 text-muted-foreground">
                    <InboxIcon className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 opacity-50" />
                    <p className="text-sm md:text-base">No messages found</p>
                    {(search || clientFilter !== 'all' || directionFilter !== 'all') && (
                      <p className="text-xs md:text-sm mt-2">Try adjusting your filters</p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Desktop side panel: thought process + reply composer */}
        <div className="hidden lg:flex lg:flex-col lg:gap-4 w-80 shrink-0">
          <ThoughtProcessPanel message={selectedMessage} />
          {selectedMessage && (
            <ReplyComposer
              clientId={selectedMessage.clientId}
              customerNumber={selectedMessage.customerNumber}
              customerLabel={selectedMessage.customerNumber}
            />
          )}
        </div>

        {/* Mobile Thought Process Sheet */}
        <Sheet open={mobileThoughtOpen} onOpenChange={setMobileThoughtOpen}>
          <SheetContent side="bottom" className="h-[70vh] bg-card border-border rounded-t-xl">
            <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Brain className="w-4 h-4 text-accent" />
                AI Thought Process
              </SheetTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setMobileThoughtOpen(false)}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-4rem)] mt-4">
              {selectedMessage?.aiThoughtProcess ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-xs text-muted-foreground mb-1">Original Message</p>
                    <p className="text-sm">{selectedMessage.message}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <p className="text-xs text-accent mb-2">AI Reasoning</p>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                      {selectedMessage.aiThoughtProcess}
                    </pre>
                  </div>
                  {selectedMessage.modelUsed && (
                    <Badge variant="outline" className="bg-secondary">
                      Model: {selectedMessage.modelUsed}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No thought process available</p>
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  )
}
