import type { SupabaseClient } from '@supabase/supabase-js'
import { awardXp } from './xp.service'

interface BadgeCriteria {
  type: 'kpi_total' | 'streak' | 'level' | 'kpi_count' | 'challenge_count'
  kpi_slug?: string
  threshold: number
}

export async function checkAndAwardBadges(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
) {
  // Get all badges for this org
  const { data: badges } = await supabase
    .from('badges')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('active', true)

  if (!badges?.length) return []

  // Get already earned badges
  const { data: earnedBadges } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)

  const earnedIds = new Set(earnedBadges?.map((b) => b.badge_id) ?? [])

  // Get user stats for evaluation
  const { data: userXp } = await supabase
    .from('user_xp')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  const { data: kpiEntries } = await supabase
    .from('kpi_entries')
    .select('*, kpi_definitions!inner(slug)')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)

  const { data: completedChallenges } = await supabase
    .from('challenge_participants')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', true)

  const newBadges = []

  for (const badge of badges) {
    if (earnedIds.has(badge.id)) continue

    const criteria = badge.criteria as BadgeCriteria
    let earned = false

    switch (criteria.type) {
      case 'kpi_total': {
        const relevant = kpiEntries?.filter(
          (e: { kpi_definitions: { slug: string } }) =>
            !criteria.kpi_slug || e.kpi_definitions.slug === criteria.kpi_slug
        )
        const total = relevant?.reduce((sum: number, e: { value: number }) => sum + e.value, 0) ?? 0
        earned = total >= criteria.threshold
        break
      }
      case 'streak':
        earned = (userXp?.longest_streak ?? 0) >= criteria.threshold
        break
      case 'level':
        earned = (userXp?.current_level ?? 1) >= criteria.threshold
        break
      case 'kpi_count':
        earned = (kpiEntries?.length ?? 0) >= criteria.threshold
        break
      case 'challenge_count':
        earned = (completedChallenges?.length ?? 0) >= criteria.threshold
        break
    }

    if (earned) {
      await supabase.from('user_badges').insert({
        user_id: userId,
        badge_id: badge.id,
      })

      if (badge.xp_reward > 0) {
        await awardXp(supabase, {
          userId,
          organizationId,
          amount: badge.xp_reward,
          sourceType: 'badge',
          sourceId: badge.id,
          description: `Badge conquistado: ${badge.name}`,
        })
      }

      newBadges.push(badge)
    }
  }

  return newBadges
}
