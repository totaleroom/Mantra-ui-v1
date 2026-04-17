'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Search, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { NotificationsPopover } from '@/components/dashboard/notifications-popover'
import { useSession, getInitials, getRoleLabel } from '@/hooks/use-session'
import { toast } from 'sonner'

interface HeaderProps {
  title: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const router = useRouter()
  const { session, isLoading } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent))
    }
  }, [])

  const openPalette = () => {
    // Synthesize the same shortcut CommandPalette listens for.
    const evt = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
    })
    window.dispatchEvent(evt)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('Signed out successfully')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('Failed to sign out')
      setLoggingOut(false)
    }
  }

  const displayEmail = session?.email || (isLoading ? '' : 'Not signed in')
  const displayRole = getRoleLabel(session?.role)
  const initials = getInitials(session?.email || '?')

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Command palette trigger — replaces static search input */}
        <button
          type="button"
          onClick={openPalette}
          className="hidden md:inline-flex items-center gap-2 w-64 px-3 py-2 text-sm rounded-md border border-border bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          aria-label="Open command palette"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Search or run command…</span>
          <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[10px] text-muted-foreground">
            {isMac ? '⌘' : 'Ctrl'}
            <span>K</span>
          </kbd>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationsPopover />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2" aria-label="User menu">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium" suppressHydrationWarning>{displayRole}</span>
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {displayEmail}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-semibold">{displayRole}</span>
              <span className="text-xs font-normal text-muted-foreground" suppressHydrationWarning>
                {displayEmail}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive cursor-pointer focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault()
                handleLogout()
              }}
              disabled={loggingOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {loggingOut ? 'Signing out…' : 'Log out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
