'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Brain,
  MessageSquare,
  Plug,
  Inbox,
  Users,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Menu,
  X,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'AI Hub', href: '/ai-hub', icon: Brain },
  { name: 'WhatsApp Gateway', href: '/whatsapp', icon: MessageSquare },
  { name: 'WA Providers', href: '/dashboard/providers', icon: Plug, adminOnly: true },
  { name: 'Omniscient Inbox', href: '/inbox', icon: Inbox },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'System Diagnosis', href: '/diagnosis', icon: Activity, adminOnly: true },
  { name: 'Settings', href: '/settings', icon: Settings, adminOnly: true },
]

interface NavLinkProps {
  item: typeof navigation[0]
  isActive: boolean
  collapsed?: boolean
  onClick?: () => void
}

function NavLink({ item, isActive, collapsed = false, onClick }: NavLinkProps) {
  const NavIcon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      <NavIcon
        className={cn(
          'w-[18px] h-[18px] shrink-0 transition-colors',
          isActive ? 'text-foreground' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground'
        )}
        strokeWidth={isActive ? 2 : 1.75}
      />
      {!collapsed && <span className="flex-1 truncate tracking-[-0.01em]">{item.name}</span>}
      {/* Red dot active indicator (Nothing-OS style) */}
      {!collapsed && isActive && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-[var(--accent-red)] shrink-0"
        />
      )}
      {!collapsed && !isActive && item.adminOnly && (
        <Shield className="w-3 h-3 text-[var(--fg-subtle)]" strokeWidth={1.5} />
      )}
    </Link>
  )
}

// Desktop Sidebar
function DesktopSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-[width] duration-300',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Brand header */}
        <div className={cn(
          'flex items-center h-14 px-4 border-b border-sidebar-border',
          collapsed ? 'justify-center' : 'gap-2.5'
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground shadow-soft">
            <Zap className="w-4 h-4 text-background" strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[13.5px] font-semibold text-foreground tracking-[-0.015em] leading-tight">Mantra AI</span>
              <span className="text-[10px] text-[var(--fg-subtle)] leading-tight">COMMAND CENTER</span>
            </div>
          )}
        </div>

        {/* Section label — Nothing mono style */}
        {!collapsed && (
          <div className="px-5 pt-5 pb-2">
            <span className="label-mono">Navigation</span>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn('flex-1 space-y-0.5 overflow-y-auto', collapsed ? 'p-2 pt-4' : 'px-3 pb-3')}>
          {navigation.map((item) => {
            const isActive = pathname === item.href

            if (collapsed) {
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    <div>
                      <NavLink item={item} isActive={isActive} collapsed />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover text-popover-foreground">
                    <div className="flex items-center gap-2">
                      {item.name}
                      {item.adminOnly && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-warning/10 text-warning border-warning/30">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <NavLink key={item.name} item={item} isActive={isActive} />
          })}
        </nav>

        {/* Collapse button */}
        <div className="p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn('w-full h-8 text-[12px] text-[var(--fg-muted)] hover:text-foreground', collapsed ? 'px-2' : 'justify-start')}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <>
                <ChevronLeft className="w-3.5 h-3.5 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}

// Mobile Sidebar (Sheet)
function MobileSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden fixed top-3 left-3 z-50 bg-card border border-border shadow-lg"
        >
          <Menu className="w-5 h-5" />
          <span className="sr-only">Open navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        {/* Brand header */}
        <div className="flex items-center h-14 px-4 border-b border-sidebar-border gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground">
            <Zap className="w-4 h-4 text-background" strokeWidth={2.25} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13.5px] font-semibold text-foreground tracking-[-0.015em] leading-tight">Mantra AI</span>
            <span className="text-[10px] text-[var(--fg-subtle)] leading-tight">COMMAND CENTER</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setOpen(false)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="px-5 pt-5 pb-2">
          <span className="label-mono">Navigation</span>
        </div>
        <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <NavLink 
                key={item.name} 
                item={item} 
                isActive={isActive} 
                onClick={() => setOpen(false)}
              />
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <p className="label-mono text-center">v2.0 · production</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  )
}
