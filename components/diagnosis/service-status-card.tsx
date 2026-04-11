'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  Server,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import type { SystemDiagnosis } from '@/lib/types'

interface ServiceStatusCardProps {
  service: SystemDiagnosis & {
    description: string
    metrics: { label: string; value: string; status: 'good' | 'warning' | 'error' }[]
  }
  isSelected: boolean
  onClick: () => void
}

const serviceIcons: Record<string, React.ElementType> = {
  PostgreSQL: Database,
  Redis: Server,
  'Evolution API': MessageSquare,
}

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    label: 'Healthy',
    color: 'bg-success/10 text-success border-success/20',
    bgColor: 'bg-success/5 border-success/20',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded',
    color: 'bg-warning/10 text-warning border-warning/20',
    bgColor: 'bg-warning/5 border-warning/20',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    color: 'bg-error/10 text-error border-error/20',
    bgColor: 'bg-error/5 border-error/20',
  },
}

export function ServiceStatusCard({
  service,
  isSelected,
  onClick,
}: ServiceStatusCardProps) {
  const ServiceIcon = serviceIcons[service.serviceName] || Server
  const status = statusConfig[service.status as keyof typeof statusConfig] || statusConfig.healthy
  const StatusIcon = status.icon

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all border-2',
        isSelected
          ? 'ring-2 ring-primary/20 border-primary/30'
          : 'border-border hover:border-border/80',
        status.bgColor
      )}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          {/* Service Icon */}
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-xl',
              service.status === 'healthy'
                ? 'bg-success/10'
                : service.status === 'degraded'
                ? 'bg-warning/10'
                : 'bg-error/10'
            )}
          >
            <ServiceIcon
              className={cn(
                'w-6 h-6',
                service.status === 'healthy'
                  ? 'text-success'
                  : service.status === 'degraded'
                  ? 'text-warning'
                  : 'text-error'
              )}
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-foreground">{service.serviceName}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-xs', status.color)}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
                <Badge variant="outline" className="bg-secondary text-xs font-mono">
                  {service.latency}ms
                </Badge>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {service.description}
            </p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {service.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="p-2 rounded-lg bg-background/50 border border-border"
                >
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      metric.status === 'good'
                        ? 'text-foreground'
                        : metric.status === 'warning'
                        ? 'text-warning'
                        : 'text-error'
                    )}
                  >
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
