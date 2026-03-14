'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { APP_NAME, NAV_ITEMS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  Building2,
  ClipboardCheck,
  FileText,
  BarChart3,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  Building2,
  ClipboardCheck,
  FileText,
  BarChart3,
  LayoutDashboard,
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    router.push('/dashboard')
    return null
  }

  const items = NAV_ITEMS.admin

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r bg-card">
        <div className="border-b p-4">
          <h2 className="text-lg font-bold">{APP_NAME}</h2>
          <p className="text-xs text-muted-foreground">Painel Admin</p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => {
            const Icon = iconMap[item.icon]
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
