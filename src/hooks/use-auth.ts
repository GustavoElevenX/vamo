'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User as AppUser } from '@/types'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function useAuth() {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchOrCreateAppUser = async (user: SupabaseUser): Promise<AppUser | null> => {
    // Try to get existing profile
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (data) return data as AppUser

    // No profile exists (user was created before trigger migration)
    // Auto-create it now
    if (!data && (error === null || error?.code === 'PGRST116')) {
      const name = user.user_metadata?.name || user.email || 'Usuário'
      const role = user.user_metadata?.role || 'admin'

      const { data: created } = await supabase
        .from('users')
        .insert({
          auth_id: user.id,
          name,
          email: user.email!,
          role,
        })
        .select()
        .maybeSingle()

      return created as AppUser | null
    }

    return null
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setSupabaseUser(user)

      if (user) {
        const appUser = await fetchOrCreateAppUser(user)
        setAppUser(appUser)
      }

      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSupabaseUser(session?.user ?? null)

        if (session?.user) {
          const appUser = await fetchOrCreateAppUser(session.user)
          setAppUser(appUser)
        } else {
          setAppUser(null)
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSupabaseUser(null)
    setAppUser(null)
  }

  return { supabaseUser, user: appUser, loading, signOut }
}
