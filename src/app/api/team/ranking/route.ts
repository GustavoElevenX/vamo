import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function periodStart(period: string): string {
  const now = new Date()
  if (period === 'daily') {
    now.setHours(0, 0, 0, 0)
  } else if (period === 'weekly') {
    const day = now.getDay()
    now.setDate(now.getDate() - day)
    now.setHours(0, 0, 0, 0)
  } else {
    // monthly
    now.setDate(1)
    now.setHours(0, 0, 0, 0)
  }
  return now.toISOString()
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const period = req.nextUrl.searchParams.get('period') ?? 'weekly'
    const since = periodStart(period)

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser?.organization_id) return NextResponse.json({ rankings: [] })

    // Fetch all active sellers
    const { data: sellers } = await adminClient
      .from('users')
      .select('id, name, avatar_url')
      .eq('organization_id', appUser.organization_id)
      .eq('role', 'seller')
      .eq('active', true)

    if (!sellers || sellers.length === 0) return NextResponse.json({ rankings: [] })

    const sellerIds = sellers.map((s) => s.id)

    // Fetch period XP from transactions
    const { data: transactions } = await adminClient
      .from('xp_transactions')
      .select('user_id, amount')
      .eq('organization_id', appUser.organization_id)
      .in('user_id', sellerIds)
      .gte('created_at', since)

    // Aggregate XP per user for the period
    const periodXpMap = new Map<string, number>()
    for (const tx of transactions ?? []) {
      periodXpMap.set(tx.user_id, (periodXpMap.get(tx.user_id) ?? 0) + tx.amount)
    }

    // Fetch total XP for level display
    const { data: xpData } = await adminClient
      .from('user_xp')
      .select('user_id, total_xp, current_level')
      .eq('organization_id', appUser.organization_id)
      .in('user_id', sellerIds)

    const xpMap = new Map((xpData ?? []).map((x) => [x.user_id, x]))

    const rankings = sellers
      .map((seller) => {
        const xp = xpMap.get(seller.id)
        return {
          user_id: seller.id,
          name: seller.name,
          avatar_url: seller.avatar_url ?? null,
          period_xp: periodXpMap.get(seller.id) ?? 0,
          total_xp: xp?.total_xp ?? 0,
          current_level: xp?.current_level ?? 1,
        }
      })
      .sort((a, b) => b.period_xp - a.period_xp)

    return NextResponse.json({ rankings })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
