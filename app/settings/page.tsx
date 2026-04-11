'use client'

import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Globe,
  Key,
  Bell,
  Shield,
  Database,
  Webhook,
  Save,
} from 'lucide-react'

export default function SettingsPage() {
  return (
    <DashboardLayout
      title="Settings"
      description="Global configuration for Mantra AI"
    >
      <div className="space-y-6 max-w-4xl">
        {/* API Configuration */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Manage API keys and authentication settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Evolution API Base URL</Label>
              <Input
                placeholder="https://evolution.yourdomain.com"
                defaultValue="https://evolution.mantra.ai"
                className="bg-secondary border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Evolution API Global Key</Label>
              <Input
                type="password"
                placeholder="evo_***"
                defaultValue="evo_global_key_here"
                className="bg-secondary border-border font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Go Fiber Backend URL</Label>
              <Input
                placeholder="https://api.yourdomain.com"
                defaultValue="https://api.mantra.ai"
                className="bg-secondary border-border font-mono"
              />
            </div>
          </CardContent>
        </Card>

        {/* Webhook Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="w-5 h-5 text-primary" />
              Webhook Settings
            </CardTitle>
            <CardDescription>
              Configure global webhook endpoints
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Webhook URL Template</Label>
              <Input
                placeholder="https://api.mantra.ai/webhook/{instance}"
                defaultValue="https://api.mantra.ai/webhook/{instance}"
                className="bg-secondary border-border font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{instance}'} as placeholder for instance name
              </p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">Webhook Verification</p>
                <p className="text-xs text-muted-foreground">
                  Require signature verification for incoming webhooks
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure alert and notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">Instance Disconnection Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Notify when a WhatsApp instance disconnects
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">AI Provider Failure Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Notify when AI provider fallback is triggered
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">Token Limit Warnings</p>
                <p className="text-xs text-muted-foreground">
                  Notify when tenant approaches token limit
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">System Health Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Notify on service degradation or errors
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Database Configuration
            </CardTitle>
            <CardDescription>
              PostgreSQL and Redis connection settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">PostgreSQL</span>
                <Badge
                  variant="outline"
                  className="bg-success/10 text-success border-success/20"
                >
                  Connected
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                postgresql://***:***@db.mantra.ai:5432/mantra
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Redis</span>
                <Badge
                  variant="outline"
                  className="bg-success/10 text-success border-success/20"
                >
                  Connected
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                redis://***:***@redis.mantra.ai:6379
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>
              Security and access control settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">
                  Require 2FA for admin accounts
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">API Key Rotation</p>
                <p className="text-xs text-muted-foreground">
                  Automatically rotate API keys every 90 days
                </p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">Audit Logging</p>
                <p className="text-xs text-muted-foreground">
                  Log all administrative actions
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" />
            Save All Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
