'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { AIProviderCard } from '@/components/ai-hub/ai-provider-card'
import { AddProviderDialog } from '@/components/ai-hub/add-provider-dialog'
import { ModelSelector } from '@/components/ai-hub/model-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, ArrowUpDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { mockAIProviders, mockAIModels } from '@/lib/mock-data'
import type { AIProvider } from '@/lib/types'

export default function AIHubPage() {
  const [providers, setProviders] = useState<AIProvider[]>(mockAIProviders)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const globalProviders = providers.filter((p) => p.clientId === null)
  const clientProviders = providers.filter((p) => p.clientId !== null)

  const handleReorderProvider = (id: number, direction: 'up' | 'down') => {
    const index = providers.findIndex((p) => p.id === id)
    if (index === -1) return

    const newProviders = [...providers]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newProviders.length) return

    // Swap priorities
    const currentPriority = newProviders[index].priority
    newProviders[index].priority = newProviders[targetIndex].priority
    newProviders[targetIndex].priority = currentPriority

    // Sort by priority
    newProviders.sort((a, b) => a.priority - b.priority)
    setProviders(newProviders)
  }

  const handleToggleProvider = (id: number) => {
    setProviders(
      providers.map((p) =>
        p.id === id ? { ...p, isActive: !p.isActive } : p
      )
    )
  }

  const handleDeleteProvider = (id: number) => {
    setProviders(providers.filter((p) => p.id !== id))
  }

  const handleAddProvider = (provider: Omit<AIProvider, 'id' | 'updatedAt'>) => {
    const newProvider: AIProvider = {
      ...provider,
      id: Math.max(...providers.map((p) => p.id)) + 1,
      updatedAt: new Date(),
    }
    setProviders([...providers, newProvider])
    setIsAddDialogOpen(false)
  }

  const activeCount = providers.filter((p) => p.isActive).length
  const errorCount = providers.filter((p) => p.lastError).length

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
                  <p className="text-2xl font-bold">{providers.length}</p>
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
                  <p className="text-2xl font-bold text-success">{activeCount}</p>
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
                  <p className="text-2xl font-bold text-warning">{errorCount}</p>
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
                  <p className="text-2xl font-bold">{mockAIModels.length}</p>
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
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Provider
            </Button>
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
                {globalProviders
                  .sort((a, b) => a.priority - b.priority)
                  .map((provider, index) => (
                    <AIProviderCard
                      key={provider.id}
                      provider={provider}
                      index={index}
                      total={globalProviders.length}
                      onReorder={handleReorderProvider}
                      onToggle={handleToggleProvider}
                      onDelete={handleDeleteProvider}
                    />
                  ))}
                {globalProviders.length === 0 && (
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
            <ModelSelector models={mockAIModels} />
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
                      .sort((a, b) => a.priority - b.priority)
                      .map((provider, index, arr) => (
                        <div key={provider.id} className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/20"
                          >
                            {provider.providerName}
                          </Badge>
                          {index < arr.length - 1 && (
                            <span className="text-muted-foreground">→</span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AddProviderDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onAdd={handleAddProvider}
        />
      </div>
    </DashboardLayout>
  )
}
