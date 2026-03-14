import type { SupabaseClient } from '@supabase/supabase-js'

export async function awardXp(
  supabase: SupabaseClient,
  params: {
    userId: string
    organizationId: string
    amount: number
    sourceType: 'kpi' | 'badge' | 'challenge' | 'checklist' | 'bonus'
    sourceId?: string
    description: string
  }
) {
  const { userId, organizationId, amount, sourceType, sourceId, description } = params

  // Insert XP transaction
  const { error: txError } = await supabase.from('xp_transactions').insert({
    user_id: userId,
    organization_id: organizationId,
    amount,
    source_type: sourceType,
    source_id: sourceId ?? null,
    description,
  })

  if (txError) throw txError

  // Get or create user XP record
  const { data: userXp } = await supabase
    .from('user_xp')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  const newTotalXp = (userXp?.total_xp ?? 0) + amount

  // Check level up
  const { data: levels } = await supabase
    .from('xp_levels')
    .select('*')
    .eq('organization_id', organizationId)
    .order('level', { ascending: false })

  let newLevel = 1
  if (levels) {
    for (const level of levels) {
      if (newTotalXp >= level.xp_required) {
        newLevel = level.level
        break
      }
    }
  }

  // Update streak
  const today = new Date().toISOString().split('T')[0]
  const lastActivity = userXp?.last_activity_date
  let currentStreak = userXp?.current_streak ?? 0
  let longestStreak = userXp?.longest_streak ?? 0

  if (lastActivity) {
    const lastDate = new Date(lastActivity)
    const todayDate = new Date(today)
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (86400000))

    if (diffDays === 1) {
      currentStreak += 1
    } else if (diffDays > 1) {
      currentStreak = 1
    }
  } else {
    currentStreak = 1
  }

  longestStreak = Math.max(longestStreak, currentStreak)

  if (userXp) {
    await supabase
      .from('user_xp')
      .update({
        total_xp: newTotalXp,
        current_level: newLevel,
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_activity_date: today,
      })
      .eq('id', userXp.id)
  } else {
    await supabase.from('user_xp').insert({
      user_id: userId,
      organization_id: organizationId,
      total_xp: newTotalXp,
      current_level: newLevel,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
    })
  }

  const leveledUp = userXp ? newLevel > userXp.current_level : false

  return { newTotalXp, newLevel, leveledUp, currentStreak }
}
