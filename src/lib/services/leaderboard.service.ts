import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeaderboardEntry, PeriodType } from '@/types'

export async function getLeaderboard(
  supabase: SupabaseClient,
  organizationId: string,
  periodType: PeriodType = 'weekly'
): Promise<LeaderboardEntry[]> {
  const { start, end } = getPeriodDates(periodType)

  // Get XP earned in the period
  const { data: transactions } = await supabase
    .from('xp_transactions')
    .select('user_id, amount')
    .eq('organization_id', organizationId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  if (!transactions?.length) return []

  // Aggregate XP per user
  const userXpMap = new Map<string, number>()
  for (const tx of transactions) {
    userXpMap.set(tx.user_id, (userXpMap.get(tx.user_id) ?? 0) + tx.amount)
  }

  // Get user details
  const userIds = Array.from(userXpMap.keys())
  const { data: users } = await supabase
    .from('users')
    .select('id, name, avatar_url')
    .in('id', userIds)

  // Get user levels
  const { data: userXps } = await supabase
    .from('user_xp')
    .select('user_id, current_level, total_xp')
    .in('user_id', userIds)
    .eq('organization_id', organizationId)

  const userMap = new Map(users?.map((u) => [u.id, u]) ?? [])
  const levelMap = new Map(userXps?.map((x) => [x.user_id, x]) ?? [])

  // Build and sort leaderboard
  const entries: LeaderboardEntry[] = Array.from(userXpMap.entries())
    .map(([userId, xp]) => {
      const user = userMap.get(userId)
      const xpData = levelMap.get(userId)
      return {
        user_id: userId,
        user_name: user?.name ?? 'Desconhecido',
        avatar_url: user?.avatar_url ?? null,
        total_xp: xp,
        rank: 0,
        level: xpData?.current_level ?? 1,
      }
    })
    .sort((a, b) => b.total_xp - a.total_xp)

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1
  })

  return entries
}

function getPeriodDates(periodType: PeriodType) {
  const now = new Date()
  const start = new Date()
  const end = new Date()

  switch (periodType) {
    case 'daily':
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'weekly': {
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      start.setDate(now.getDate() + mondayOffset)
      start.setHours(0, 0, 0, 0)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      break
    }
    case 'monthly':
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setMonth(now.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
      break
  }

  return { start, end }
}
