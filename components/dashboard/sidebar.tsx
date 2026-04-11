'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Brain,
  MessageSquare,
  Inbox,
  Users,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'AI Hub', href: '/ai-hub', icon: Brain },
  { name: 'WhatsApp Gateway', href: '/whatsapp', icon: MessageSquare },
  { name: 'Omniscient Inbox', href: '/inbox', icon: Inbox },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'System Diagnosis', href: '/diagnosis', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-screen bg-card border-r border-border transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 px-4 border-b border-border',
          collapsed ? 'justify-center' : 'gap-3'
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Mantra AI</span>
              <span className="text-xs text-muted-foreground">Command Center</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const NavIcon = item.icon

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <NavIcon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover text-popover-foreground">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.name}>{linkContent}</div>
          })}
        </nav>

        {/* Collapse button */}
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn('w-full', collapsed ? 'px-2' : 'justify-start')}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
