'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { WhatsAppInstanceCard } from '@/components/whatsapp/instance-card'
import { CreateInstanceDialog } from '@/components/whatsapp/create-instance-dialog'
import { QRCodeDialog } from '@/components/whatsapp/qr-code-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { mockWhatsAppInstances, mockClients } from '@/lib/mock-data'
import type { WhatsAppInstance } from '@/lib/types'

export default function WhatsAppPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>(mockWhatsAppInstances)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [qrDialogInstance, setQrDialogInstance] = useState<WhatsAppInstance | null>(null)

  const filteredInstances = instances.filter((instance) => {
    const matchesSearch =
      instance.instanceName.toLowerCase().includes(search.toLowerCase()) ||
      mockClients.find((c) => c.id === instance.clientId)?.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || instance.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const connectedCount = instances.filter((i) => i.status === 'CONNECTED').length
  const disconnectedCount = instances.filter((i) => i.status === 'DISCONNECTED').length
  const connectingCount = instances.filter((i) => i.status === 'CONNECTING').length
  const errorCount = instances.filter((i) => i.status === 'ERROR').length

  const handleCreateInstance = (data: { instanceName: string; clientId: number }) => {
    const newInstance: WhatsAppInstance = {
      id: Math.max(...instances.map((i) => i.id)) + 1,
      clientId: data.clientId,
      instanceName: data.instanceName,
      instanceApiKey: null,
      webhookUrl: null,
      status: 'DISCONNECTED',
      updatedAt: new Date(),
    }
    setInstances([...instances, newInstance])
    setIsCreateDialogOpen(false)
  }

  const handleDeleteInstance = (id: number) => {
    setInstances(instances.filter((i) => i.id !== id))
  }

  const handleScanQR = (instance: WhatsAppInstance) => {
    setQrDialogInstance(instance)
  }

  const handleConnectInstance = (id: number) => {
    setInstances(
      instances.map((i) =>
        i.id === id ? { ...i, status: 'CONNECTED' as const, updatedAt: new Date() } : i
      )
    )
    setQrDialogInstance(null)
  }

  const handleDisconnectInstance = (id: number) => {
    setInstances(
      instances.map((i) =>
        i.id === id ? { ...i, status: 'DISCONNECTED' as const, updatedAt: new Date() } : i
      )
    )
  }

  return (
    <DashboardLayout
      title="WhatsApp Gateway"
      description="Manage Evolution API instances for all tenants"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Connected</p>
                  <p className="text-2xl font-bold text-success">{connectedCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <Wifi className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Disconnected</p>
                  <p className="text-2xl font-bold text-muted-foreground">{disconnectedCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <WifiOff className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Connecting</p>
                  <p className="text-2xl font-bold text-warning">{connectingCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <RefreshCw className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-error">{errorCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-error/10">
                  <AlertTriangle className="w-5 h-5 text-error" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search instances or clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-secondary border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-secondary border-border">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="CONNECTED">Connected</SelectItem>
                  <SelectItem value="DISCONNECTED">Disconnected</SelectItem>
                  <SelectItem value="CONNECTING">Connecting</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Instance
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instances List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>WhatsApp Instances</span>
              <Badge variant="outline" className="bg-secondary">
                {filteredInstances.length} instance{filteredInstances.length !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredInstances.map((instance) => {
              const client = mockClients.find((c) => c.id === instance.clientId)
              return (
                <WhatsAppInstanceCard
                  key={instance.id}
                  instance={instance}
                  clientName={client?.name || 'Unknown Client'}
                  onScanQR={handleScanQR}
                  onDelete={handleDeleteInstance}
                  onDisconnect={handleDisconnectInstance}
                />
              )
            })}
            {filteredInstances.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <WifiOff className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No instances found</p>
                <p className="text-sm">Create a new instance to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateInstanceDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateInstance}
        clients={mockClients}
      />

      <QRCodeDialog
        instance={qrDialogInstance}
        onClose={() => setQrDialogInstance(null)}
        onConnect={handleConnectInstance}
      />
    </DashboardLayout>
  )
}
