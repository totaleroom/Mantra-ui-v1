'use client'

import { useState } from 'react'
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
import type { AIProvider } from '@/lib/types'

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
  onAdd: (provider: Omit<AIProvider, 'id' | 'updatedAt'>) => void
}

export function AddProviderDialog({
  open,
  onOpenChange,
  onAdd,
}: AddProviderDialogProps) {
  const [providerName, setProviderName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [priority, setPriority] = useState('1')
  const [isGlobal, setIsGlobal] = useState(true)
  const [clientId, setClientId] = useState('')

  const handleProviderSelect = (name: string) => {
    setProviderName(name)
    const preset = PROVIDER_PRESETS.find((p) => p.name === name)
    if (preset) {
      setBaseUrl(preset.baseUrl)
    }
  }

  const handleSubmit = () => {
    onAdd({
      providerName: providerName === 'Custom' ? 'Custom Provider' : providerName,
      apiKey,
      baseUrl: baseUrl || null,
      priority: parseInt(priority, 10),
      isActive: true,
      lastError: null,
      clientId: isGlobal ? null : parseInt(clientId, 10),
    })

    // Reset form
    setProviderName('')
    setApiKey('')
    setBaseUrl('')
    setPriority('1')
    setIsGlobal(true)
    setClientId('')
  }

  const isValid = providerName && apiKey && priority

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add AI Provider</DialogTitle>
          <DialogDescription>
            Configure a new AI provider for the fallback chain.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={providerName} onValueChange={handleProviderSelect}>
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
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-secondary border-border font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input
              placeholder="https://api.example.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-2">
            <Label>Priority (1 = highest)</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-secondary border-border w-24"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <p className="text-sm font-medium">Global Provider</p>
              <p className="text-xs text-muted-foreground">
                Available to all tenants
              </p>
            </div>
            <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
          </div>

          {!isGlobal && (
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                type="number"
                placeholder="1"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="bg-secondary border-border w-32"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            className="bg-primary text-primary-foreground"
          >
            Add Provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
