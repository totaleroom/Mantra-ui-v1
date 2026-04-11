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
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} description={description} />
        <main className="flex-1 overflow-y-auto p-6 grid-pattern">
          {children}
        </main>
      </div>
    </div>
  )
}
