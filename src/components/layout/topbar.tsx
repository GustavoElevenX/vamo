'use client'

import { Menu, LogOut, User as UserIcon, ChevronDown, Zap, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from './theme-toggle'
import { NotificationsBell } from './notifications-bell'
import { XpBar } from '@/components/gamification/xp-bar'
import { ROLE_LABELS } from '@/lib/constants'
import type { User, UserXp, XpLevel } from '@/types'

interface TopbarProps {
  user: User
  userXp?: UserXp | null
  currentLevel?: XpLevel | null
  nextLevel?: XpLevel | null
  onMenuToggle: () => void
  onSignOut: () => void
}

const rolePillClasses: Record<string, string> = {
  admin:   'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  manager: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  seller:  'bg-primary/10 text-primary',
}

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  const firstName = name.split(' ')[0]
  if (hour < 12) return `Bom dia, ${firstName}`
  if (hour < 18) return `Boa tarde, ${firstName}`
  return `Boa noite, ${firstName}`
}

export function Topbar({ user, userXp, currentLevel, nextLevel, onMenuToggle, onSignOut }: TopbarProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="glass-topbar sticky top-0 z-40 flex items-center justify-between px-4 gap-4 topbar-border" style={{ height: 60 }}>

      {/* ── Left ── */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 h-8 w-8 rounded-lg hover:bg-accent/60 transition-colors"
          onClick={onMenuToggle}
        >
          <Menu className="h-4 w-4" />
        </Button>

        {/* Saudação */}
        <p className="hidden md:block text-[14px] font-semibold text-foreground/80 truncate">
          {getGreeting(user.name)}
        </p>

        {/* Pills de status */}
        {userXp && user.role !== 'admin' && (
          <div className="hidden sm:flex items-center gap-2 animate-fade-in">
            {/* Streak pill (amber) */}
            {userXp.current_streak > 0 && (
              <div className="streak-pill">
                <Flame className="h-3 w-3" />
                {userXp.current_streak}d
              </div>
            )}

            {/* Level pill (green) */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border"
              style={{
                background: 'oklch(0.45 0.18 145 / 0.1)',
                borderColor: 'oklch(0.45 0.18 145 / 0.2)',
              }}
            >
              <Zap className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-bold text-primary tabular-nums">
                Nv. {userXp.current_level}
              </span>
            </div>

            {/* XP Bar */}
            <div className="hidden lg:block w-28">
              <XpBar
                currentXp={userXp.total_xp}
                currentLevelXp={currentLevel?.xp_required ?? 0}
                nextLevelXp={nextLevel?.xp_required ?? 100}
                level={userXp.current_level}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Right ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {user.role === 'seller' && <NotificationsBell />}
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger render={<button type="button" />} className="topbar-user-trigger" aria-label="Menu do usuário">
              <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                <AvatarImage src={user.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold leading-tight text-foreground">
                  {user.name.split(' ')[0]}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
              <ChevronDown className="hidden md:block h-3.5 w-3.5 text-muted-foreground/60" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 animate-scale-in">
            {/* User info header */}
            <div className="px-3 py-2.5 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                  <AvatarImage src={user.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{user.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-px rounded-full font-semibold ${rolePillClasses[user.role] ?? rolePillClasses.seller}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                    {userXp && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {userXp.total_xp.toLocaleString()} pts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DropdownMenuItem
              className="flex items-center gap-2 mx-1 my-1 rounded-md cursor-pointer"
              render={<a href="/configuracoes/perfil" />}
            >
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              Meu Perfil
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={onSignOut}
              className="flex items-center gap-2 mx-1 mb-1 rounded-md text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
