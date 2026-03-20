'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { NAV_CONFIG, ROLE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  Building2,
  ClipboardCheck,
  FileText,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'

const iconMap: Record<string, LucideIcon> = {
  Building2,
  ClipboardCheck,
  FileText,
  BarChart3,
  LayoutDashboard,
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user || user.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [user, loading])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return null
  }

  const items = NAV_CONFIG.admin?.[0]?.items ?? []

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const navContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg motiva-gradient flex items-center justify-center shadow-sm">
            <Zap className="h-4 w-4 text-white fill-white" />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-foreground leading-none">MOTIVA</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">Administração</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Admin
        </p>
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = iconMap[item.icon]
            // Use prefix match only for paths with depth > 1 (e.g. /admin/clientes but not /admin)
            const isActive =
              pathname === item.href ||
              (item.href.split('/').length > 2 && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {Icon && (
                  <Icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground/70 group-hover:text-accent-foreground'
                  )} />
                )}
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <div className="px-4 py-3 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground/50 font-medium">MOTIVA v1.0</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-56 lg:flex-col border-r border-border/50 bg-card/50">
        {navContent}
      </aside>

      {/* Mobile Nav */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 p-0">
          {navContent}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground">Painel Administrativo</span>
          </div>

          <div className="flex items-center gap-3">
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
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
