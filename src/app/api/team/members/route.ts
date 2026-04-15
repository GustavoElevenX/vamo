import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/team/members
 * Returns all active members of the current user's organization.
 * Uses adminClient to bypass RLS — avoids the org_users_select policy
 * which can miss sellers whose organization_id wasn't set yet.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const { data: members, error } = await adminClient
      .from('users')
      .select('id, name, email, role, active, avatar_url, created_at')
      .eq('organization_id', appUser.organization_id)
      .eq('active', true)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ members: members ?? [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
