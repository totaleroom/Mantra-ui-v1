'use client'

import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications, formatRelativeTime, type NotificationType } from '@/hooks/use-notifications'

const iconMap: Record<NotificationType, typeof Bell> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
}

const colorMap: Record<NotificationType, string> = {
  info: 'text-info bg-info/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  error: 'text-error bg-error/10',
}

export function NotificationsPopover() {
  const router = useRouter()
  const { items, unreadCount, hydrated, markAsRead, markAllAsRead, clearAll } = useNotifications()

  const handleClick = (id: string, href?: string) => {
    markAsRead(id)
    if (href) router.push(href)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {hydrated && unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              aria-label="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={clearAll}
              disabled={items.length === 0}
              aria-label="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No notifications</p>
              <p className="text-xs mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = iconMap[n.type]
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n.id, n.href)}
                      className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex gap-3 ${
                        !n.read ? 'bg-accent/20' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorMap[n.type]}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{n.title}</p>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {n.description}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatRelativeTime(n.timestamp)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
