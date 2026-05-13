import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { calibrateHealthFromCheckin } from '@/lib/services/health-calibration.service'
import { generateHealthCalibration } from '@/lib/services/contextual-ai.service'

export const runtime = 'nodejs'

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export async function GET(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const userId = new URL(request.url).searchParams.get('userId')
  let query = adminClient
    .from('health_calibrations')
    .select('*, user:users(id,name)')
    .eq('organization_id', appUser.organization_id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (appUser.role === 'seller') query = query.eq('user_id', appUser.id)
  else if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ calibrations: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>
  const checkinId = asString(body.checkinId)
  if (!checkinId) return NextResponse.json({ error: 'checkinId obrigatorio' }, { status: 400 })

  const { data: checkin } = await adminClient
    .from('daily_checkins')
    .select('*')
    .eq('id', checkinId)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()

  if (!checkin) return NextResponse.json({ error: 'Check-in não encontrado' }, { status: 404 })
  if (appUser.role === 'seller' && checkin.user_id !== appUser.id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const result = await calibrateHealthFromCheckin(adminClient, {
      organizationId: appUser.organization_id,
      userId: checkin.user_id,
      actorUserId: appUser.id,
      checkinId,
    })
    const ai = await generateHealthCalibration(adminClient, checkinId)
    return NextResponse.json({ ...result, ai }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}
