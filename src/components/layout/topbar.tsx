'use client'

import { Menu, LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from './theme-toggle'
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

const roleColors: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  seller: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}

export function Topbar({ user, userXp, currentLevel, nextLevel, onMenuToggle, onSignOut }: TopbarProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 backdrop-blur-md px-4 gap-4">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 h-8 w-8"
          onClick={onMenuToggle}
        >
          <Menu className="h-4.5 w-4.5" />
        </Button>

        {/* XP Bar */}
        {userXp && user.role !== 'admin' && (
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">
                {userXp.current_level}
              </span>
            </div>
            <div className="w-36">
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

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button type="button" />}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors outline-none"
          >
            <Avatar className="h-7 w-7 ring-2 ring-border">
              <AvatarImage src={user.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold leading-tight text-foreground">{user.name.split(' ')[0]}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{ROLE_LABELS[user.role]}</p>
            </div>
            <ChevronDown className="hidden md:block h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2.5 border-b border-border/50">
              <p className="text-sm font-semibold">{user.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-[10px] px-1.5 py-0 h-4 font-medium border-0 ${roleColors[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </Badge>
                {userXp && (
                  <span className="text-[10px] text-muted-foreground">{userXp.total_xp} XP</span>
                )}
              </div>
            </div>

            <DropdownMenuItem
              className="flex items-center gap-2 mx-1 my-1 rounded-md"
              render={<a href="/configuracoes/perfil" />}
            >
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              Meu Perfil
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={onSignOut}
              className="flex items-center gap-2 mx-1 mb-1 rounded-md text-destructive focus:text-destructive"
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
