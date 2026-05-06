import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { getTeamCommercialPerformance } from '@/lib/services/team-commercial-performance.service'

export const runtime = 'nodejs'

/**
 * Compatibilidade para telas antigas.
 * A fonte oficial da performance da equipe agora e comercial, nao ranking de XP.
 */
export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    const performance = await getTeamCommercialPerformance(adminClient, appUser.organization_id, { period: 'month' })

    const members = performance.sellers.map((seller) => ({
      user_id: seller.id,
      name: seller.name,
      avatar_url: seller.avatar_url,
      total_xp: seller.xp,
      current_level: seller.level,
      current_streak: seller.streak,
      last_activity_date: null,
      missions_completed: seller.missions_completed,
      individual_goal: seller.individual_goal ? seller.individual_goal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null,
      trend: seller.commercial_score >= 70 ? 'up' : seller.commercial_score < 40 ? 'down' : 'stable',
      checkin_today: seller.checkin_energy != null ? { energy_level: seller.checkin_energy, intention: null, obstacle: null } : null,
      revenue_won: seller.revenue_won,
      forecast_weighted: seller.forecast_weighted,
      pipeline_at_risk: seller.pipeline_at_risk,
      commercial_score: seller.commercial_score,
      status: seller.status,
      status_label: seller.status_label,
    }))

    return NextResponse.json({
      members,
      team_goal: performance.summary.monthly_goal
        ? { kpiComportamental: 'Meta comercial do mes', valorMeta: performance.summary.monthly_goal }
        : null,
      commercial_summary: performance.summary,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
