import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ xp: null, levels: [] })
    }

    const adminClient = createAdminClient()

    // Get app user to find their id and organization_id
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser) {
      return NextResponse.json({ xp: null, levels: [] })
    }

    const [xpResult, levelsResult] = await Promise.all([
      adminClient
        .from('user_xp')
        .select('*')
        .eq('user_id', appUser.id)
        .maybeSingle(),
      adminClient
        .from('xp_levels')
        .select('*')
        .eq('organization_id', appUser.organization_id)
        .order('level', { ascending: true }),
    ])

    return NextResponse.json({
      xp: xpResult.data ?? null,
      levels: levelsResult.data ?? [],
    })
  } catch (error) {
    console.error('GET /api/user/xp error:', error)
    return NextResponse.json({ xp: null, levels: [] })
  }
}
