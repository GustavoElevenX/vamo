import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: checkin } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('user_id', appUser.id)
    .eq('checkin_date', today)
    .maybeSingle()

  return NextResponse.json({ checkin })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const { energy_level, intention, obstacle } = body

  if (!energy_level || energy_level < 1 || energy_level > 5) {
    return NextResponse.json({ error: 'energy_level deve ser entre 1 e 5' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: checkin, error } = await adminClient
    .from('daily_checkins')
    .upsert(
      {
        user_id: appUser.id,
        organization_id: appUser.organization_id,
        energy_level,
        intention: intention || null,
        obstacle: obstacle || null,
        checkin_date: today,
      },
      { onConflict: 'user_id,checkin_date' }
    )
    .select()
    .single()

  if (error) {
    console.error('Checkin save error:', error)
    return NextResponse.json({ error: 'Erro ao salvar check-in' }, { status: 500 })
  }

  return NextResponse.json({ checkin })
}
