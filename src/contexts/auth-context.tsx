'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as AppUser } from '@/types'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchOrCreateAppUser(
  supabase: ReturnType<typeof createClient>,
  supabaseUser: SupabaseUser
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', supabaseUser.id)
    .maybeSingle()

  if (data) return data as AppUser

  if (!data && (error === null || error?.code === 'PGRST116')) {
    const name = supabaseUser.user_metadata?.name || supabaseUser.email || 'Usuário'
    const role = supabaseUser.user_metadata?.role || 'admin'

    const { data: created } = await supabase
      .from('users')
      .insert({
        auth_id: supabaseUser.id,
        name,
        email: supabaseUser.email!,
        role,
      })
      .select()
      .maybeSingle()

    return created as AppUser | null
  }

  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let mounted = true
    let initialResolved = false

    const resolveUser = async (supabaseUser: SupabaseUser | null) => {
      if (!mounted) return
      if (!supabaseUser) {
        setAppUser(null)
        return
      }
      try {
        const user = await fetchOrCreateAppUser(supabase, supabaseUser)
        if (mounted) setAppUser(user)
      } catch (err) {
        console.error('[Auth] Erro ao buscar usuário, tentando novamente...', err)
        // Retry once — free tier DB can fail intermittently
        try {
          const user = await fetchOrCreateAppUser(supabase, supabaseUser)
          if (mounted) setAppUser(user)
        } catch {
          if (mounted) setAppUser(null)
        }
      }
    }

    // 1) Restore session from cookies explicitly via getSession() (local, fast).
    //    This is more reliable than waiting for INITIAL_SESSION on page refresh.
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        await resolveUser(session?.user ?? null)
      } catch (err) {
        console.error('[Auth] Erro ao restaurar sessão:', err)
      } finally {
        if (!initialResolved && mounted) {
          initialResolved = true
          setLoading(false)
        }
      }
    }

    initSession()

    // 2) Listen for subsequent auth events (sign in, sign out, token refresh).
    //    Skip INITIAL_SESSION since initSession() already handled it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'INITIAL_SESSION') return // already handled above
        await resolveUser(session?.user ?? null)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabaseRef.current.auth.signOut()
    setAppUser(null)
  }

  return (
    <AuthContext.Provider value={{ user: appUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
