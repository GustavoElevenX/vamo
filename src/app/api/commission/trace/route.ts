import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { generateCommissionExplanation } from '@/lib/services/contextual-ai.service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const url = new URL(request.url)
  const dealId = url.searchParams.get('dealId')
  const calculationId = url.searchParams.get('calculationId')

  if (calculationId) {
    const explanation = await generateCommissionExplanation(adminClient, calculationId)
    return NextResponse.json({ explanation })
  }

  if (!dealId) return NextResponse.json({ error: 'dealId ou calculationId obrigatorio' }, { status: 400 })

  const { data: deal } = await adminClient
    .from('crm_deals')
    .select('id,title,value,owner_id,organization_id,stage,probability')
    .eq('id', dealId)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()

  if (!deal || (appUser.role === 'seller' && deal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'oportunidade não encontrado' }, { status: 404 })
  }

  const [receipts, lineItems] = await Promise.all([
    adminClient
      .from('deal_payment_receipts')
      .select('*')
      .eq('deal_id', dealId)
      .order('due_at', { ascending: true }),
    adminClient
      .from('commission_line_items')
      .select('*, calculation:commission_calculations(id,status,total,forecast_commission,released_commission,pending_commission,blocked_commission,block_reason)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false }),
  ])

  const receiptRows = receipts.data ?? []
  const itemRows = lineItems.data ?? []
  const expectedCommission = itemRows.reduce((sum, item) => sum + Number(item.valor || 0) + Number(item.bonus_amount || 0), 0)
  const releasedCommission = itemRows
    .filter((item) => item.release_status === 'released')
    .reduce((sum, item) => sum + Number(item.valor || 0) + Number(item.bonus_amount || 0), 0)
  const pendingCommission = itemRows
    .filter((item) => ['pending', 'forecast'].includes(String(item.release_status)))
    .reduce((sum, item) => sum + Number(item.valor || 0) + Number(item.bonus_amount || 0), 0)
  const blockedCommission = itemRows
    .filter((item) => item.release_status === 'blocked')
    .reduce((sum, item) => sum + Number(item.valor || 0) + Number(item.bonus_amount || 0), 0)

  return NextResponse.json({
    trace: {
      deal,
      receipts: receiptRows,
      lineItems: itemRows,
      expectedCommission,
      releasedCommission,
      pendingCommission,
      blockedCommission,
      reason: blockedCommission > 0
        ? 'Há comissão bloqueada por regra ou pagamento pendente.'
        : pendingCommission > 0
          ? 'Aguardando pagamento ou fechamento para liberar comissão.'
          : 'Comissão liberada conforme registros atuais.',
    },
  })
}
