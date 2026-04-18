'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Brain,
  Database,
  Thermometer,
  Clock,
  Save,
  RotateCcw,
  Zap,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { useTenant, useTenantAIConfig, useUpdateTenant, useUpdateTenantAIConfig } from '@/hooks/use-tenant'
import { useWhatsAppInstances } from '@/hooks/use-whatsapp'
import { useAllModels } from '@/hooks/use-ai-provider'
import { clientAiConfigSchema, type ClientAIConfigFormData } from '@/lib/validations'
import { toast } from 'sonner'

export default function TenantDetailPage() {
  const params = useParams()
  const clientId = parseInt(params.id as string, 10)

  // Fetch data
  const { data: client, isLoading: isLoadingClient } = useTenant(clientId)
  const { data: existingConfig, isLoading: isLoadingConfig } = useTenantAIConfig(clientId)
  const { data: instances } = useWhatsAppInstances()
  const { data: models } = useAllModels()

  // Mutations
  const updateTenant = useUpdateTenant()
  const updateConfig = useUpdateTenantAIConfig()

  // Form
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Omit<ClientAIConfigFormData, 'clientId'> & { memoryEnabled: boolean; tokenLimit: number }>({
    resolver: zodResolver(
      clientAiConfigSchema.omit({ clientId: true }).extend({
        memoryEnabled: clientAiConfigSchema.shape.memoryTtlDays.transform(() => true),
        tokenLimit: clientAiConfigSchema.shape.memoryTtlDays,
      })
    ),
    defaultValues: {
      modelId: '',
      systemPrompt: '',
      vectorNamespace: '',
      temperature: 0.7,
      memoryTtlDays: 4,
      memoryEnabled: true,
      tokenLimit: 1000,
    },
  })

  // Sync form with fetched data
  useEffect(() => {
    if (existingConfig && client) {
      reset({
        modelId: existingConfig.modelId,
        systemPrompt: existingConfig.systemPrompt,
        vectorNamespace: existingConfig.vectorNamespace || '',
        temperature: existingConfig.temperature,
        memoryTtlDays: existingConfig.memoryTtlDays,
        memoryEnabled: existingConfig.memoryTtlDays > 0,
        tokenLimit: client.tokenLimit,
      })
    }
  }, [existingConfig, client, reset])

  const memoryEnabled = watch('memoryEnabled')
  const temperature = watch('temperature')
  const memoryTtlDays = watch('memoryTtlDays')

  const clientInstances = instances?.filter((i) => i.clientId === clientId) ?? []

  const onSubmit = async (data: Omit<ClientAIConfigFormData, 'clientId'> & { memoryEnabled: boolean; tokenLimit: number }) => {
    try {
      // Update AI config
      await updateConfig.mutateAsync({
        clientId,
        data: {
          modelId: data.modelId,
          systemPrompt: data.systemPrompt,
          vectorNamespace: data.vectorNamespace || null,
          temperature: data.temperature,
          memoryTtlDays: data.memoryEnabled ? data.memoryTtlDays : 0,
        },
      })

      // Update token limit if changed
      if (client && data.tokenLimit !== client.tokenLimit) {
        await updateTenant.mutateAsync({
          id: clientId,
          data: { tokenLimit: data.tokenLimit },
        })
      }

      toast.success('Configuration saved successfully')
    } catch {
      toast.error('Failed to save configuration')
    }
  }

  const handleReset = () => {
    if (existingConfig && client) {
      reset({
        modelId: existingConfig.modelId,
        systemPrompt: existingConfig.systemPrompt,
        vectorNamespace: existingConfig.vectorNamespace || '',
        temperature: existingConfig.temperature,
        memoryTtlDays: existingConfig.memoryTtlDays,
        memoryEnabled: existingConfig.memoryTtlDays > 0,
        tokenLimit: client.tokenLimit,
      })
    }
  }

  if (isLoadingClient || isLoadingConfig) {
    return (
      <DashboardLayout title="Loading..." description="">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    )
  }

  if (!client) {
    return (
      <DashboardLayout title="Tenant Not Found" description="">
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-muted-foreground mb-4">Tenant not found</p>
          <Link href="/tenants">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tenants
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={client.name}
      description="Tenant AI configuration and settings"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/tenants">
            <Button type="button" variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tenants
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Link href={`/tenants/${clientId}/knowledge`}>
              <Button type="button" variant="outline" size="sm">
                <Database className="w-4 h-4 mr-2" />
                Knowledge Base
              </Button>
            </Link>
            <Link href={`/tenants/${clientId}/tools`}>
              <Button type="button" variant="outline" size="sm">
                <Zap className="w-4 h-4 mr-2" />
                Tools
              </Button>
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={!isDirty}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button type="submit" size="sm" className="bg-primary text-primary-foreground" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={
                      client.isActive
                        ? 'bg-success/10 text-success border-success/20 mt-1'
                        : 'bg-error/10 text-error border-error/20 mt-1'
                    }
                  >
                    {client.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Token Balance</p>
                  <p className="text-2xl font-bold">
                    {(client.tokenBalance / 1000).toFixed(1)}k
                  </p>
                </div>
                <Zap className="w-5 h-5 text-warning" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                of {(client.tokenLimit / 1000).toFixed(0)}k limit
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">WA Instances</p>
                  <p className="text-2xl font-bold">{clientInstances.length}</p>
                </div>
                <MessageSquare className="w-5 h-5 text-info" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {clientInstances.filter((i) => i.status === 'CONNECTED').length} connected
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium mt-1">
                    {new Date(client.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Tabs */}
        <Tabs defaultValue="ai-persona" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="ai-persona">AI Persona</TabsTrigger>
            <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
            <TabsTrigger value="memory">Memory Settings</TabsTrigger>
            <TabsTrigger value="limits">Token Limits</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-persona" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  AI Persona Configuration
                </CardTitle>
                <CardDescription>
                  Define how the AI assistant behaves for this tenant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Model Selection */}
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Controller
                    name="modelId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {models?.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center gap-2">
                                <span>{model.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({model.provider})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.modelId && (
                    <p className="text-xs text-error">{errors.modelId.message}</p>
                  )}
                </div>

                {/* System Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Textarea
                    id="systemPrompt"
                    placeholder="You are a helpful customer service agent for..."
                    {...register('systemPrompt')}
                    className="bg-secondary border-border min-h-[150px] font-mono text-sm"
                  />
                  {errors.systemPrompt && (
                    <p className="text-xs text-error">{errors.systemPrompt.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Define the AI persona, tone, and behavioral guidelines
                  </p>
                </div>

                {/* Temperature */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      Temperature
                    </Label>
                    <Badge variant="outline" className="bg-secondary font-mono">
                      {temperature}
                    </Badge>
                  </div>
                  <Controller
                    name="temperature"
                    control={control}
                    render={({ field }) => (
                      <Slider
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                    )}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Precise (0.0)</span>
                    <span>Creative (2.0)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge-base">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  RAG Knowledge Base
                </CardTitle>
                <CardDescription>
                  Configure vector database isolation for tenant-specific knowledge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="vectorNamespace">Vector Namespace</Label>
                  <Input
                    id="vectorNamespace"
                    placeholder="e.g., acme-kb"
                    {...register('vectorNamespace')}
                    className="bg-secondary border-border font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Isolates this tenant&apos;s knowledge base in the vector store
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <h4 className="text-sm font-medium mb-2">Upload Documents</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Upload PDFs, text files, or other documents to build the knowledge base
                  </p>
                  <Button type="button" variant="outline" size="sm">
                    Upload Files
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memory">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Customer Memory Settings
                </CardTitle>
                <CardDescription>
                  Configure transient memory for customer conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Memory Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
                  <div>
                    <p className="font-medium">Customer Memory</p>
                    <p className="text-sm text-muted-foreground">
                      Remember customer context across conversations
                    </p>
                  </div>
                  <Controller
                    name="memoryEnabled"
                    control={control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>

                {/* TTL Slider */}
                {memoryEnabled && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Memory TTL (Time to Live)</Label>
                      <Badge variant="outline" className="bg-secondary font-mono">
                        {memoryTtlDays} days
                      </Badge>
                    </div>
                    <Controller
                      name="memoryTtlDays"
                      control={control}
                      render={({ field }) => (
                        <Slider
                          value={[field.value]}
                          onValueChange={([value]) => field.onChange(value)}
                          min={1}
                          max={4}
                          step={1}
                          className="w-full"
                        />
                      )}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 day</span>
                      <span>2 days</span>
                      <span>3 days</span>
                      <span>4 days (max)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Customer memories are automatically purged after this period
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="limits">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Token Limits
                </CardTitle>
                <CardDescription>
                  Manage token allocation for this tenant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Current Balance</Label>
                    <Input
                      value={client.tokenBalance.toLocaleString()}
                      readOnly
                      className="bg-secondary border-border font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenLimit">Token Limit</Label>
                    <Input
                      id="tokenLimit"
                      type="number"
                      {...register('tokenLimit', { valueAsNumber: true })}
                      className="bg-secondary border-border font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Usage</Label>
                  <div className="h-4 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.min((client.tokenBalance / client.tokenLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {((client.tokenBalance / client.tokenLimit) * 100).toFixed(1)}%
                    of limit used
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm text-warning">
                    When token balance reaches zero, AI responses will be paused until
                    more tokens are allocated.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </DashboardLayout>
  )
}
