'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import type { UserXp, XpLevel } from '@/types'
import { APP_NAME } from '@/lib/constants'

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
  const supabase = createClient()

  // Redirect in effect to avoid setState-during-render warning
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (!user.organization_id) {
      router.push('/onboarding')
    }
  }, [user, loading])

  useEffect(() => {
    if (!user) return
    if (!user.organization_id) return

    const fetchXp = async () => {
      const { data: xp } = await supabase
        .from('user_xp')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (xp) {
        setUserXp(xp)

        const { data: levels } = await supabase
          .from('xp_levels')
          .select('*')
          .eq('organization_id', user.organization_id)
          .order('level', { ascending: true })

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
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r bg-card">
        <div className="border-b p-4">
          <h2 className="text-lg font-bold">{APP_NAME}</h2>
        </div>
        <Sidebar role={user.role} />
      </aside>

      {/* Mobile Nav */}
      <MobileNav
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        role={user.role}
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
