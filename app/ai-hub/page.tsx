'use client'

import { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { AIProviderCard } from '@/components/ai-hub/ai-provider-card'
import { AddProviderDialog } from '@/components/ai-hub/add-provider-dialog'
import { ModelSelector } from '@/components/ai-hub/model-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ArrowUpDown, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import {
  useAIProviders,
  useDeleteAIProvider,
  useToggleAIProvider,
  useUpdateProviderPriorities,
  useAllModels,
} from '@/hooks/use-ai-provider'
import { toast } from 'sonner'

export default function AIHubPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // Fetch data
  const { data: providers, isLoading, refetch } = useAIProviders()
  const { data: models, isLoading: isLoadingModels } = useAllModels()
  const deleteProvider = useDeleteAIProvider()
  const toggleProvider = useToggleAIProvider()
  const updatePriorities = useUpdateProviderPriorities()

  // Separate global and client providers
  const { globalProviders, clientProviders } = useMemo(() => {
    if (!providers) return { globalProviders: [], clientProviders: [] }
    return {
      globalProviders: providers.filter((p) => p.clientId === null).sort((a, b) => a.priority - b.priority),
      clientProviders: providers.filter((p) => p.clientId !== null).sort((a, b) => a.priority - b.priority),
    }
  }, [providers])

  // Calculate stats
  const stats = useMemo(() => {
    if (!providers) return { total: 0, active: 0, errors: 0 }
    return {
      total: providers.length,
      active: providers.filter((p) => p.isActive).length,
      errors: providers.filter((p) => p.lastError).length,
    }
  }, [providers])

  const handleReorderProvider = async (id: number, direction: 'up' | 'down') => {
    if (!providers) return

    const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority)
    const index = sortedProviders.findIndex((p) => p.id === id)
    if (index === -1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= sortedProviders.length) return

    // Create new priorities
    const newPriorities = sortedProviders.map((p, i) => {
      if (i === index) return { id: p.id, priority: targetIndex + 1 }
      if (i === targetIndex) return { id: p.id, priority: index + 1 }
      return { id: p.id, priority: i + 1 }
    })

    try {
      await updatePriorities.mutateAsync(newPriorities)
      toast.success('Provider order updated')
    } catch {
      toast.error('Failed to update provider order')
    }
  }

  const handleToggleProvider = async (id: number) => {
    const provider = providers?.find((p) => p.id === id)
    if (!provider) return

    try {
      await toggleProvider.mutateAsync({ id, isActive: !provider.isActive })
      toast.success(`Provider ${provider.isActive ? 'disabled' : 'enabled'}`)
    } catch {
      toast.error('Failed to toggle provider')
    }
  }

  const handleDeleteProvider = async (id: number) => {
    try {
      await deleteProvider.mutateAsync(id)
      toast.success('Provider deleted')
    } catch {
      toast.error('Failed to delete provider')
    }
  }

  return (
    <DashboardLayout
      title="AI Intelligence Hub"
      description="Manage AI providers with priority-based fallback logic"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Providers</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <ArrowUpDown className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-success">{stats.active}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">With Errors</p>
                  <p className="text-2xl font-bold text-warning">{stats.errors}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Available Models</p>
                  <p className="text-2xl font-bold">{models?.length ?? 0}</p>
                </div>
                <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                  Live
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="providers" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-secondary">
              <TabsTrigger value="providers">Providers</TabsTrigger>
              <TabsTrigger value="models">Model Selector</TabsTrigger>
              <TabsTrigger value="fallback">Fallback Logic</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            </div>
          </div>

          <TabsContent value="providers" className="space-y-6">
            {/* Global Providers */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Global Providers</CardTitle>
                <CardDescription>
                  Available to all tenants. Lower priority number = higher precedence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg bg-secondary/50 flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  ))
                ) : globalProviders.length > 0 ? (
                  globalProviders.map((provider, index) => (
                    <AIProviderCard
                      key={provider.id}
                      provider={provider}
                      index={index}
                      total={globalProviders.length}
                      onReorder={handleReorderProvider}
                      onToggle={handleToggleProvider}
                      onDelete={handleDeleteProvider}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No global providers configured. Add one to get started.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Client-Specific Providers */}
            {clientProviders.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">Client-Specific Providers</CardTitle>
                  <CardDescription>
                    Override providers for specific tenants.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {clientProviders.map((provider, index) => (
                    <AIProviderCard
                      key={provider.id}
                      provider={provider}
                      index={index}
                      total={clientProviders.length}
                      onReorder={handleReorderProvider}
                      onToggle={handleToggleProvider}
                      onDelete={handleDeleteProvider}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="models">
            <ModelSelector models={models ?? []} isLoading={isLoadingModels} />
          </TabsContent>

          <TabsContent value="fallback">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Fallback Logic Configuration</CardTitle>
                <CardDescription>
                  When the primary provider fails, requests automatically cascade to the next provider.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Primary Request</p>
                      <p className="text-sm text-muted-foreground">
                        Routes to highest priority active provider
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-px h-6 bg-border" />
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-warning text-primary-foreground text-sm font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">On Failure</p>
                      <p className="text-sm text-muted-foreground">
                        Logs error, updates lastError field, cascades to next provider
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-px h-6 bg-border" />
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-error text-destructive-foreground text-sm font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">All Providers Failed</p>
                      <p className="text-sm text-muted-foreground">
                        Returns error to client, triggers alert notification
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg border border-border bg-secondary/30">
                  <h4 className="text-sm font-medium mb-2">Current Fallback Chain</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {globalProviders
                      .filter((p) => p.isActive)
                      .map((provider, index, arr) => (
                        <div key={provider.id} className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/20"
                          >
                            {provider.providerName}
                          </Badge>
                          {index < arr.length - 1 && (
                            <span className="text-muted-foreground">-&gt;</span>
                          )}
                        </div>
                      ))}
                    {globalProviders.filter((p) => p.isActive).length === 0 && (
                      <p className="text-sm text-muted-foreground">No active providers</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AddProviderDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
        />
      </div>
    </DashboardLayout>
  )
}
