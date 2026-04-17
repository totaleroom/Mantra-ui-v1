'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ServiceStatusCard } from '@/components/diagnosis/service-status-card'
import { AIRecommendationPanel } from '@/components/diagnosis/ai-recommendation-panel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  RefreshCw,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
} from 'lucide-react'
import type { SystemDiagnosis } from '@/lib/types'
import { apiClient } from '@/lib/api-client'

export default function DiagnosisPage() {
  const [services, setServices] = useState(extendedDiagnosis)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [selectedService, setSelectedService] = useState<string | null>('Evolution API')

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshServices()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const refreshServices = async () => {
    setIsRefreshing(true)
    try {
      const data = await apiClient.get<SystemDiagnosis[]>('/api/system/diagnosis')
      const mapped = data.map((s) => ({
        ...s,
        description:
          s.serviceName === 'PostgreSQL'
            ? 'Primary database for tenant data, AI configs, and message history'
            : s.serviceName === 'Redis'
            ? 'In-memory cache for sessions, rate limiting, and customer memories'
            : 'WhatsApp messaging gateway and core automation runtime',
        metrics: [
          { label: 'Latency', value: `${s.latency}ms`, status: s.latency < 100 ? 'good' : s.latency < 500 ? 'warning' : 'error' },
        ],
      }))
      setServices(mapped)
      setLastRefresh(new Date())
    } catch {
      // Keep previous state but update timestamp
      setLastRefresh(new Date())
    } finally {
      setIsRefreshing(false)
    }
  }

  const healthyCount = services.filter((s) => s.status === 'healthy').length
  const degradedCount = services.filter((s) => s.status === 'degraded').length
  const errorCount = services.filter((s) => s.status === 'error').length
  const overallHealth = (healthyCount / services.length) * 100

  const selectedServiceData = services.find((s) => s.serviceName === selectedService)

  return (
    <DashboardLayout
      title="System Diagnosis"
      description="Control room for infrastructure health monitoring"
    >
      <div className="space-y-6">
        {/* Overall Health Banner */}
        <Card
          className={`border-2 ${
            overallHealth === 100
              ? 'border-success/30 bg-success/5'
              : overallHealth >= 66
              ? 'border-warning/30 bg-warning/5'
              : 'border-error/30 bg-error/5'
          }`}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-16 h-16 rounded-xl ${
                    overallHealth === 100
                      ? 'bg-success/10'
                      : overallHealth >= 66
                      ? 'bg-warning/10'
                      : 'bg-error/10'
                  }`}
                >
                  {overallHealth === 100 ? (
                    <CheckCircle className="w-8 h-8 text-success" />
                  ) : overallHealth >= 66 ? (
                    <AlertTriangle className="w-8 h-8 text-warning" />
                  ) : (
                    <XCircle className="w-8 h-8 text-error" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {overallHealth === 100
                      ? 'All Systems Operational'
                      : overallHealth >= 66
                      ? 'Partial Degradation'
                      : 'Critical Issues Detected'}
                  </h2>
                  <p className="text-muted-foreground">
                    {healthyCount} healthy, {degradedCount} degraded, {errorCount} errors
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Last updated</p>
                  <p className="text-sm font-medium">
                    {lastRefresh.toLocaleTimeString()}
                  </p>
                </div>
                <Button
                  onClick={refreshServices}
                  disabled={isRefreshing}
                  variant="outline"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">System Health</p>
                  <p className="text-2xl font-bold">{overallHealth.toFixed(0)}%</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
              </div>
              <Progress value={overallHealth} className="h-1.5 mt-3" />
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Latency</p>
                  <p className="text-2xl font-bold">
                    {Math.round(
                      services.reduce((sum, s) => sum + s.latency, 0) / services.length
                    )}
                    ms
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-info/10">
                  <Clock className="w-5 h-5 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                  <p className="text-2xl font-bold">34%</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <Cpu className="w-5 h-5 text-success" />
                </div>
              </div>
              <Progress value={34} className="h-1.5 mt-3" />
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Disk Usage</p>
                  <p className="text-2xl font-bold">62%</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <HardDrive className="w-5 h-5 text-warning" />
                </div>
              </div>
              <Progress value={62} className="h-1.5 mt-3" />
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Services List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold">Service Health</h3>
            {services.map((service) => (
              <ServiceStatusCard
                key={service.id}
                service={service}
                isSelected={selectedService === service.serviceName}
                onClick={() => setSelectedService(service.serviceName)}
              />
            ))}
          </div>

          {/* AI Recommendations */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">AI Recommendations</h3>
            <AIRecommendationPanel service={selectedServiceData} />
          </div>
        </div>

        {/* Recent Events */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Recent Events</CardTitle>
            <CardDescription>System events from the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  time: '2 min ago',
                  event: 'Evolution API response time increased above threshold',
                  type: 'warning',
                },
                {
                  time: '15 min ago',
                  event: 'Redis cache hit rate recovered to 94%',
                  type: 'success',
                },
                {
                  time: '1 hour ago',
                  event: 'PostgreSQL connection pool scaled up',
                  type: 'info',
                },
                {
                  time: '3 hours ago',
                  event: 'Automated backup completed successfully',
                  type: 'success',
                },
                {
                  time: '6 hours ago',
                  event: 'WhatsApp instance acme-support reconnected',
                  type: 'info',
                },
              ].map((event, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      event.type === 'success'
                        ? 'bg-success'
                        : event.type === 'warning'
                        ? 'bg-warning'
                        : event.type === 'error'
                        ? 'bg-error'
                        : 'bg-info'
                    }`}
                  />
                  <p className="flex-1 text-sm">{event.event}</p>
                  <span className="text-xs text-muted-foreground">{event.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
