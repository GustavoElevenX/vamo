import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/services/xp.service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Get app user
  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const body = await request.json()
  const { userId, amount, sourceType, sourceId, description } = body

  // Only managers/admins can award XP to others
  const targetUserId = userId ?? appUser.id
  if (targetUserId !== appUser.id && !['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const result = await awardXp(supabase, {
    userId: targetUserId,
    organizationId: appUser.organization_id,
    amount,
    sourceType,
    sourceId,
    description,
  })

  return NextResponse.json(result)
}
