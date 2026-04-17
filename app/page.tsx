'use client'

import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatusCard } from '@/components/dashboard/status-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Users,
  MessageSquare,
  Brain,
  Activity,
  Zap,
  ArrowUpRight,
  Circle,
} from 'lucide-react'
import { useTenants } from '@/hooks/use-tenant'
import { useWhatsAppInstances } from '@/hooks/use-whatsapp'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function OverviewPage() {
  const { data: clients = [] } = useTenants()
  const { data: instances = [] } = useWhatsAppInstances()
  const [totalMessages, setTotalMessages] = useState(0)
  const [healthyServices, setHealthyServices] = useState(0)

  const activeClients = clients.filter((c) => c.isActive).length
  const connectedInstances = instances.filter((i) => i.status === 'CONNECTED').length

  useEffect(() => {
    setTotalMessages(0)
    setHealthyServices(0)
  }, [])

  return (
    <DashboardLayout
      title="Command Center"
      description="Multi-tenant AI WhatsApp automation overview"
    >
      <div className="space-y-6">
        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            title="Active Tenants"
            value={activeClients}
            description="of 50 total"
            icon={Users}
            status="success"
            trend={{ value: 12, isPositive: true }}
          />
          <StatusCard
            title="WhatsApp Instances"
            value={`${connectedInstances}/${instances.length}`}
            description="connected"
            icon={MessageSquare}
            status={connectedInstances === mockWhatsAppInstances.length ? 'success' : 'warning'}
          />
          <StatusCard
            title="Messages Today"
            value={totalMessages}
            description="across all tenants"
            icon={Zap}
            status="info"
          />
          <StatusCard
            title="System Health"
            value={`${healthyServices}/0`}
            description="services healthy"
            icon={Activity}
            status="warning"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Messages */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Live Message Feed</CardTitle>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Circle className="w-2 h-2 mr-1 fill-primary animate-pulse" />
                Live
              </Badge>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No live messages available yet.
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold">System Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                System health metrics will appear here once the monitoring API is connected.
              </div>

              {/* Quick Actions */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/ai-hub"
                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm"
                  >
                    <Brain className="w-4 h-4 text-primary" />
                    <span>AI Hub</span>
                    <ArrowUpRight className="w-3 h-3 ml-auto text-muted-foreground" />
                  </Link>
                  <Link
                    href="/whatsapp"
                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm"
                  >
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>WhatsApp</span>
                    <ArrowUpRight className="w-3 h-3 ml-auto text-muted-foreground" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenant Overview */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Tenant Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {clients.map((client) => {
                const clientInstances = instances.filter(
                  (i) => i.clientId === client.id
                )
                const connectedCount = clientInstances.filter(
                  (i) => i.status === 'CONNECTED'
                ).length

                return (
                  <Link
                    key={client.id}
                    href={`/tenants/${client.id}`}
                    className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer block"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{client.name}</span>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          client.isActive ? 'bg-success' : 'bg-error'
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tokens</span>
                        <span className="font-mono">
                          {(client.tokenBalance / 1000).toFixed(1)}k / {(client.tokenLimit / 1000).toFixed(0)}k
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${(client.tokenBalance / client.tokenLimit) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Instances</span>
                        <span>
                          {connectedCount}/{instances.length}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
