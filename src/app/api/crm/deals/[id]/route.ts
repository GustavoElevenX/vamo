import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import type { DealStage } from '@/types/crm'

export const runtime = 'nodejs'

const STAGES: DealStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

type Params = { params: Promise<{ id: string }> }

async function loadDeal(adminClient: any, orgId: string, userId: string, role: string, id: string) {
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
  if ('value' in input) patch.value = Number(input.value || 0)
  if ('probability' in input) patch.probability = Number(input.probability || 0)
  if (STAGES.includes(input.stage)) patch.stage = input.stage
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
