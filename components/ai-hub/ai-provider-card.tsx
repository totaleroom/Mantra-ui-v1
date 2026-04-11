'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronUp,
  ChevronDown,
  MoreVertical,
  AlertTriangle,
  Key,
  Globe,
  Trash2,
  Edit,
} from 'lucide-react'
import type { AIProvider } from '@/lib/types'

interface AIProviderCardProps {
  provider: AIProvider
  index: number
  total: number
  onReorder: (id: number, direction: 'up' | 'down') => void
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}

export function AIProviderCard({
  provider,
  index,
  total,
  onReorder,
  onToggle,
  onDelete,
}: AIProviderCardProps) {
  const providerIcons: Record<string, string> = {
    OpenRouter: 'OR',
    Groq: 'GQ',
    OpenAI: 'OA',
    Anthropic: 'AN',
    Google: 'GG',
    Mistral: 'MI',
  }

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg border transition-colors',
        provider.isActive
          ? 'bg-secondary/50 border-border'
          : 'bg-secondary/20 border-border/50 opacity-60'
      )}
    >
      {/* Priority Controls */}
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={index === 0}
          onClick={() => onReorder(provider.id, 'up')}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={index === total - 1}
          onClick={() => onReorder(provider.id, 'down')}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Priority Badge */}
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-sm font-bold">
        {provider.priority}
      </div>

      {/* Provider Icon */}
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-foreground text-xs font-bold">
        {providerIcons[provider.providerName] || provider.providerName.substring(0, 2).toUpperCase()}
      </div>

      {/* Provider Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{provider.providerName}</span>
          {provider.clientId && (
            <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
              Client #{provider.clientId}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Key className="w-3 h-3" />
            {provider.apiKey.substring(0, 8)}...
          </span>
          {provider.baseUrl && (
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {new URL(provider.baseUrl).hostname}
            </span>
          )}
        </div>
      </div>

      {/* Error Badge */}
      {provider.lastError && (
        <Badge
          variant="outline"
          className="bg-warning/10 text-warning border-warning/20 text-xs max-w-[200px] truncate"
        >
          <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
          {provider.lastError}
        </Badge>
      )}

      {/* Status */}
      <Badge
        variant="outline"
        className={cn(
          'text-xs',
          provider.isActive
            ? 'bg-success/10 text-success border-success/20'
            : 'bg-muted text-muted-foreground border-muted'
        )}
      >
        {provider.isActive ? 'Active' : 'Inactive'}
      </Badge>

      {/* Toggle */}
      <Switch
        checked={provider.isActive}
        onCheckedChange={() => onToggle(provider.id)}
      />

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(provider.id)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
