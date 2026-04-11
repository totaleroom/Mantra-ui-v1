'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { aiProviderSchema, type AIProviderFormData } from '@/lib/validations'
import { useCreateAIProvider } from '@/hooks/use-ai-provider'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const PROVIDER_PRESETS = [
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { name: 'Anthropic', baseUrl: 'https://api.anthropic.com' },
  { name: 'Together AI', baseUrl: 'https://api.together.xyz/v1' },
  { name: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1' },
  { name: 'Custom', baseUrl: '' },
]

interface AddProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddProviderDialog({
  open,
  onOpenChange,
}: AddProviderDialogProps) {
  const createProvider = useCreateAIProvider()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AIProviderFormData>({
    resolver: zodResolver(aiProviderSchema),
    defaultValues: {
      providerName: '',
      apiKey: '',
      baseUrl: null,
      priority: 1,
      isActive: true,
      clientId: null,
    },
  })

  const isGlobal = watch('clientId') === null
  const providerName = watch('providerName')

  const handleProviderSelect = (name: string) => {
    setValue('providerName', name === 'Custom' ? 'Custom Provider' : name)
    const preset = PROVIDER_PRESETS.find((p) => p.name === name)
    if (preset && preset.baseUrl) {
      setValue('baseUrl', preset.baseUrl)
    }
  }

  const onSubmit = async (data: AIProviderFormData) => {
    try {
      await createProvider.mutateAsync(data)
      toast.success('AI Provider added successfully')
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to add AI provider')
      console.error('Create provider error:', error)
    }
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add AI Provider</DialogTitle>
          <DialogDescription>
            Configure a new AI provider for the fallback chain.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={PROVIDER_PRESETS.some((p) => p.name === providerName) ? providerName : 'Custom'}
              onValueChange={handleProviderSelect}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_PRESETS.map((preset) => (
                  <SelectItem key={preset.name} value={preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.providerName && (
              <p className="text-xs text-error">{errors.providerName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              {...register('apiKey')}
              className="bg-secondary border-border font-mono"
            />
            {errors.apiKey && (
              <p className="text-xs text-error">{errors.apiKey.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              placeholder="https://api.example.com/v1"
              {...register('baseUrl')}
              className="bg-secondary border-border"
            />
            {errors.baseUrl && (
              <p className="text-xs text-error">{errors.baseUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority (1 = highest)</Label>
            <Input
              id="priority"
              type="number"
              min="1"
              max="10"
              {...register('priority', { valueAsNumber: true })}
              className="bg-secondary border-border w-24"
            />
            {errors.priority && (
              <p className="text-xs text-error">{errors.priority.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <p className="text-sm font-medium">Global Provider</p>
              <p className="text-xs text-muted-foreground">
                Available to all tenants
              </p>
            </div>
            <Switch
              checked={isGlobal}
              onCheckedChange={(checked) =>
                setValue('clientId', checked ? null : undefined)
              }
            />
          </div>

          {!isGlobal && (
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                type="number"
                placeholder="1"
                {...register('clientId', { valueAsNumber: true })}
                className="bg-secondary border-border w-32"
              />
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createProvider.isPending}
              className="bg-primary text-primary-foreground"
            >
              {(isSubmitting || createProvider.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Add Provider
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
