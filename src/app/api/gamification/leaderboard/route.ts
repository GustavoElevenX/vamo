import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLeaderboard } from '@/lib/services/leaderboard.service'
import type { PeriodType } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('organization_id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const period = (searchParams.get('period') ?? 'weekly') as PeriodType

  const leaderboard = await getLeaderboard(supabase, appUser.organization_id, period)

  return NextResponse.json(leaderboard)
}
