import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/team/performance
 * Returns sellers with their XP and gamification data for the current org.
 * Uses adminClient to bypass RLS — avoids the org_users_select policy
 * which blocks the inner join used in the client-side query.
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

    // Fetch all sellers in the org
    const { data: sellers, error: sellersError } = await adminClient
      .from('users')
      .select('id, name, avatar_url')
      .eq('organization_id', appUser.organization_id)
      .eq('role', 'seller')
      .eq('active', true)

    if (sellersError) return NextResponse.json({ error: sellersError.message }, { status: 500 })
    if (!sellers || sellers.length === 0) return NextResponse.json({ members: [] })

    const sellerIds = sellers.map((s) => s.id)

    // Fetch XP data for those sellers
    const { data: xpData } = await adminClient
      .from('user_xp')
      .select('user_id, total_xp, current_level, current_streak, last_activity_date')
      .eq('organization_id', appUser.organization_id)
      .in('user_id', sellerIds)

    const xpMap = new Map((xpData ?? []).map((x) => [x.user_id, x]))

    // Fetch all completed mission rows for these sellers in a single query,
    // then group/count client-side. Replaces N sequential count() calls.
    const { data: missionRows } = await adminClient
      .from('ai_missions')
      .select('user_id')
      .in('user_id', sellerIds)
      .eq('status', 'completed')

    const missionsMap = new Map<string, number>()
    for (const row of missionRows ?? []) {
      missionsMap.set(row.user_id, (missionsMap.get(row.user_id) ?? 0) + 1)
    }

    // Fetch individual goals from program_goals (latest entry for this org)
    const { data: goalsData } = await adminClient
      .from('program_goals')
      .select('individual_goals, team_goal')
      .eq('organization_id', appUser.organization_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const individualGoals: Array<{ user_id: string; goal: string }> = goalsData?.individual_goals ?? []
    const goalsMap = new Map(individualGoals.map((g) => [g.user_id, g.goal]))
    const teamGoal = goalsData?.team_goal ?? null

    const members = sellers.map((seller) => {
      const xp = xpMap.get(seller.id)
      const streak = xp?.current_streak ?? 0
      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (streak > 5) trend = 'up'
      else if (streak === 0) trend = 'down'

      return {
        user_id: seller.id,
        name: seller.name,
        avatar_url: seller.avatar_url ?? null,
        total_xp: xp?.total_xp ?? 0,
        current_level: xp?.current_level ?? 1,
        current_streak: streak,
        last_activity_date: xp?.last_activity_date ?? null,
        missions_completed: missionsMap.get(seller.id) ?? 0,
        individual_goal: goalsMap.get(seller.id) ?? null,
        trend,
      }
    })

    members.sort((a, b) => b.missions_completed - a.missions_completed || b.total_xp - a.total_xp)

    return NextResponse.json({ members, team_goal: teamGoal })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
