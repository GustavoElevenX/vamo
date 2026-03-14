import type { SupabaseClient } from '@supabase/supabase-js'
import { awardXp } from './xp.service'

export async function updateChallengeProgress(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  challengeId: string,
  progress: number
) {
  const { data: challenge } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single()

  if (!challenge) throw new Error('Desafio não encontrado')

  const { data: participant } = await supabase
    .from('challenge_participants')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .single()

  if (!participant) throw new Error('Não participa deste desafio')
  if (participant.completed) return { alreadyCompleted: true }

  const target = (challenge.criteria as { target?: number })?.target ?? 100
  const completed = progress >= target

  await supabase
    .from('challenge_participants')
    .update({
      progress,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', participant.id)

  if (completed) {
    await awardXp(supabase, {
      userId,
      organizationId,
      amount: challenge.xp_reward,
      sourceType: 'challenge',
      sourceId: challengeId,
      description: `Desafio completado: ${challenge.title}`,
    })
  }

  return { completed, progress }
}

export async function joinChallenge(
  supabase: SupabaseClient,
  userId: string,
  challengeId: string
) {
  const { error } = await supabase.from('challenge_participants').insert({
    challenge_id: challengeId,
    user_id: userId,
    progress: 0,
    completed: false,
  })

  if (error) throw error
}
