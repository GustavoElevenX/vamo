import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer', 'consultant'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: sellers, error: sellersError } = await adminClient
      .from('users')
      .select('id,name,avatar_url')
      .eq('organization_id', appUser.organization_id)
      .eq('role', 'seller')
      .eq('active', true)

    if (sellersError) return NextResponse.json({ error: sellersError.message }, { status: 500 })

    const sellerIds = (sellers ?? []).map((seller) => seller.id)
    if (!sellerIds.length) return NextResponse.json({ members: [] })

    const [entriesRes, missionsRes] = await Promise.all([
      adminClient
        .from('kpi_entries')
        .select('user_id,value,source_event')
        .eq('organization_id', appUser.organization_id)
        .in('user_id', sellerIds)
        .gte('recorded_at', today.toISOString()),
      adminClient
        .from('ai_missions')
        .select('user_id,status,current_value,target_value')
        .eq('organization_id', appUser.organization_id)
        .in('user_id', sellerIds),
    ])

    if (entriesRes.error) return NextResponse.json({ error: entriesRes.error.message }, { status: 500 })
    if (missionsRes.error) return NextResponse.json({ error: missionsRes.error.message }, { status: 500 })

    const members = (sellers ?? []).map((seller) => {
      const entries = (entriesRes.data ?? []).filter((entry) => entry.user_id === seller.id)
      const missions = (missionsRes.data ?? []).filter((mission) => mission.user_id === seller.id)
      const activeMissions = missions.filter((mission) => ['pending', 'in_progress', 'awaiting_approval'].includes(mission.status))
      const completedMissions = missions.filter((mission) => mission.status === 'completed')
      const missionProgress = activeMissions.length
        ? Math.round(activeMissions.reduce((sum, mission) => {
            const target = Number(mission.target_value || 0)
            const current = Number(mission.current_value || 0)
            return sum + (target > 0 ? Math.min(100, current / target * 100) : current > 0 ? 100 : 0)
          }, 0) / activeMissions.length)
        : 0

      return {
        user_id: seller.id,
        name: seller.name,
        avatar_url: seller.avatar_url,
        kpi_entries_today: entries.length,
        execution_value_today: entries.reduce((sum, entry) => sum + Number(entry.value || 0), 0),
        active_missions: activeMissions.length,
        completed_missions: completedMissions.length,
        mission_progress: missionProgress,
      }
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('GET /api/execution/team', error)
    return NextResponse.json({ error: 'Erro ao carregar execucao da equipe' }, { status: 500 })
  }
}
