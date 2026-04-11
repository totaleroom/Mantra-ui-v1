'use client'

import { ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

interface DashboardLayoutProps {
  children: ReactNode
  title: string
  description?: string
}

export function DashboardLayout({ children, title, description }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title={title} description={description} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 grid-pattern">
          {/* Mobile spacing for floating menu button */}
          <div className="md:hidden h-4" />
          {children}
        </main>
      </div>
    </div>
  )
}
