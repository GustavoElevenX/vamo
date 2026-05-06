import type { SupabaseClient } from '@supabase/supabase-js'
import { awardXp } from './xp.service'

export async function completeMission(
  supabase: SupabaseClient,
  params: {
    missionId: string
    userId: string
    organizationId: string
  },
) {
  const { missionId, userId, organizationId } = params

  const { data: mission, error } = await supabase
    .from('ai_missions')
    .select('*')
    .eq('id', missionId)
    .eq('user_id', userId)
    .single()

  if (error || !mission) throw new Error('Missao nao encontrada')
  if (mission.status === 'completed') throw new Error('Missao ja completada')

  const targetValue = Number(mission.target_value ?? mission.criteria?.target_value ?? 0)
  const currentValue = Number(mission.current_value ?? 0)
  const hasStructuredCriteria = Boolean(mission.criteria?.type || mission.kpi_id || targetValue > 0)
  const verificationType = mission.verification_type ?? (hasStructuredCriteria ? 'manual' : 'automatic')
  const now = new Date().toISOString()

  if (verificationType === 'manual' || verificationType === 'hybrid') {
    const { error: approvalError } = await supabase
      .from('ai_missions')
      .update({
        status: 'awaiting_approval',
        current_value: targetValue > 0 ? Math.max(currentValue, targetValue) : Math.max(currentValue, 1),
        updated_at: now,
      })
      .eq('id', missionId)
      .eq('user_id', userId)

    if (approvalError) throw new Error('Erro ao solicitar validacao da missao')
    return { mission: { ...mission, status: 'awaiting_approval' }, xpResult: null, awaitingApproval: true }
  }

  if (hasStructuredCriteria && targetValue > 0 && currentValue < targetValue) {
    throw new Error('A missao ainda nao atingiu a meta para conclusao automatica')
  }

  const { error: updateError } = await supabase
    .from('ai_missions')
    .update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
    })
    .eq('id', missionId)

  if (updateError) throw new Error('Erro ao atualizar status da missao')

  const xpResult = await awardXp(supabase, {
    userId,
    organizationId,
    amount: Number(mission.xp_reward ?? 0),
    sourceType: 'mission',
    sourceId: missionId,
    description: `Missao VAMO IA completada: ${mission.title}`,
  })

  return { mission, xpResult }
}

export async function updateMissionStatus(
  supabase: SupabaseClient,
  params: {
    missionId: string
    userId: string
    status: 'in_progress' | 'skipped'
  },
) {
  const { missionId, userId, status } = params

  const { error } = await supabase
    .from('ai_missions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', missionId)
    .eq('user_id', userId)

  if (error) throw error
}
