'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as AppUser } from '@/types'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_CACHE_KEY = 'vamo_cached_user'

function getCachedUser(): AppUser | null {
  try {
    // Use localStorage so the cache survives tab/browser close.
    // sessionStorage is per-tab and is lost when the tab is closed,
    // which caused the black-screen bug on reopen.
    const raw = localStorage.getItem(USER_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppUser
  } catch {
    return null
  }
}

function setCachedUser(user: AppUser | null) {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_CACHE_KEY)
    }
  } catch { /* ignore — private browsing or quota */ }
}

async function fetchOrCreateAppUser(
  _supabase: ReturnType<typeof createClient>,
  _supabaseUser: SupabaseUser
): Promise<AppUser | null> {
  // Uses server-side API route with admin client to bypass RLS entirely.
  // This avoids the "infinite recursion detected in policy for relation 'users'" error
  // caused by consultant RLS policies referencing the users table.
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
  if (!res.ok) {
    console.error('[Auth] /api/auth/me respondeu com status', res.status)
    return null
  }
  const user = await res.json()
  if (user.error) {
    console.error('[Auth] /api/auth/me erro:', user.error)
    return null
  }
  return user as AppUser
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let mounted = true
    let initialResolved = false

    // Restore cached user instantly so pages render without waiting for DB.
    // This runs before initSession completes, eliminating the loading spinner
    // on page reload when we already have a cached user.
    const cached = getCachedUser()
    if (cached) {
      setAppUser(cached)
      setLoading(false)
      initialResolved = true
    }

    const resolveUser = async (supabaseUser: SupabaseUser | null) => {
      if (!mounted) return
      if (!supabaseUser) {
        setAppUser(null)
        setCachedUser(null)
        return
      }
      try {
        const user = await fetchOrCreateAppUser(supabase, supabaseUser)
        if (mounted) {
          if (user) {
            setAppUser(user)
            setCachedUser(user)
          }
          // If user is null (DB query failed) but we already have a cached/active user,
          // keep the existing one — don't clear state on transient DB errors.
          // This prevents the login→redirect→login loop on slow Supabase free tier.
        }
      } catch (err) {
        console.error('[Auth] Erro ao buscar usuário, tentando novamente...', err)
        // Retry once — free tier DB can fail intermittently
        try {
          const user = await fetchOrCreateAppUser(supabase, supabaseUser)
          if (mounted && user) {
            setAppUser(user)
            setCachedUser(user)
          }
        } catch {
          // Don't clear user/cache — stale data is better than redirect loop
        }
      }
    }

    const markReady = () => {
      if (!initialResolved && mounted) {
        initialResolved = true
        setLoading(false)
      }
    }

    // 1) Restore session from cookies explicitly via getSession() (local, fast).
    //    This is more reliable than waiting for INITIAL_SESSION on page refresh.
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!mounted) return
        // If there's an auth error (e.g. invalid refresh token), clear stale session
        if (error) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          if (mounted) {
            setAppUser(null)
            setCachedUser(null)
          }
          return
        }
        // Fast path: if cached user matches the session's auth_id, skip the
        // heavy `/api/auth/me` round-trip on initial load. The cached user is
        // already shown — revalidation isn't needed unless the auth identity changed.
        if (cached && session?.user && cached.auth_id === session.user.id) {
          return
        }
        await resolveUser(session?.user ?? null)
      } catch (err) {
        console.error('[Auth] Erro ao restaurar sessão:', err)
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        setCachedUser(null)
      } finally {
        markReady()
      }
    }

    initSession()

    // Safety net: if initSession somehow hangs, force loading=false after 10s
    // so the user never stares at a spinner forever.
    // (was 5s — too aggressive for Supabase free tier, caused redirect to /login
    //  before resolveUser could complete on slow connections)
    const safetyTimeout = setTimeout(markReady, 10_000)

    // 2) Listen for subsequent auth events (sign in, sign out, token refresh).
    //    Skip INITIAL_SESSION since initSession() already handled it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        if (!mounted) return
        if (event === 'INITIAL_SESSION') return // already handled above
        if (event === 'TOKEN_REFRESHED' && !session) {
          // Refresh token was invalid — clear stale session
          await supabase.auth.signOut()
          if (mounted) {
            setAppUser(null)
            setCachedUser(null)
          }
          return
        }
        await resolveUser(session?.user ?? null)
      }
    )

    // 3) Periodic session keep-alive — forces token refresh every 4 min
    //    so the session never silently expires while the user is idle.
    const refreshInterval = setInterval(async () => {
      if (!mounted) return
      try {
        const { error } = await supabase.auth.getUser()
        if (error && mounted) {
          // Token is irrecoverably expired — clear session
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          setAppUser(null)
          setCachedUser(null)
        }
      } catch {
        // Network error — ignore, will retry next interval
      }
    }, 4 * 60 * 1000)

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      clearInterval(refreshInterval)
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabaseRef.current.auth.signOut()
    setAppUser(null)
    setCachedUser(null)
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
