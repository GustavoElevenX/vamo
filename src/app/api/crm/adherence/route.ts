import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const [{ data: deals }, { data: steps }, { data: completions }] = await Promise.all([
    adminClient.from('crm_deals').select('id, owner_id, stage, owner:users!crm_deals_owner_id_fkey(id,name)').eq('organization_id', appUser.organization_id).not('stage', 'in', '("closed_won","closed_lost")'),
    adminClient.from('playbook_steps').select('id, stage, is_required').eq('organization_id', appUser.organization_id).eq('is_required', true),
    adminClient.from('playbook_step_completions').select('step_id, deal_id'),
  ])

  const stepsByStage = new Map<string, string[]>()
  for (const step of steps ?? []) {
    const list = stepsByStage.get(step.stage) ?? []
    list.push(step.id)
    stepsByStage.set(step.stage, list)
  }
  const completed = new Set((completions ?? []).map((c: any) => `${c.deal_id}:${c.step_id}`))
  const bySeller = new Map<string, { seller_id: string; name: string; total_steps_required: number; total_steps_completed: number }>()

  for (const deal of deals ?? []) {
    const seller = bySeller.get(deal.owner_id) ?? {
      seller_id: deal.owner_id,
      name: (deal.owner as any)?.name ?? 'Vendedor',
      total_steps_required: 0,
      total_steps_completed: 0,
    }
    const required = stepsByStage.get(deal.stage) ?? []
    seller.total_steps_required += required.length
    seller.total_steps_completed += required.filter((stepId) => completed.has(`${deal.id}:${stepId}`)).length
    bySeller.set(deal.owner_id, seller)
  }

  const adherence = Array.from(bySeller.values()).map((row) => ({
    ...row,
    adherence_pct: row.total_steps_required > 0
      ? Math.round((row.total_steps_completed / row.total_steps_required) * 100)
      : 0,
  }))
  return NextResponse.json({ adherence })
}
