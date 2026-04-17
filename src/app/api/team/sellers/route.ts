import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/team/sellers
 * Returns all active sellers in the current user's org.
 * Uses adminClient to bypass RLS (same pattern as /api/team/performance).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser?.organization_id) {
      return NextResponse.json({ sellers: [] })
    }

    const { data: sellers, error } = await adminClient
      .from('users')
      .select('id, name')
      .eq('organization_id', appUser.organization_id)
      .eq('role', 'seller')
      .eq('active', true)
      .order('name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ sellers: sellers ?? [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
