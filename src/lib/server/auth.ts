import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export async function getAppUser() {
  const supabase = await createClient()
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  }

  const adminClient = createAdminClient()
  const { data: appUser, error } = await adminClient
    .from('users')
    .select('id, organization_id, name, email, role, avatar_url, active')
    .eq('auth_id', authUser.id)
    .single()

  if (error || !appUser?.organization_id) {
    return { error: NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 }) }
  }

  return {
    adminClient,
    appUser: appUser as {
      id: string
      organization_id: string
      name: string
      email: string
      role: UserRole
      avatar_url: string | null
      active: boolean
    },
  }
}

export function requireRole(role: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  return null
}
