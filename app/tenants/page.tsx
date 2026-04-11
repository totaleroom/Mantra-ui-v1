'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  MoreVertical,
  Users,
  Zap,
  Settings,
  Eye,
  Trash2,
  Power,
  MessageSquare,
} from 'lucide-react'
import { mockClients, mockWhatsAppInstances, mockClientAIConfigs } from '@/lib/mock-data'

export default function TenantsPage() {
  const [search, setSearch] = useState('')

  const filteredClients = mockClients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = mockClients.filter((c) => c.isActive).length
  const totalTokens = mockClients.reduce((sum, c) => sum + c.tokenBalance, 0)
  const totalInstances = mockWhatsAppInstances.length

  return (
    <DashboardLayout
      title="Tenant Management"
      description="Configure AI settings for each client"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tenants</p>
                  <p className="text-2xl font-bold">{mockClients.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-success">{activeCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <Power className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-bold">{(totalTokens / 1000).toFixed(0)}k</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <Zap className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">WA Instances</p>
                  <p className="text-2xl font-bold">{totalInstances}</p>
                </div>
                <div className="p-3 rounded-lg bg-info/10">
                  <MessageSquare className="w-5 h-5 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Actions */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-secondary border-border"
                />
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Tenant
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tenants Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">All Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Token Usage</TableHead>
                  <TableHead>AI Config</TableHead>
                  <TableHead>Instances</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const instances = mockWhatsAppInstances.filter(
                    (i) => i.clientId === client.id
                  )
                  const connectedInstances = instances.filter(
                    (i) => i.status === 'CONNECTED'
                  )
                  const config = mockClientAIConfigs.find(
                    (c) => c.clientId === client.id
                  )
                  const tokenPercentage =
                    (client.tokenBalance / client.tokenLimit) * 100

                  return (
                    <TableRow
                      key={client.id}
                      className="border-border hover:bg-secondary/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold">
                            {client.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {client.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            client.isActive
                              ? 'bg-success/10 text-success border-success/20'
                              : 'bg-error/10 text-error border-error/20'
                          }
                        >
                          {client.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 w-32">
                          <div className="flex items-center justify-between text-xs">
                            <span>{(client.tokenBalance / 1000).toFixed(1)}k</span>
                            <span className="text-muted-foreground">
                              / {(client.tokenLimit / 1000).toFixed(0)}k
                            </span>
                          </div>
                          <Progress
                            value={tokenPercentage}
                            className="h-1.5"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {config ? (
                          <div className="space-y-1">
                            <Badge variant="outline" className="bg-secondary text-xs">
                              {config.modelId}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              Temp: {config.temperature}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                            Not configured
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-success font-medium">
                            {connectedInstances.length}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span>{instances.length}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/tenants/${client.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Settings className="w-4 h-4 mr-2" />
                                Configure AI
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Manage Instances
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {filteredClients.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tenants found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
