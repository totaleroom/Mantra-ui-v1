'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Brain,
  MessageSquare,
  Plug,
  Inbox,
  Users,
  Activity,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { useTheme } from 'next-themes'

type Cmd = {
  id: string
  label: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  run: () => void | Promise<void>
}

/**
 * Global command palette. Opens with Cmd/Ctrl+K anywhere in the app.
 * Provides: route navigation, theme toggle, quick logout.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { setTheme } = useTheme()

  // Keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (path: string) => () => {
    setOpen(false)
    router.push(path)
  }

  const navigation: Cmd[] = [
    { id: 'nav-overview', label: 'Overview', icon: LayoutDashboard, run: go('/') },
    { id: 'nav-ai-hub', label: 'AI Hub', icon: Brain, run: go('/ai-hub') },
    { id: 'nav-whatsapp', label: 'WhatsApp Gateway', icon: MessageSquare, run: go('/whatsapp') },
    { id: 'nav-providers', label: 'WA Providers', hint: 'Admin', icon: Plug, run: go('/dashboard/providers') },
    { id: 'nav-inbox', label: 'Omniscient Inbox', icon: Inbox, run: go('/inbox') },
    { id: 'nav-tenants', label: 'Tenants', icon: Users, run: go('/tenants') },
    { id: 'nav-diagnosis', label: 'System Diagnosis', hint: 'Admin', icon: Activity, run: go('/diagnosis') },
    { id: 'nav-settings', label: 'Settings', hint: 'Admin', icon: Settings, run: go('/settings') },
  ]

  const themeActions: Cmd[] = [
    { id: 'theme-light', label: 'Switch to light theme', icon: Sun, run: () => { setTheme('light'); setOpen(false) } },
    { id: 'theme-dark',  label: 'Switch to dark theme',  icon: Moon, run: () => { setTheme('dark'); setOpen(false) } },
    { id: 'theme-system',label: 'Use system theme',      icon: Monitor, run: () => { setTheme('system'); setOpen(false) } },
  ]

  const session: Cmd[] = [
    {
      id: 'logout',
      label: 'Sign out',
      icon: LogOut,
      run: async () => {
        setOpen(false)
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch {
          // ignore — cookie will expire anyway
        }
        router.push('/login')
        router.refresh()
      },
    },
  ]

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {navigation.map((c) => {
            const Icon = c.icon
            return (
              <CommandItem key={c.id} onSelect={c.run} value={c.label}>
                <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="flex-1">{c.label}</span>
                {c.hint && <CommandShortcut>{c.hint}</CommandShortcut>}
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Appearance">
          {themeActions.map((c) => {
            const Icon = c.icon
            return (
              <CommandItem key={c.id} onSelect={c.run} value={c.label}>
                <Icon className="w-4 h-4 mr-2 text-muted-foreground" />
                <span>{c.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Session">
          {session.map((c) => {
            const Icon = c.icon
            return (
              <CommandItem key={c.id} onSelect={c.run} value={c.label} className="text-destructive">
                <Icon className="w-4 h-4 mr-2" />
                <span>{c.label}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
