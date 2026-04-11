'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Brain,
  Sparkles,
  Wrench,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import type { SystemDiagnosis } from '@/lib/types'

interface AIRecommendationPanelProps {
  service:
    | (SystemDiagnosis & {
        description: string
        metrics: { label: string; value: string; status: 'good' | 'warning' | 'error' }[]
      })
    | undefined
}

const recommendations: Record<string, { type: 'fix' | 'optimize' | 'info'; title: string; description: string; action?: string }[]> = {
  PostgreSQL: [
    {
      type: 'optimize',
      title: 'Connection Pooling',
      description: 'Consider implementing PgBouncer for better connection management at scale.',
    },
    {
      type: 'info',
      title: 'Query Performance',
      description: 'All queries executing within acceptable latency thresholds.',
    },
  ],
  Redis: [
    {
      type: 'optimize',
      title: 'Memory Optimization',
      description: 'Current memory usage is healthy. Consider enabling memory defragmentation for long-running instances.',
    },
    {
      type: 'info',
      title: 'Cache Strategy',
      description: 'Hit rate of 94.2% indicates effective caching strategy.',
    },
  ],
  'Evolution API': [
    {
      type: 'fix',
      title: 'High Response Time',
      description: 'Response time (450ms) exceeds recommended threshold (200ms). Consider scaling horizontally or optimizing webhook handlers.',
      action: 'Restart Service',
    },
    {
      type: 'fix',
      title: 'Queue Depth Warning',
      description: 'Message queue depth is elevated. Increase worker concurrency or add additional processing nodes.',
      action: 'Scale Workers',
    },
    {
      type: 'optimize',
      title: 'Connection Stability',
      description: 'Monitor reconnection patterns. Implement exponential backoff for better reliability.',
    },
  ],
}

export function AIRecommendationPanel({ service }: AIRecommendationPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsAnalyzing(false)
  }

  if (!service) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Brain className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
          <p className="text-sm text-muted-foreground">
            Select a service to view AI-powered recommendations
          </p>
        </CardContent>
      </Card>
    )
  }

  const serviceRecommendations = recommendations[service.serviceName] || []
  const fixCount = serviceRecommendations.filter((r) => r.type === 'fix').length

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            AI Analysis
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            <RefreshCw
              className={`w-3 h-3 mr-1 ${isAnalyzing ? 'animate-spin' : ''}`}
            />
            {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">{service.serviceName}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {fixCount > 0 ? (
              <span className="text-warning">
                {fixCount} issue{fixCount > 1 ? 's' : ''} requiring attention
              </span>
            ) : (
              <span className="text-success">All systems operating normally</span>
            )}
          </p>
        </div>

        {/* Recommendations */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-3 pr-2">
            {serviceRecommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  rec.type === 'fix'
                    ? 'bg-warning/5 border-warning/20'
                    : rec.type === 'optimize'
                    ? 'bg-info/5 border-info/20'
                    : 'bg-secondary/50 border-border'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  {rec.type === 'fix' ? (
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  ) : rec.type === 'optimize' ? (
                    <Wrench className="w-4 h-4 text-info shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{rec.title}</p>
                    <Badge
                      variant="outline"
                      className={`text-xs mt-1 ${
                        rec.type === 'fix'
                          ? 'bg-warning/10 text-warning border-warning/20'
                          : rec.type === 'optimize'
                          ? 'bg-info/10 text-info border-info/20'
                          : 'bg-success/10 text-success border-success/20'
                      }`}
                    >
                      {rec.type === 'fix'
                        ? 'Requires Action'
                        : rec.type === 'optimize'
                        ? 'Optimization'
                        : 'Info'}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {rec.description}
                </p>
                {rec.action && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7"
                  >
                    {rec.action}
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* AI Confidence */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>AI Confidence</span>
            <span className="font-mono">94.7%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on historical patterns and current metrics
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
