'use client'

import { Menu, LogOut, User as UserIcon } from 'lucide-react'
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
import { XpBar } from '@/components/gamification/xp-bar'
import { APP_NAME, ROLE_LABELS } from '@/lib/constants'
import type { User, UserXp, XpLevel } from '@/types'

interface TopbarProps {
  user: User
  userXp?: UserXp | null
  currentLevel?: XpLevel | null
  nextLevel?: XpLevel | null
  onMenuToggle: () => void
  onSignOut: () => void
}

export function Topbar({ user, userXp, currentLevel, nextLevel, onMenuToggle, onSignOut }: TopbarProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold hidden sm:block">{APP_NAME}</h1>
      </div>

      <div className="flex items-center gap-3">
        {userXp && user.role !== 'admin' && (
          <div className="hidden sm:block w-40">
            <XpBar
              currentXp={userXp.total_xp}
              currentLevelXp={currentLevel?.xp_required ?? 0}
              nextLevelXp={nextLevel?.xp_required ?? 100}
              level={userXp.current_level}
            />
          </div>
        )}

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 px-2 rounded-md hover:bg-accent"
            render={<button type="button" />}
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={user.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden md:inline text-sm">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2"
              render={<a href="/configuracoes/perfil" />}
            >
              <UserIcon className="h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSignOut}
              className="flex items-center gap-2 text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
