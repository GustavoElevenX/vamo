'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import {
  MANAGER_ONLY_ROUTES,
  SELLER_ONLY_ROUTES,
  DEVELOPER_ONLY_ROUTES,
  ADMIN_ONLY_ROUTES,
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
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [currentLevel, setCurrentLevel] = useState<XpLevel | null>(null)
  const [nextLevel, setNextLevel] = useState<XpLevel | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabaseRef = useRef(createClient())

  // Redirect in effect to avoid setState-during-render warning
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (!user.organization_id) {
      router.push('/onboarding')
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
      const [{ data: xp }, { data: levels }] = await Promise.all([
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

      if (xp) {
        setUserXp(xp)
        if (levels) {
          const curr = levels.find((l) => l.level === xp.current_level)
          const next = levels.find((l) => l.level === xp.current_level + 1)
          setCurrentLevel(curr ?? null)
          setNextLevel(next ?? null)
        }
      }
    }

    fetchXp()
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
    return null
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
