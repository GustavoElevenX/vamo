import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAndAwardBadges } from '@/lib/services/badge.service'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const newBadges = await checkAndAwardBadges(
    supabase,
    appUser.id,
    appUser.organization_id
  )

  return NextResponse.json({ newBadges })
}
