import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const dealId = new URL(request.url).searchParams.get('deal_id')
  if (!dealId) return NextResponse.json({ error: 'deal_id obrigatorio' }, { status: 400 })

  const { data: deal } = await adminClient
    .from('crm_deals')
    .select('id, owner_id')
    .eq('id', dealId)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()
  if (!deal || (appUser.role === 'seller' && deal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'Deal nao encontrado' }, { status: 404 })
  }

  const { data, error } = await adminClient
    .from('playbook_step_completions')
    .select('*')
    .eq('deal_id', dealId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ completions: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const input = await request.json()
  const stepId = String(input.step_id ?? '')
  const dealId = String(input.deal_id ?? '')
  const completed = input.completed !== false
  if (!stepId || !dealId || stepId.startsWith('default-')) {
    return NextResponse.json({ error: 'Passo customizado obrigatorio para salvar conclusao' }, { status: 400 })
  }

  const { data: deal } = await adminClient
    .from('crm_deals')
    .select('id, owner_id')
    .eq('id', dealId)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()
  if (!deal || (appUser.role === 'seller' && deal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'Deal nao encontrado' }, { status: 404 })
  }

  if (completed) {
    const { error } = await adminClient
      .from('playbook_step_completions')
      .upsert({ step_id: stepId, deal_id: dealId, user_id: appUser.id }, { onConflict: 'step_id,deal_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await adminClient
      .from('playbook_step_completions')
      .delete()
      .eq('step_id', stepId)
      .eq('deal_id', dealId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
