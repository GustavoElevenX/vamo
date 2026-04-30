import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import type { ActivityType } from '@/types/crm'

export const runtime = 'nodejs'

const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'proposal_sent', 'whatsapp', 'note']
const ACTIVITY_KPI_MAP: Record<ActivityType, string[]> = {
  call: ['Ligacoes', 'Calls', 'Contatos'],
  meeting: ['Reunioes', 'Meetings', 'Visitas'],
  proposal_sent: ['Propostas', 'Proposals'],
  email: [],
  whatsapp: [],
  note: [],
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth

  const { data: deal } = await adminClient
    .from('crm_deals')
    .select('id, owner_id')
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()
  if (!deal || (appUser.role === 'seller' && deal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'Deal nao encontrado' }, { status: 404 })
  }

  const { data, error } = await adminClient
    .from('crm_activities')
    .select('*, user:users(id,name)')
    .eq('deal_id', id)
    .order('occurred_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities: data ?? [] })
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const input = await request.json()
  const type = ACTIVITY_TYPES.includes(input.type) ? input.type as ActivityType : 'note'
  const outcome = String(input.outcome ?? '').trim()
  const title = String(input.title || outcome || 'Atividade registrada').trim()

  if (!outcome) return NextResponse.json({ error: 'Conte o que aconteceu' }, { status: 400 })

  const { data: deal } = await adminClient
    .from('crm_deals')
    .select('id, organization_id, owner_id')
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()
  if (!deal || (appUser.role === 'seller' && deal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'Deal nao encontrado' }, { status: 404 })
  }

  const { data: activity, error } = await adminClient
    .from('crm_activities')
    .insert({
      deal_id: id,
      user_id: appUser.id,
      type,
      title,
      notes: input.notes || null,
      outcome,
      occurred_at: input.occurred_at || new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const kpiNames = ACTIVITY_KPI_MAP[type]
  if (kpiNames.length > 0) {
    const { data: kpi } = await adminClient
      .from('kpi_definitions')
      .select('id, points_per_unit')
      .eq('organization_id', appUser.organization_id)
      .eq('active', true)
      .in('name', kpiNames)
      .limit(1)
      .maybeSingle()

    if (kpi) {
      await adminClient.from('kpi_entries').insert({
        organization_id: appUser.organization_id,
        user_id: appUser.id,
        kpi_id: kpi.id,
        value: 1,
        points_earned: Number(kpi.points_per_unit ?? 0),
        recorded_at: new Date().toISOString().slice(0, 10),
        source: 'api',
      })
    }
  }

  return NextResponse.json({ activity }, { status: 201 })
}
