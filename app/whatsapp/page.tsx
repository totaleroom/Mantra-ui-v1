'use client'

import { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { WhatsAppInstanceCard } from '@/components/whatsapp/instance-card'
import { CreateInstanceDialog } from '@/components/whatsapp/create-instance-dialog'
import { QRCodeDialog } from '@/components/whatsapp/qr-code-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  useWhatsAppInstances,
  useDeleteWhatsAppInstance,
  useDisconnectWhatsAppInstance,
} from '@/hooks/use-whatsapp'
import { useTenants } from '@/hooks/use-tenant'
import { toast } from 'sonner'
import type { WhatsAppInstance } from '@/lib/types'

export default function WhatsAppPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [qrDialogInstance, setQrDialogInstance] = useState<WhatsAppInstance | null>(null)

  // Fetch data
  const { data: instances, isLoading, refetch } = useWhatsAppInstances()
  const { data: clients } = useTenants()
  const deleteInstance = useDeleteWhatsAppInstance()
  const disconnectInstance = useDisconnectWhatsAppInstance()

  // Filter instances
  const filteredInstances = useMemo(() => {
    if (!instances) return []
    return instances.filter((instance) => {
      const client = clients?.find((c) => c.id === instance.clientId)
      const matchesSearch =
        instance.instanceName.toLowerCase().includes(search.toLowerCase()) ||
        client?.name.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || instance.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [instances, clients, search, statusFilter])

  // Calculate stats
  const stats = useMemo(() => {
    if (!instances) return { connected: 0, disconnected: 0, connecting: 0, error: 0 }
    return {
      connected: instances.filter((i) => i.status === 'CONNECTED').length,
      disconnected: instances.filter((i) => i.status === 'DISCONNECTED').length,
      connecting: instances.filter((i) => i.status === 'CONNECTING').length,
      error: instances.filter((i) => i.status === 'ERROR').length,
    }
  }, [instances])

  const handleDeleteInstance = async (id: number) => {
    try {
      await deleteInstance.mutateAsync(id)
      toast.success('Instance deleted successfully')
    } catch {
      toast.error('Failed to delete instance')
    }
  }

  const handleScanQR = (instance: WhatsAppInstance) => {
    setQrDialogInstance(instance)
  }

  const handleDisconnectInstance = async (instanceName: string) => {
    try {
      await disconnectInstance.mutateAsync(instanceName)
      toast.success('Instance disconnected')
    } catch {
      toast.error('Failed to disconnect instance')
    }
  }

  const getClientName = (clientId: number) => {
    return clients?.find((c) => c.id === clientId)?.name || 'Unknown Client'
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
                  <p className="text-2xl font-bold text-success">{stats.connected}</p>
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
                  <p className="text-2xl font-bold text-muted-foreground">{stats.disconnected}</p>
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
                  <p className="text-2xl font-bold text-warning">{stats.connecting}</p>
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
                  <p className="text-2xl font-bold text-error">{stats.error}</p>
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
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
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
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg bg-secondary/50 flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-9" />
                  </div>
                </div>
              ))
            ) : filteredInstances.length > 0 ? (
              filteredInstances.map((instance) => (
                <WhatsAppInstanceCard
                  key={instance.id}
                  instance={instance}
                  clientName={getClientName(instance.clientId)}
                  onScanQR={handleScanQR}
                  onDelete={handleDeleteInstance}
                  onDisconnect={() => handleDisconnectInstance(instance.instanceName)}
                />
              ))
            ) : (
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
      />

      <QRCodeDialog
        instance={qrDialogInstance}
        onClose={() => setQrDialogInstance(null)}
      />
    </DashboardLayout>
  )
}
