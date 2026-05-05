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
  organizationId: string,
  context?: {
    performanceEventId?: string
    evidence?: Record<string, unknown>
  }
) {
  try {
    // Get all badges for this org
    const { data: badges, error: badgesError } = await supabase
      .from('badges')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('active', true)

    if (badgesError) {
      console.error('Error fetching badges:', badgesError)
      return []
    }

    if (!badges?.length) return []

    // Get already earned badges
    const { data: earnedBadges, error: earnedError } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId)

    if (earnedError) {
      console.error('Error fetching user_badges:', earnedError)
    }

    const earnedIds = new Set(earnedBadges?.map((b) => b.badge_id) ?? [])

    // Get user stats for evaluation
    const { data: userXp, error: userXpError } = await supabase
      .from('user_xp')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (userXpError) {
      console.error('Error fetching user_xp:', userXpError)
    }

    const { data: kpiEntries, error: kpiError } = await supabase
      .from('kpi_entries')
      .select('*, kpi_definitions!inner(slug)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)

    if (kpiError) {
      console.error('Error fetching kpi_entries:', kpiError)
    }

    const { data: completedChallenges, error: challengesError } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)

    if (challengesError) {
      console.error('Error fetching challenge_participants:', challengesError)
    }

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
        const { error: insertError } = await supabase.from('user_badges').insert({
          user_id: userId,
          badge_id: badge.id,
        })

        if (insertError) {
          console.error(`Error inserting badge ${badge.id}:`, insertError)
          continue
        }

        if (badge.xp_reward > 0) {
          try {
            await awardXp(supabase, {
              userId,
              organizationId,
              amount: badge.xp_reward,
              sourceType: 'badge',
              sourceId: badge.id,
              performanceEventId: context?.performanceEventId,
              evidence: {
                badgeId: badge.id,
                criteria: badge.criteria,
                ...(context?.evidence ?? {}),
              },
              impactExpected: 'Badge concedido por evidencia operacional real',
              description: `Badge conquistado: ${badge.name}`,
            })
          } catch (xpErr) {
            console.error(`Error awarding XP for badge ${badge.id}:`, xpErr)
          }
        }

        await supabase.from('feed_posts').insert({
          organization_id: organizationId,
          type: 'achievement',
          author_id: null,
          target_user_id: userId,
          content: `conquistou o badge "${badge.name}" por evidencia real de performance.`,
        })

        newBadges.push(badge)
      }
    }

    return newBadges
  } catch (err) {
    console.error('Unexpected error in checkAndAwardBadges:', err)
    return []
  }
}
