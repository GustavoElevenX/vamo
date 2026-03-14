'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Trophy,
  Swords,
  Medal,
  ShoppingBag,
  BookOpen,
  Users,
  ClipboardCheck,
  Settings,
  Building2,
  FileText,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import type { UserRole } from '@/types'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Target,
  Trophy,
  Swords,
  Medal,
  ShoppingBag,
  BookOpen,
  Users,
  ClipboardCheck,
  Settings,
  Building2,
  FileText,
  BarChart3,
}

interface SidebarProps {
  role: UserRole
  onNavigate?: () => void
}

export function Sidebar({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const items = NAV_ITEMS[role] || NAV_ITEMS.seller

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const Icon = iconMap[item.icon]
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
  )
}
