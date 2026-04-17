'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreVertical,
  QrCode,
  Trash2,
  Unplug,
  Settings,
  Copy,
  ExternalLink,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import type { WhatsAppInstance } from '@/lib/types'

interface WhatsAppInstanceCardProps {
  instance: WhatsAppInstance
  clientName: string
  onScanQR: (instance: WhatsAppInstance) => void
  onDelete: (id: number) => void
  onDisconnect: () => void
}

const statusConfig = {
  CONNECTED: {
    icon: Wifi,
    label: 'Connected',
    color: 'bg-success/10 text-success border-success/20',
    dotColor: 'bg-success',
  },
  DISCONNECTED: {
    icon: WifiOff,
    label: 'Disconnected',
    color: 'bg-muted text-muted-foreground border-muted',
    dotColor: 'bg-muted-foreground',
  },
  CONNECTING: {
    icon: RefreshCw,
    label: 'Connecting',
    color: 'bg-warning/10 text-warning border-warning/20',
    dotColor: 'bg-warning',
  },
  ERROR: {
    icon: AlertTriangle,
    label: 'Error',
    color: 'bg-error/10 text-error border-error/20',
    dotColor: 'bg-error',
  },
}

export function WhatsAppInstanceCard({
  instance,
  clientName,
  onScanQR,
  onDelete,
  onDisconnect,
}: WhatsAppInstanceCardProps) {
  const config = statusConfig[instance.status]
  const StatusIcon = config.icon

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border border-border hover:border-border/80 transition-colors">
      {/* Status Indicator */}
      <div className="relative">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#25D366]/10">
          <svg className="w-6 h-6 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card',
            config.dotColor,
            instance.status === 'CONNECTING' && 'animate-pulse'
          )}
        />
      </div>

      {/* Instance Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-foreground">{instance.instanceName}</span>
          <Badge variant="outline" className="text-xs bg-secondary">
            {clientName}
          </Badge>
          <Badge variant="outline" className="text-xs bg-secondary">
            {instance.providerType}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {instance.instanceApiKey && (
            <span className="font-mono">API: {instance.instanceApiKey.substring(0, 12)}...</span>
          )}
          {instance.webhookUrl && (
            <span className="flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Webhook configured
            </span>
          )}
          {!instance.instanceApiKey && !instance.webhookUrl && (
            <span>Pending setup</span>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <Badge variant="outline" className={cn('text-xs', config.color)}>
        <StatusIcon className={cn('w-3 h-3 mr-1', instance.status === 'CONNECTING' && 'animate-spin')} />
        {config.label}
      </Badge>

      {/* Actions */}
      {instance.status === 'DISCONNECTED' || instance.status === 'ERROR' ? (
        <Button
          size="sm"
          onClick={() => onScanQR(instance)}
          className="bg-[#25D366] text-white hover:bg-[#25D366]/90"
        >
          <QrCode className="w-4 h-4 mr-2" />
          Scan QR
        </Button>
      ) : instance.status === 'CONNECTING' ? (
        <Button size="sm" variant="outline" onClick={() => onScanQR(instance)}>
          <QrCode className="w-4 h-4 mr-2" />
          View QR
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={onDisconnect}
          className="text-warning border-warning/30 hover:bg-warning/10"
        >
          <Unplug className="w-4 h-4 mr-2" />
          Disconnect
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => copyToClipboard(instance.instanceName)}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Instance Name
          </DropdownMenuItem>
          {instance.instanceApiKey && (
            <DropdownMenuItem onClick={() => copyToClipboard(instance.instanceApiKey!)}>
              <Copy className="w-4 h-4 mr-2" />
              Copy API Key
            </DropdownMenuItem>
          )}
          <DropdownMenuItem>
            <Settings className="w-4 h-4 mr-2" />
            Configure Webhook
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(instance.id)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Instance
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
