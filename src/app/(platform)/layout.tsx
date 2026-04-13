'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCached, setCache } from '@/lib/cache'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { useAuth } from '@/hooks/use-auth'
import { DailyCheckinModal } from '@/components/checkin/daily-checkin-modal'
import { ChatFAB } from '@/components/ai/chat-fab'
import { createClient } from '@/lib/supabase/client'
import {
  MANAGER_ONLY_ROUTES,
  SELLER_ONLY_ROUTES,
  DEVELOPER_ONLY_ROUTES,
  ADMIN_ONLY_ROUTES,
  CONSULTANT_ONLY_ROUTES,
  ROLE_HOME,
} from '@/lib/constants'
import type { UserXp, XpLevel } from '@/types'

function isRouteMatch(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const cachedXp = useRef(getCached<{ xp: UserXp; curr: XpLevel | null; next: XpLevel | null }>('layout-xp'))
  const [userXp, setUserXp] = useState<UserXp | null>(cachedXp.current?.xp ?? null)
  const [currentLevel, setCurrentLevel] = useState<XpLevel | null>(cachedXp.current?.curr ?? null)
  const [nextLevel, setNextLevel] = useState<XpLevel | null>(cachedXp.current?.next ?? null)
  const router = useRouter()
  const pathname = usePathname()
  const supabaseRef = useRef(createClient())

  // Redirect in effect to avoid setState-during-render warning
  useEffect(() => {
    if (loading) return
    if (!user) {
      window.location.href = '/login'
      return
    }
    if (!user.organization_id) {
      window.location.href = '/onboarding'
      return
    }

    const role = user.role
    const home = ROLE_HOME[role] || '/dashboard'

    // Role-based route protection
    if (role === 'seller') {
      if (isRouteMatch(pathname, MANAGER_ONLY_ROUTES) ||
          isRouteMatch(pathname, DEVELOPER_ONLY_ROUTES) ||
          isRouteMatch(pathname, ADMIN_ONLY_ROUTES)) {
        router.push(home)
        return
      }
    }

    if (role === 'manager') {
      if (isRouteMatch(pathname, SELLER_ONLY_ROUTES) ||
          isRouteMatch(pathname, DEVELOPER_ONLY_ROUTES) ||
          isRouteMatch(pathname, ADMIN_ONLY_ROUTES)) {
        router.push(home)
        return
      }
    }

    if (role === 'developer') {
      if (isRouteMatch(pathname, MANAGER_ONLY_ROUTES) ||
          isRouteMatch(pathname, SELLER_ONLY_ROUTES) ||
          isRouteMatch(pathname, ADMIN_ONLY_ROUTES)) {
        router.push(home)
        return
      }
    }

    if (role !== 'admin' && isRouteMatch(pathname, ADMIN_ONLY_ROUTES)) {
      router.push(home)
      return
    }

    // Redirect /dashboard to role-specific home
    if (pathname === '/dashboard') {
      router.push(home)
      return
    }

    // Redirect old routes to new structure
    const oldRouteRedirects: Record<string, string | Record<string, string>> = {
      '/equipe': '/monitoramento/equipe',
      '/saude-equipe': '/monitoramento/saude-equipe',
      '/comissionamento': '/monitoramento/comissionamento',
      '/meus-ganhos': '/ganhos/comissao',
      '/loja': '/desenvolvimento/loja',
      '/conquistas': '/desenvolvimento/conquistas',
      '/kpis': '/performance/indicadores',
      '/criterios': '/configuracao/kpis',
      '/missoes': role === 'seller' ? '/performance/missoes' : '/objetivos/plano-acao',
      '/perfil-comportamental': role === 'seller' ? '/desenvolvimento/feedback-ia' : '/diagnostico/individual',
      '/ranking': home,
      '/desafios': home,
      '/padronizacao': home,
    }

    for (const [oldRoute, newRoute] of Object.entries(oldRouteRedirects)) {
      if (pathname === oldRoute || pathname.startsWith(oldRoute + '/')) {
        const target = typeof newRoute === 'string' ? newRoute : home
        router.push(target)
        return
      }
    }
  }, [user, loading, pathname])

  useEffect(() => {
    if (!user) return
    if (!user.organization_id) return

    const fetchXp = async () => {
      const supabase = supabaseRef.current
      const results = await Promise.allSettled([
        supabase
          .from('user_xp')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('xp_levels')
          .select('*')
          .eq('organization_id', user.organization_id)
          .order('level', { ascending: true }),
      ])

      const xpResult = results[0].status === 'fulfilled' ? results[0].value : null
      const levelsResult = results[1].status === 'fulfilled' ? results[1].value : null
      const xp = xpResult?.data
      const levels = levelsResult?.data

      if (xp) {
        setUserXp(xp)
        const curr = levels?.find((l: any) => l.level === xp.current_level) ?? null
        const next = levels?.find((l: any) => l.level === xp.current_level + 1) ?? null
        setCurrentLevel(curr)
        setNextLevel(next)
        setCache('layout-xp', { xp, curr, next }, 5 * 60 * 1000)
      }
    }

    fetchXp().catch(() => {})
  }, [user])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user || !user.organization_id) {
    // Show loading spinner while the useEffect redirect fires.
    // Previously this returned null, causing a black screen.
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    )
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Check-in Diário — aparece 1x/dia para vendedores */}
      <DailyCheckinModal />

      {/* Chat IA FAB — botão flutuante visível em todas as páginas */}
      <ChatFAB />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r border-white/8 bg-sidebar">
        <Sidebar role={user.role} userName={user.name.split(' ')[0]} />
      </aside>

      {/* Mobile Nav */}
      <MobileNav
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        role={user.role}
        userName={user.name.split(' ')[0]}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          user={user}
          userXp={userXp}
          currentLevel={currentLevel}
          nextLevel={nextLevel}
          onMenuToggle={() => setMobileOpen(true)}
          onSignOut={handleSignOut}
        />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
