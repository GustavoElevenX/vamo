import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { DealStage } from '@/types/crm'

export const runtime = 'nodejs'

const STAGES: DealStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const NEXT_ACTION_TYPES = ['follow_up', 'call', 'email', 'proposal', 'meeting', 'review', 'other']
const NEXT_ACTION_STATUSES = ['open', 'done', 'snoozed']
const FORECAST_CATEGORIES = ['pipeline', 'best_case', 'commit', 'closed']

type Params = { params: Promise<{ id: string }> }

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

async function loadDeal(adminClient: ReturnType<typeof createAdminClient>, orgId: string, userId: string, role: string, id: string) {
  let query = adminClient
    .from('crm_deals')
    .select('*, account:crm_accounts(id,name,segment,website), owner:users!crm_deals_owner_id_fkey(id,name,avatar_url), activities:crm_activities(*, user:users(id,name))')
    .eq('id', id)
    .eq('organization_id', orgId)

  if (role === 'seller') query = query.eq('owner_id', userId)
  return query.single()
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { data, error } = await loadDeal(auth.adminClient, auth.appUser.organization_id, auth.appUser.id, auth.appUser.role, id)
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ deal: data })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const input = await request.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['title', 'account_id', 'expected_close', 'lost_reason', 'notes'] as const) {
    if (key in input) patch[key] = input[key] || null
  }
  for (const key of ['next_action_title', 'next_action_due_at'] as const) {
    if (key in input) patch[key] = input[key] || null
  }
  if ('value' in input) patch.value = parseMoney(input.value)
  if ('probability' in input) patch.probability = Number(input.probability || 0)
  if (STAGES.includes(input.stage)) patch.stage = input.stage
  if (NEXT_ACTION_TYPES.includes(input.next_action_type)) patch.next_action_type = input.next_action_type
  if (NEXT_ACTION_STATUSES.includes(input.next_action_status)) {
    patch.next_action_status = input.next_action_status
    if (input.next_action_status === 'done') patch.last_activity_at = new Date().toISOString()
  }
  if (FORECAST_CATEGORIES.includes(input.forecast_category)) patch.forecast_category = input.forecast_category
  if ('ai_priority_score' in input) {
    const score = Number(input.ai_priority_score || 0)
    patch.ai_priority_score = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
  }
  if (input.owner_id && appUser.role !== 'seller') patch.owner_id = input.owner_id

  let query = adminClient
    .from('crm_deals')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)

  if (appUser.role === 'seller') query = query.eq('owner_id', appUser.id)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestor pode excluir deals' }, { status: 403 })
  }

  const { error } = await adminClient
    .from('crm_deals')
    .delete()
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
