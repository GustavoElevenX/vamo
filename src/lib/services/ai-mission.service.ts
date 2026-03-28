import type { SupabaseClient } from '@supabase/supabase-js'
import { awardXp } from './xp.service'

export async function completeMission(
  supabase: SupabaseClient,
  params: {
    missionId: string
    userId: string
    organizationId: string
  }
) {
  const { missionId, userId, organizationId } = params

  // Fetch mission
  const { data: mission, error } = await supabase
    .from('ai_missions')
    .select('*')
    .eq('id', missionId)
    .eq('user_id', userId)
    .single()

  if (error || !mission) throw new Error('Missão não encontrada')
  if (mission.status === 'completed') throw new Error('Missão já completada')

  // Update mission status
  await supabase
    .from('ai_missions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', missionId)

  // Award XP
  const xpResult = await awardXp(supabase, {
    userId,
    organizationId,
    amount: mission.xp_reward,
    sourceType: 'bonus',
    sourceId: missionId,
    description: `Missão VAMO IA completada: ${mission.title}`,
  })

  return { mission, xpResult }
}

export async function updateMissionStatus(
  supabase: SupabaseClient,
  params: {
    missionId: string
    userId: string
    status: 'in_progress' | 'skipped'
  }
) {
  const { missionId, userId, status } = params

  const { error } = await supabase
    .from('ai_missions')
    .update({ status })
    .eq('id', missionId)
    .eq('user_id', userId)

  if (error) throw error
}
