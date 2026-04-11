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
import {
  mockClients,
  mockWhatsAppInstances,
  mockInboxMessages,
  mockSystemDiagnosis,
} from '@/lib/mock-data'
import Link from 'next/link'

export default function OverviewPage() {
  const activeClients = mockClients.filter((c) => c.isActive).length
  const connectedInstances = mockWhatsAppInstances.filter(
    (i) => i.status === 'CONNECTED'
  ).length
  const totalMessages = mockInboxMessages.length
  const healthyServices = mockSystemDiagnosis.filter(
    (s) => s.status === 'healthy'
  ).length

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
            value={`${connectedInstances}/${mockWhatsAppInstances.length}`}
            description="connected"
            icon={MessageSquare}
            status={connectedInstances === mockWhatsAppInstances.length ? 'success' : 'warning'}
          />
          <StatusCard
            title="Messages Today"
            value={totalMessages * 127}
            description="across all tenants"
            icon={Zap}
            status="info"
            trend={{ value: 8.2, isPositive: true }}
          />
          <StatusCard
            title="System Health"
            value={`${healthyServices}/${mockSystemDiagnosis.length}`}
            description="services healthy"
            icon={Activity}
            status={healthyServices === mockSystemDiagnosis.length ? 'success' : 'warning'}
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
                <div className="space-y-4">
                  {mockInboxMessages.map((message) => (
                    <div
                      key={message.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div
                        className={`w-2 h-2 mt-2 rounded-full shrink-0 ${
                          message.direction === 'inbound'
                            ? 'bg-info'
                            : 'bg-primary'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {message.clientName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {message.customerNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs bg-secondary border-border"
                          >
                            {message.direction}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.message}
                        </p>
                        {message.aiThoughtProcess && (
                          <Badge
                            variant="outline"
                            className="mt-2 text-xs bg-accent/10 text-accent border-accent/20"
                          >
                            <Brain className="w-3 h-3 mr-1" />
                            AI Reasoning Available
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(message.timestamp)}
                      </span>
                    </div>
                  ))}
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
              {mockSystemDiagnosis.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        service.status === 'healthy'
                          ? 'bg-success'
                          : service.status === 'degraded'
                          ? 'bg-warning'
                          : 'bg-error'
                      }`}
                    />
                    <span className="text-sm font-medium">{service.serviceName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {service.latency}ms
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        service.status === 'healthy'
                          ? 'bg-success/10 text-success border-success/20'
                          : service.status === 'degraded'
                          ? 'bg-warning/10 text-warning border-warning/20'
                          : 'bg-error/10 text-error border-error/20'
                      }`}
                    >
                      {service.status}
                    </Badge>
                  </div>
                </div>
              ))}

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
              {mockClients.map((client) => {
                const instances = mockWhatsAppInstances.filter(
                  (i) => i.clientId === client.id
                )
                const connectedCount = instances.filter(
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
