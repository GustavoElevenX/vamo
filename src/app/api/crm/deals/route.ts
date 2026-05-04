import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import type { DealStage } from '@/types/crm'

export const runtime = 'nodejs'

const STAGES: DealStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const NEXT_ACTION_TYPES = ['follow_up', 'call', 'email', 'proposal', 'meeting', 'review', 'other'] as const
const FORECAST_CATEGORIES = ['pipeline', 'best_case', 'commit', 'closed'] as const

function parseMoney(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const normalized = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth
    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')
    const ownerId = searchParams.get('owner_id')

    let query = adminClient
      .from('crm_deals')
      .select('*, account:crm_accounts(id,name), owner:users!crm_deals_owner_id_fkey(id,name,avatar_url)')
      .eq('organization_id', appUser.organization_id)
      .order('updated_at', { ascending: false })

    if (stage && STAGES.includes(stage as DealStage)) query = query.eq('stage', stage)
    if (ownerId) query = query.eq('owner_id', ownerId)
    if (appUser.role === 'seller') query = query.eq('owner_id', appUser.id)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deals: data ?? [] })
  } catch (error) {
    console.error('GET /api/crm/deals', error)
    return NextResponse.json({ error: 'Erro ao carregar pipeline' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth
    const input = await request.json()

    const title = String(input.title ?? '').trim()
    const value = parseMoney(input.value)
    const stage = STAGES.includes(input.stage) ? input.stage : 'prospecting'
    const ownerId = appUser.role === 'seller' ? appUser.id : String(input.owner_id || appUser.id)
    const nextActionTitle = String(input.next_action_title ?? '').trim()
    const nextActionType = NEXT_ACTION_TYPES.includes(input.next_action_type) ? input.next_action_type : 'follow_up'
    const forecastCategory = FORECAST_CATEGORIES.includes(input.forecast_category) ? input.forecast_category : 'pipeline'
    const priorityScore = Number(input.ai_priority_score ?? 0)

    if (!title) return NextResponse.json({ error: 'Titulo e obrigatorio' }, { status: 400 })

    const { data, error } = await adminClient
      .from('crm_deals')
      .insert({
        organization_id: appUser.organization_id,
        account_id: input.account_id || null,
        owner_id: ownerId,
        title,
        value,
        stage,
        probability: Number(input.probability ?? 0),
        expected_close: input.expected_close || null,
        notes: input.notes || null,
        next_action_title: nextActionTitle || null,
        next_action_type: nextActionTitle ? nextActionType : null,
        next_action_due_at: input.next_action_due_at || null,
        next_action_status: nextActionTitle ? 'open' : 'open',
        forecast_category: forecastCategory,
        ai_priority_score: Number.isFinite(priorityScore) ? Math.max(0, Math.min(100, priorityScore)) : 0,
      })
      .select('*, account:crm_accounts(id,name), owner:users!crm_deals_owner_id_fkey(id,name,avatar_url)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deal: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/crm/deals', error)
    return NextResponse.json({ error: 'Erro ao criar deal' }, { status: 500 })
  }
}
