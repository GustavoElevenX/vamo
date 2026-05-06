import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

function progress(current: unknown, target: unknown) {
  const currentValue = Number(current ?? 0)
  const targetValue = Number(target ?? 0)
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || targetValue <= 0) {
    return currentValue > 0 ? 100 : 0
  }
  return Math.max(0, Math.min(100, Math.round((currentValue / targetValue) * 100)))
}

export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    const now = new Date().toISOString()
    await adminClient
      .from('ai_missions')
      .update({ status: 'expired', updated_at: now })
      .eq('organization_id', appUser.organization_id)
      .eq('user_id', appUser.id)
      .in('status', ['pending', 'in_progress'])
      .lt('deadline', now)

    const { data, error } = await adminClient
      .from('ai_missions')
      .select('*, kpi:kpi_definitions(id,name,unit,source_event)')
      .eq('organization_id', appUser.organization_id)
      .eq('user_id', appUser.id)
      .in('status', ['pending', 'in_progress', 'awaiting_approval', 'rejected', 'completed', 'expired'])
      .order('created_at', { ascending: false })
      .limit(60)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const missions = (data ?? []).map((mission: any) => {
      const targetValue = Number(mission.target_value ?? mission.criteria?.target_value ?? 0)
      const currentValue = Number(mission.current_value ?? 0)
      const progressPct = progress(currentValue, targetValue)
      const isManual = mission.verification_type === 'manual' || mission.verification_type === 'hybrid'
      const canRequestApproval = isManual && ['pending', 'in_progress', 'rejected'].includes(mission.status)

      return {
        ...mission,
        progressPct,
        missingValue: Math.max(0, targetValue - currentValue),
        validationLabel: mission.verification_type === 'automatic'
          ? 'Validacao automatica'
          : mission.verification_type === 'hybrid'
            ? 'Progresso automatico + aprovacao'
            : 'Validacao pelo gestor',
        primaryCta: mission.status === 'pending'
          ? 'Iniciar'
          : canRequestApproval
            ? 'Solicitar validacao'
            : mission.status === 'awaiting_approval'
              ? 'Aguardando gestor'
              : mission.status === 'completed'
                ? 'Concluida'
                : 'Registrar acao',
      }
    })

    return NextResponse.json({ missions })
  } catch (error) {
    console.error('GET /api/missions/my', error)
    return NextResponse.json({ error: 'Erro ao carregar missoes' }, { status: 500 })
  }
}
