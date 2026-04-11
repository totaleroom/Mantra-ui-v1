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
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      <NavIcon className="w-5 h-5 shrink-0" />
      {!collapsed && (
        <span className="flex-1">{item.name}</span>
      )}
      {!collapsed && item.adminOnly && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning border-warning/30">
          <Shield className="w-2.5 h-2.5 mr-0.5" />
          Admin
        </Badge>
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
          'hidden md:flex flex-col h-screen bg-card border-r border-border transition-all duration-300',
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
      <SheetContent side="left" className="w-72 p-0 bg-card border-border">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-sm font-semibold text-foreground">Mantra AI</span>
            <span className="text-xs text-muted-foreground">Command Center</span>
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
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Version 2.0 Production
          </p>
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
