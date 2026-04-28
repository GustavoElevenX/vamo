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
  Newspaper,
  RefreshCw,
  Mail,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_CONFIG, ROLE_LABELS } from '@/lib/constants'
import type { NavGroup } from '@/lib/constants'
import type { UserRole } from '@/types'
import { useAlertsCount } from '@/hooks/use-alerts-count'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, Target, Trophy, Medal, ShoppingBag, Users,
  ClipboardCheck, Settings, Building2, FileText, BarChart3, Sparkles,
  DollarSign, HeartPulse, FileSearch, Rocket, Zap, Plug, Search, User,
  ClipboardList, Star, Link: LinkIcon, Gamepad2, TrendingUp, Filter,
  PieChart, CheckSquare, Bot, Megaphone, Terminal, Wrench, Newspaper,
  RefreshCw, Mail,
}

interface SidebarProps {
  role: UserRole
  userName?: string
  onNavigate?: () => void
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )
}

export function Sidebar({ role, userName, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const groups = NAV_CONFIG[role] || NAV_CONFIG.seller
  const alertsCount = useAlertsCount(role === 'manager' || role === 'admin')

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

      {/* ── Logo ── */}
      <div className="px-4 py-4 border-b border-sidebar-border/40">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="h-8 w-8 object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black tracking-tight text-sidebar-foreground leading-none">
              VAMO
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 leading-none mt-0.5 truncate font-medium uppercase tracking-wider">
              {ROLE_LABELS[role]}{userName ? ` · ${userName}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {groups.map((group) => {
          const groupActive = isGroupActive(group, pathname)
          const isCollapsed = collapsed[group.key] && !groupActive

          return (
            <div key={group.key} className="mb-1">

              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md',
                  'transition-colors duration-150 group',
                  'hover:bg-black/5 dark:hover:bg-white/5',
                  groupActive ? 'text-primary' : 'text-foreground/30 dark:text-foreground/25'
                )}
              >
                {group.prefix && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold shrink-0 tabular-nums',
                      groupActive
                        ? 'bg-primary/15 text-primary'
                        : 'bg-black/8 text-foreground/35 dark:bg-white/8 dark:text-foreground/30'
                    )}
                  >
                    {group.prefix}
                  </span>
                )}
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-widest truncate flex-1 text-left',
                    groupActive ? 'text-primary' : 'text-foreground/30 dark:text-foreground/25'
                  )}
                >
                  {group.label}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 shrink-0 transition-transform duration-200 opacity-35',
                    isCollapsed && '-rotate-90'
                  )}
                />
              </button>

              {/* Group Items */}
              {!isCollapsed && (
                <div className="flex flex-col gap-px pl-0.5">
                  {group.items.map((item) => {
                    const Icon = iconMap[item.icon]
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/' &&
                        item.href.split('/').length > 2 &&
                        pathname.startsWith(item.href + '/'))

                    /* Special Chat IA item */
                    if (item.href === '/chat-ia') {
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onNavigate}
                          className={cn('vamo-chat-nav-item', isActive && 'active')}
                        >
                          <span className="vamo-chat-nav-icon">
                            <Sparkles className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate flex-1 text-[13px]">Converse com VAMO IA</span>
                          <span className="vamo-chat-nav-badge">IA</span>
                        </Link>
                      )
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn('nav-item', isActive && 'active')}
                      >
                        {Icon && (
                          <Icon
                            className={cn(
                              'nav-icon h-[15px] w-[15px] shrink-0',
                              isActive && 'opacity-100'
                            )}
                          />
                        )}
                        <span className="truncate flex-1">{item.label}</span>

                        {/* Alert badge */}
                        {item.badge === 'alert' && alertsCount > 0 && (
                          <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shrink-0">
                            {alertsCount > 9 ? '9+' : alertsCount}
                          </span>
                        )}
                        {item.badge === 'alert' && alertsCount === 0 && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-muted-foreground/20 shrink-0" />
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

      {/* ── Footer ── */}
      <div className="px-4 py-3 border-t border-sidebar-border/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <p className="text-[10px] text-sidebar-foreground/35 font-semibold tracking-wide uppercase">Online</p>
          </div>
          <p className="text-[9px] text-sidebar-foreground/20 font-medium">v1.0</p>
        </div>
      </div>
    </div>
  )
}
