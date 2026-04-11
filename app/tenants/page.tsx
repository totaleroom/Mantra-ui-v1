'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
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
import { useTenants } from '@/hooks/use-tenant'
import { sanitizeMessage } from '@/lib/sanitize'

export default function TenantsPage() {
  const [search, setSearch] = useState('')
  const { data: tenants, isLoading } = useTenants()

  const clients = tenants?.clients || []
  const instances = tenants?.instances || []
  const configs = tenants?.configs || []

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = clients.filter((c) => c.isActive).length
  const totalTokens = clients.reduce((sum, c) => sum + c.tokenBalance, 0)
  const totalInstances = instances.length

  return (
    <DashboardLayout
      title="Tenant Management"
      description="Configure AI settings for each client"
    >
      <div className="space-y-4 md:space-y-6">
        {/* Stats - Responsive Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] md:text-sm text-muted-foreground">Total Tenants</p>
                  <p className="text-xl md:text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-6 md:h-8 w-8" /> : clients.length}
                  </p>
                </div>
                <div className="p-2 md:p-3 rounded-lg bg-primary/10">
                  <Users className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] md:text-sm text-muted-foreground">Active</p>
                  <p className="text-xl md:text-2xl font-bold text-success">
                    {isLoading ? <Skeleton className="h-6 md:h-8 w-8" /> : activeCount}
                  </p>
                </div>
                <div className="p-2 md:p-3 rounded-lg bg-success/10">
                  <Power className="w-4 h-4 md:w-5 md:h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] md:text-sm text-muted-foreground">Tokens</p>
                  <p className="text-xl md:text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-6 md:h-8 w-12" /> : `${(totalTokens / 1000).toFixed(0)}k`}
                  </p>
                </div>
                <div className="p-2 md:p-3 rounded-lg bg-warning/10">
                  <Zap className="w-4 h-4 md:w-5 md:h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 md:pt-6 px-3 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] md:text-sm text-muted-foreground">WA Instances</p>
                  <p className="text-xl md:text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-6 md:h-8 w-8" /> : totalInstances}
                  </p>
                </div>
                <div className="p-2 md:p-3 rounded-lg bg-info/10">
                  <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Actions */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 md:pt-6">
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-secondary border-border text-sm"
                />
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Tenant
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Table View */}
        <Card className="bg-card border-border hidden md:block">
          <CardHeader>
            <CardTitle className="text-base">All Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="min-w-[180px]">Tenant</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[150px]">Token Usage</TableHead>
                    <TableHead className="min-w-[150px]">AI Config</TableHead>
                    <TableHead className="min-w-[100px]">Instances</TableHead>
                    <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredClients.map((client) => {
                    const clientInstances = instances.filter((i) => i.clientId === client.id)
                    const connectedInstances = clientInstances.filter((i) => i.status === 'CONNECTED')
                    const config = configs.find((c) => c.clientId === client.id)
                    const tokenPercentage = (client.tokenBalance / client.tokenLimit) * 100

                    return (
                      <TableRow key={client.id} className="border-border hover:bg-secondary/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold">
                              {sanitizeMessage(client.name).charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{sanitizeMessage(client.name)}</p>
                              <p className="text-xs text-muted-foreground">ID: {client.id}</p>
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
                            <Progress value={tokenPercentage} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          {config ? (
                            <div className="space-y-1">
                              <Badge variant="outline" className="bg-secondary text-xs">
                                {sanitizeMessage(config.modelId)}
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
                            <span>{clientInstances.length}</span>
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
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {!isLoading && filteredClients.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tenants found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredClients.length > 0 ? (
            filteredClients.map((client) => {
              const clientInstances = instances.filter((i) => i.clientId === client.id)
              const connectedInstances = clientInstances.filter((i) => i.status === 'CONNECTED')
              const config = configs.find((c) => c.clientId === client.id)
              const tokenPercentage = (client.tokenBalance / client.tokenLimit) * 100

              return (
                <Card key={client.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold">
                          {sanitizeMessage(client.name).charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{sanitizeMessage(client.name)}</p>
                          <p className="text-xs text-muted-foreground">ID: {client.id}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          client.isActive
                            ? 'bg-success/10 text-success border-success/20 text-xs'
                            : 'bg-error/10 text-error border-error/20 text-xs'
                        }
                      >
                        {client.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Token Usage */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Token Usage</span>
                        <span>
                          {(client.tokenBalance / 1000).toFixed(1)}k / {(client.tokenLimit / 1000).toFixed(0)}k
                        </span>
                      </div>
                      <Progress value={tokenPercentage} className="h-1.5" />
                    </div>

                    {/* Info Row */}
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      {config ? (
                        <Badge variant="outline" className="bg-secondary text-xs">
                          {sanitizeMessage(config.modelId)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                          No AI Config
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-secondary text-xs">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        {connectedInstances.length}/{clientInstances.length} WA
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link href={`/tenants/${client.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          <Eye className="w-3 h-3 mr-1" />
                          View Details
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="px-2">
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
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No tenants found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
