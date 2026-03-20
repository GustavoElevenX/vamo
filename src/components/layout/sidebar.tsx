'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Trophy,
  Medal,
  ShoppingBag,
  Users,
  ClipboardCheck,
  Settings,
  Building2,
  FileText,
  BarChart3,
  Sparkles,
  DollarSign,
  HeartPulse,
  FileSearch,
  Rocket,
  Zap,
  Plug,
  Search,
  User,
  ClipboardList,
  Star,
  Link as LinkIcon,
  Gamepad2,
  TrendingUp,
  Filter,
  PieChart,
  CheckSquare,
  Bot,
  Megaphone,
  Terminal,
  Wrench,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_CONFIG, ROLE_LABELS } from '@/lib/constants'
import type { NavGroup } from '@/lib/constants'
import type { UserRole } from '@/types'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Target,
  Trophy,
  Medal,
  ShoppingBag,
  Users,
  ClipboardCheck,
  Settings,
  Building2,
  FileText,
  BarChart3,
  Sparkles,
  DollarSign,
  HeartPulse,
  FileSearch,
  Rocket,
  Zap,
  Plug,
  Search,
  User,
  ClipboardList,
  Star,
  Link: LinkIcon,
  Gamepad2,
  TrendingUp,
  Filter,
  PieChart,
  CheckSquare,
  Bot,
  Megaphone,
  Terminal,
  Wrench,
}

interface SidebarProps {
  role: UserRole
  userName?: string
  onNavigate?: () => void
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some(
    (item) =>
      pathname === item.href ||
      pathname.startsWith(item.href + '/')
  )
}

export function Sidebar({ role, userName, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const groups = NAV_CONFIG[role] || NAV_CONFIG.seller

  // Initialize collapsed state: only the active group is expanded
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const group of groups) {
      initial[group.key] = !isGroupActive(group, pathname)
    }
    return initial
  })

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg motiva-gradient flex items-center justify-center shadow-sm">
            <Zap className="h-4 w-4 text-white fill-white" />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-foreground leading-none">MOTIVA</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
              {ROLE_LABELS[role]}{userName ? ` · ${userName}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {groups.map((group) => {
          const groupActive = isGroupActive(group, pathname)
          const isCollapsed = collapsed[group.key] && !groupActive

          return (
            <div key={group.key} className="mb-2">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 mb-0.5 rounded-md transition-colors',
                  'hover:bg-accent/50',
                  groupActive && 'text-primary'
                )}
              >
                {group.prefix && (
                  <span
                    className={cn(
                      'flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold shrink-0',
                      groupActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {group.prefix}
                  </span>
                )}
                <span
                  className={cn(
                    'text-[11px] font-semibold uppercase tracking-wider truncate',
                    groupActive ? 'text-primary' : 'text-muted-foreground/70'
                  )}
                >
                  {group.label}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 ml-auto shrink-0 text-muted-foreground/50 transition-transform duration-200',
                    isCollapsed && '-rotate-90'
                  )}
                />
              </button>

              {/* Group Items */}
              {!isCollapsed && (
                <div className="flex flex-col gap-0.5 ml-1">
                  {group.items.map((item) => {
                    const Icon = iconMap[item.icon]
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/' &&
                        item.href.split('/').length > 2 &&
                        pathname.startsWith(item.href + '/'))

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        {Icon && (
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-colors',
                              isActive
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground/70 group-hover:text-accent-foreground'
                            )}
                          />
                        )}
                        <span className="truncate">{item.label}</span>
                        {item.badge === 'alert' && (
                          <span className="ml-auto h-2 w-2 rounded-full bg-red-500 shrink-0" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-sidebar-border">
        <p className="text-[10px] text-muted-foreground/50 font-medium">MOTIVA v1.0</p>
      </div>
    </div>
  )
}
