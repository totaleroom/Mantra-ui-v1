'use client'

import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useWhatsAppProviders } from '@/hooks/use-whatsapp'

export default function WhatsAppProvidersPage() {
  const { data: providers = [] } = useWhatsAppProviders()

  return (
    <DashboardLayout
      title="WhatsApp Providers"
      description="Manage global WhatsApp provider credentials and defaults"
    >
      <div className="space-y-6 max-w-5xl">
        {providers.map((provider) => (
          <Card key={provider.type} className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{provider.name}</CardTitle>
                  <CardDescription>{provider.description}</CardDescription>
                </div>
                <Badge variant="outline" className="bg-secondary">
                  Default MVP
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Global Credential Alias</Label>
                  <Input
                    defaultValue={String(provider.defaultConfig.globalApiKey ?? '')}
                    placeholder="shared-provider-key"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default QR Format</Label>
                  <Input
                    defaultValue={String(provider.defaultConfig.qrFormat ?? 'data_url')}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                Provider config is stored in JSONB-compatible shape through `provider_config`
                so per-instance overrides stay lightweight.
              </div>
              <div className="flex justify-end">
                <Button className="bg-primary text-primary-foreground">Save Provider Defaults</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  )
}
