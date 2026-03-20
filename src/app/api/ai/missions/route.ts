import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeMission, updateMissionStatus } from '@/lib/services/ai-mission.service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const { data: missions } = await supabase
    .from('ai_missions')
    .select('*')
    .eq('user_id', appUser.id)
    .eq('organization_id', appUser.organization_id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ missions: missions ?? [] })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const { missionId, action } = await request.json()
  if (!missionId || !action) {
    return NextResponse.json({ error: 'missionId e action são obrigatórios' }, { status: 400 })
  }

  try {
    if (action === 'complete') {
      const result = await completeMission(supabase, {
        missionId,
        userId: appUser.id,
        organizationId: appUser.organization_id,
      })
      return NextResponse.json(result)
    }

    if (action === 'start' || action === 'skip') {
      await updateMissionStatus(supabase, {
        missionId,
        userId: appUser.id,
        status: action === 'start' ? 'in_progress' : 'skipped',
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
