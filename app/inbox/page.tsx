'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { MessageCard } from '@/components/inbox/message-card'
import { ThoughtProcessPanel } from '@/components/inbox/thought-process-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Filter,
  Circle,
  ArrowDownUp,
  Inbox as InboxIcon,
  MessageSquare,
  Bot,
} from 'lucide-react'
import { mockInboxMessages, mockClients } from '@/lib/mock-data'
import type { InboxMessage } from '@/lib/types'

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>(mockInboxMessages)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null)
  const [isLive, setIsLive] = useState(true)

  // Simulate live updates
  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      const randomClient = mockClients[Math.floor(Math.random() * mockClients.length)]
      const randomMessages = [
        'Hi, I need help with my account',
        'When will my order arrive?',
        'Can you tell me more about your services?',
        'I have a question about pricing',
        'Thanks for your help!',
      ]
      const randomNumber = `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`

      const newMessage: InboxMessage = {
        id: `live-${Date.now()}`,
        clientId: randomClient.id,
        clientName: randomClient.name,
        customerNumber: randomNumber,
        message: randomMessages[Math.floor(Math.random() * randomMessages.length)],
        direction: 'inbound',
        timestamp: new Date(),
        aiThoughtProcess: 'Analyzing customer intent... Detected inquiry type. Preparing contextual response.',
        modelUsed: 'gpt-4-turbo',
      }

      setMessages((prev) => [newMessage, ...prev.slice(0, 49)])
    }, 8000)

    return () => clearInterval(interval)
  }, [isLive])

  const filteredMessages = messages.filter((message) => {
    const matchesSearch =
      message.message.toLowerCase().includes(search.toLowerCase()) ||
      message.customerNumber.includes(search) ||
      message.clientName.toLowerCase().includes(search.toLowerCase())
    const matchesClient =
      clientFilter === 'all' || message.clientId.toString() === clientFilter
    const matchesDirection =
      directionFilter === 'all' || message.direction === directionFilter
    return matchesSearch && matchesClient && matchesDirection
  })

  const inboundCount = messages.filter((m) => m.direction === 'inbound').length
  const outboundCount = messages.filter((m) => m.direction === 'outbound').length
  const withAiCount = messages.filter((m) => m.aiThoughtProcess).length

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
                    <p className="text-xl font-bold">{messages.length}</p>
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
                    <p className="text-xl font-bold text-info">{inboundCount}</p>
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
                    <p className="text-xl font-bold text-primary">{outboundCount}</p>
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
                    <p className="text-xl font-bold text-accent">{withAiCount}</p>
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
                    {mockClients.map((client) => (
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
                <Button
                  variant={isLive ? 'default' : 'outline'}
                  onClick={() => setIsLive(!isLive)}
                  className={isLive ? 'bg-primary text-primary-foreground' : ''}
                >
                  <Circle
                    className={`w-2 h-2 mr-2 ${isLive ? 'fill-primary-foreground animate-pulse' : ''}`}
                  />
                  {isLive ? 'Live' : 'Paused'}
                </Button>
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
                {filteredMessages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    isSelected={selectedMessage?.id === message.id}
                    onClick={() => setSelectedMessage(message)}
                  />
                ))}
                {filteredMessages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <InboxIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No messages found</p>
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
