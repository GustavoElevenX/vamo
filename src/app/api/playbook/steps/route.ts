import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { DEFAULT_PLAYBOOK_STEPS } from '@/lib/crm/default-playbook'
import type { DealStage } from '@/types/crm'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const stage = new URL(request.url).searchParams.get('stage') as DealStage | null
  if (!stage) return NextResponse.json({ error: 'stage obrigatorio' }, { status: 400 })

  const { data, error } = await adminClient
    .from('playbook_steps')
    .select('*')
    .eq('organization_id', appUser.organization_id)
    .eq('stage', stage)
    .order('order_index')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (data?.length) return NextResponse.json({ steps: data })

  const defaults = (DEFAULT_PLAYBOOK_STEPS[stage] ?? []).map((title, index) => ({
    id: `default-${stage}-${index}`,
    organization_id: appUser.organization_id,
    stage,
    order_index: index,
    title,
    description: null,
    is_required: true,
    created_at: new Date().toISOString(),
    is_default: true,
  }))
  return NextResponse.json({ steps: defaults })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const input = await request.json()
  const title = String(input.title ?? '').trim()
  if (!title || !input.stage) return NextResponse.json({ error: 'Titulo e stage obrigatorios' }, { status: 400 })

  const { data, error } = await adminClient
    .from('playbook_steps')
    .insert({
      organization_id: appUser.organization_id,
      stage: input.stage,
      order_index: Number(input.order_index ?? 0),
      title,
      description: input.description || null,
      is_required: input.is_required ?? true,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ step: data }, { status: 201 })
}
