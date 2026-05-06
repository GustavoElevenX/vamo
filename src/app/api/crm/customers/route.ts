import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

type DealStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
type CustomerStatus =
  | 'new_customer'
  | 'pending_receipt'
  | 'without_post_sale'
  | 'post_sale'
  | 'active'
  | 'expansion_open'
  | 'inactive'
  | 'at_risk'

type AccountRow = {
  id: string
  name: string
  segment: string | null
  cnpj: string | null
  website: string | null
  notes: string | null
}

type DealRow = {
  id: string
  account_id: string | null
  owner_id: string
  title: string
  value: number | string | null
  stage: DealStage
  next_action_title: string | null
  next_action_due_at: string | null
  next_action_status: string | null
  received_amount?: number | string | null
  updated_at: string
  created_at: string
  owner?: { id: string; name: string } | null
}

type ActivityRow = {
  id: string
  deal_id: string
  occurred_at: string
  title: string
  type: string
}

const OPEN_STAGES: DealStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation']

const statusLabels: Record<CustomerStatus, string> = {
  new_customer: 'Novo cliente',
  pending_receipt: 'Recebimento pendente',
  without_post_sale: 'Sem pos-venda',
  post_sale: 'Em pos-venda',
  active: 'Ativo',
  expansion_open: 'Com expansao aberta',
  inactive: 'Inativo',
  at_risk: 'Em risco',
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function daysSince(value: string | null | undefined) {
  if (!value) return 999
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 999
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

function isOverdue(value: string | null | undefined) {
  if (!value) return false
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < Date.now()
}

function monthStart() {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

function currency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function maxDate(values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => value ? new Date(value).getTime() : Number.NaN)
    .filter((value) => Number.isFinite(value))

  if (!timestamps.length) return null
  return new Date(Math.max(...timestamps)).toISOString()
}

function minDate(values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => value ? new Date(value).getTime() : Number.NaN)
    .filter((value) => Number.isFinite(value))

  if (!timestamps.length) return null
  return new Date(Math.min(...timestamps)).toISOString()
}

function calculatePriority(input: {
  pendingReceivable: number
  withoutPostSale: boolean
  hasOpenExpansion: boolean
  nextActionOverdue: boolean
  daysWithoutActivity: number
  wonRevenue: number
}) {
  let score = 0
  if (input.pendingReceivable > 0) score += 25
  if (input.withoutPostSale) score += 25
  if (input.hasOpenExpansion) score += 20
  if (input.nextActionOverdue) score += 20
  if (input.daysWithoutActivity > 30) score += 15
  if (input.wonRevenue > 10000) score += 15
  return Math.min(100, score)
}

function getSuggestedAction(status: CustomerStatus) {
  const actions: Record<CustomerStatus, string> = {
    new_customer: 'Criar acao de onboarding ou check-in de pos-venda.',
    pending_receipt: 'Revisar recebimento antes de liberar comissao.',
    without_post_sale: 'Agendar contato de pos-venda e registrar a proxima acao.',
    post_sale: 'Acompanhar a acao combinada e registrar resultado.',
    active: 'Manter cadencia e buscar indicacao ou expansao.',
    expansion_open: 'Atualizar proxima acao da oportunidade de expansao.',
    inactive: 'Gerar mensagem de reativacao.',
    at_risk: 'Intervir hoje com contato direto ou alinhamento com responsavel.',
  }
  return actions[status]
}

export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error

    const { adminClient, appUser } = auth
    const isSeller = appUser.role === 'seller'

    const [accountsResult, dealsResult] = await Promise.all([
      adminClient
        .from('crm_accounts')
        .select('id,name,segment,cnpj,website,notes')
        .eq('organization_id', appUser.organization_id)
        .order('name'),
      adminClient
        .from('crm_deals')
        .select('id,account_id,owner_id,title,value,stage,next_action_title,next_action_due_at,next_action_status,received_amount,updated_at,created_at,owner:users!crm_deals_owner_id_fkey(id,name)')
        .eq('organization_id', appUser.organization_id),
    ])

    if (accountsResult.error) return NextResponse.json({ error: accountsResult.error.message }, { status: 500 })
    if (dealsResult.error) return NextResponse.json({ error: dealsResult.error.message }, { status: 500 })

    const accounts = (accountsResult.data ?? []) as AccountRow[]
    const deals = ((dealsResult.data ?? []) as unknown as Array<Omit<DealRow, 'owner'> & { owner?: DealRow['owner'] | DealRow['owner'][] }>)
      .filter((deal) => deal.account_id)
      .map<DealRow>((deal) => ({
        ...deal,
        owner: Array.isArray(deal.owner) ? deal.owner[0] ?? null : deal.owner ?? null,
      }))

    const accountIds = accounts.map((account) => account.id)
    const { data: activitiesData, error: activitiesError } = accountIds.length
      ? await adminClient
        .from('crm_activities')
        .select('id,deal_id,occurred_at,title,type,deal:crm_deals!inner(account_id,organization_id)')
        .eq('deal.organization_id', appUser.organization_id)
        .in('deal.account_id', accountIds)
      : { data: [], error: null }

    if (activitiesError) return NextResponse.json({ error: activitiesError.message }, { status: 500 })

    const activities = (activitiesData ?? []) as unknown as ActivityRow[]
    const activitiesByDeal = new Map<string, ActivityRow[]>()
    for (const activity of activities) {
      const current = activitiesByDeal.get(activity.deal_id) ?? []
      current.push(activity)
      activitiesByDeal.set(activity.deal_id, current)
    }

    const month = monthStart()
    const customers = accounts
      .map((account) => {
        const accountDeals = deals.filter((deal) => deal.account_id === account.id)
        const visibleDeals = isSeller
          ? accountDeals.filter((deal) => deal.owner_id === appUser.id)
          : accountDeals
        const hasOrgWonDeal = accountDeals.some((deal) => deal.stage === 'closed_won')
        const hasSellerRelation = !isSeller || accountDeals.some((deal) => deal.owner_id === appUser.id && (deal.stage === 'closed_won' || OPEN_STAGES.includes(deal.stage)))
        if (!hasOrgWonDeal || !hasSellerRelation) return null

        const wonDeals = visibleDeals.filter((deal) => deal.stage === 'closed_won')
        const openDeals = visibleDeals.filter((deal) => OPEN_STAGES.includes(deal.stage))
        if (isSeller && wonDeals.length === 0 && openDeals.length === 0) return null

        const wonRevenue = wonDeals.reduce((sum, deal) => sum + numberValue(deal.value), 0)
        const received = wonDeals.reduce((sum, deal) => sum + numberValue(deal.received_amount), 0)
        const pendingReceivable = Math.max(0, wonRevenue - received)
        const openPipelineValue = openDeals.reduce((sum, deal) => sum + numberValue(deal.value), 0)
        const wonDates = wonDeals.map((deal) => deal.updated_at || deal.created_at)
        const lastWonAt = maxDate(wonDates)
        const firstWonAt = minDate(wonDates)
        const dealActivities = visibleDeals.flatMap((deal) => activitiesByDeal.get(deal.id) ?? [])
        const lastActivityAt = maxDate(dealActivities.map((activity) => activity.occurred_at))
        const hasPostSaleActivity = Boolean(lastWonAt && dealActivities.some((activity) => new Date(activity.occurred_at).getTime() > new Date(lastWonAt).getTime()))
        const postSaleNextAction = wonDeals.find((deal) => {
          if (!deal.next_action_title || !deal.next_action_due_at) return false
          if (!lastWonAt) return true
          return new Date(deal.next_action_due_at).getTime() >= new Date(lastWonAt).getTime()
        })
        const withoutPostSale = wonDeals.length > 0 && !hasPostSaleActivity && !postSaleNextAction
        const nextActionDeal = [...openDeals, ...wonDeals]
          .filter((deal) => deal.next_action_title && deal.next_action_status === 'open')
          .sort((a, b) => new Date(a.next_action_due_at ?? '2999-12-31').getTime() - new Date(b.next_action_due_at ?? '2999-12-31').getTime())[0] ?? null
        const nextActionOverdue = isOverdue(nextActionDeal?.next_action_due_at)
        const hasOpenExpansion = openDeals.length > 0
        const daysWithoutActivity = daysSince(lastActivityAt ?? lastWonAt)
        const isNewCustomer = Boolean(firstWonAt && new Date(firstWonAt).getTime() >= month.getTime())

        const priorityScore = calculatePriority({
          pendingReceivable,
          withoutPostSale,
          hasOpenExpansion,
          nextActionOverdue,
          daysWithoutActivity,
          wonRevenue,
        })

        let status: CustomerStatus = 'active'
        if (priorityScore >= 70) status = 'at_risk'
        else if (pendingReceivable > 0) status = 'pending_receipt'
        else if (withoutPostSale) status = 'without_post_sale'
        else if (hasOpenExpansion) status = 'expansion_open'
        else if (daysWithoutActivity > 60) status = 'inactive'
        else if (isNewCustomer) status = 'new_customer'
        else if (hasPostSaleActivity || postSaleNextAction) status = 'post_sale'

        const owner = visibleDeals.find((deal) => deal.owner)?.owner ?? accountDeals.find((deal) => deal.owner)?.owner ?? null

        return {
          id: account.id,
          name: account.name,
          segment: account.segment,
          cnpj: account.cnpj,
          website: account.website,
          owner,
          status,
          status_label: statusLabels[status],
          won_revenue: wonRevenue,
          won_deals_count: wonDeals.length,
          average_ticket: wonDeals.length ? wonRevenue / wonDeals.length : 0,
          last_won_at: lastWonAt,
          last_activity_at: lastActivityAt,
          pending_receivable: pendingReceivable,
          has_open_expansion: hasOpenExpansion,
          open_pipeline_value: openPipelineValue,
          next_action_title: nextActionDeal?.next_action_title ?? null,
          next_action_due_at: nextActionDeal?.next_action_due_at ?? null,
          priority_score: priorityScore,
          suggested_action: getSuggestedAction(status),
          href: `/crm/clientes?customer=${account.id}`,
          pipeline_href: `/crm?account=${account.id}`,
        }
      })
      .filter((customer): customer is NonNullable<typeof customer> => Boolean(customer))
      .sort((a, b) => b.priority_score - a.priority_score || b.won_revenue - a.won_revenue)

    const totalCustomers = customers.length
    const wonRevenue = customers.reduce((sum, customer) => sum + customer.won_revenue, 0)
    const wonDealsCount = customers.reduce((sum, customer) => sum + customer.won_deals_count, 0)
    const pendingReceivables = customers.reduce((sum, customer) => sum + customer.pending_receivable, 0)
    const newCustomersThisMonth = customers.filter((customer) => customer.status === 'new_customer' || (customer.last_won_at && new Date(customer.last_won_at).getTime() >= month.getTime())).length
    const customersWithoutPostSale = customers.filter((customer) => customer.status === 'without_post_sale').length
    const customersWithOpenExpansion = customers.filter((customer) => customer.has_open_expansion).length
    const inactiveCustomers = customers.filter((customer) => customer.status === 'inactive').length
    const atRiskCustomers = customers.filter((customer) => customer.status === 'at_risk').length
    const topFiveRevenue = [...customers].sort((a, b) => b.won_revenue - a.won_revenue).slice(0, 5).reduce((sum, customer) => sum + customer.won_revenue, 0)

    const bySellerMap = new Map<string, {
      seller_id: string
      seller_name: string
      customers_count: number
      won_revenue: number
      average_ticket: number
      pending_receivables: number
      customers_without_post_sale: number
      customers_at_risk: number
    }>()

    for (const customer of customers) {
      const sellerId = customer.owner?.id ?? 'unassigned'
      const current = bySellerMap.get(sellerId) ?? {
        seller_id: sellerId,
        seller_name: customer.owner?.name ?? 'Sem responsavel',
        customers_count: 0,
        won_revenue: 0,
        average_ticket: 0,
        pending_receivables: 0,
        customers_without_post_sale: 0,
        customers_at_risk: 0,
      }
      current.customers_count += 1
      current.won_revenue += customer.won_revenue
      current.pending_receivables += customer.pending_receivable
      if (customer.status === 'without_post_sale') current.customers_without_post_sale += 1
      if (customer.status === 'at_risk') current.customers_at_risk += 1
      current.average_ticket = current.customers_count ? current.won_revenue / current.customers_count : 0
      bySellerMap.set(sellerId, current)
    }

    const bySegmentMap = new Map<string, {
      segment: string
      customers_count: number
      won_revenue: number
      average_ticket: number
      pending_receivables: number
    }>()

    for (const customer of customers) {
      const segment = customer.segment || 'Sem segmento'
      const current = bySegmentMap.get(segment) ?? {
        segment,
        customers_count: 0,
        won_revenue: 0,
        average_ticket: 0,
        pending_receivables: 0,
      }
      current.customers_count += 1
      current.won_revenue += customer.won_revenue
      current.pending_receivables += customer.pending_receivable
      current.average_ticket = current.customers_count ? current.won_revenue / current.customers_count : 0
      bySegmentMap.set(segment, current)
    }

    const criticalCustomers = customers
      .filter((customer) => customer.priority_score >= 40)
      .slice(0, 8)
      .map((customer) => ({
        id: customer.id,
        name: customer.name,
        reason: customer.status_label,
        impact_value: customer.pending_receivable || customer.open_pipeline_value || customer.won_revenue,
        suggested_action: customer.suggested_action,
        href: customer.pipeline_href,
      }))

    const priority = atRiskCustomers > 0 || pendingReceivables > 0
      ? 'high'
      : customersWithoutPostSale > 0
        ? 'medium'
        : 'low'

    const briefingDescription = totalCustomers
      ? isSeller
        ? `Sua carteira tem ${totalCustomers} cliente${totalCustomers === 1 ? '' : 's'} e ${currency(wonRevenue)} em vendas ganhas. ${customersWithoutPostSale} cliente${customersWithoutPostSale === 1 ? '' : 's'} estao sem pos-venda e ${currency(pendingReceivables)} aparecem como recebimento pendente.`
        : `A base tem ${totalCustomers} cliente${totalCustomers === 1 ? '' : 's'} e ${currency(wonRevenue)} em vendas ganhas. ${customersWithoutPostSale} cliente${customersWithoutPostSale === 1 ? '' : 's'} estao sem pos-venda, ${currency(pendingReceivables)} estao pendentes de recebimento e ${customersWithOpenExpansion} tem expansao aberta.`
      : 'Ainda nao existem contas com venda ganha para formar a carteira de clientes.'

    return NextResponse.json({
      summary: {
        total_customers: totalCustomers,
        new_customers_this_month: newCustomersThisMonth,
        won_revenue: wonRevenue,
        average_won_ticket: wonDealsCount ? wonRevenue / wonDealsCount : 0,
        average_revenue_per_customer: totalCustomers ? wonRevenue / totalCustomers : 0,
        pending_receivables: pendingReceivables,
        customers_without_post_sale: customersWithoutPostSale,
        customers_with_open_expansion: customersWithOpenExpansion,
        inactive_customers: inactiveCustomers,
        at_risk_customers: atRiskCustomers,
        top_5_concentration_pct: wonRevenue ? Math.round((topFiveRevenue / wonRevenue) * 100) : 0,
      },
      briefing: {
        title: isSeller ? 'VAMO IA - Leitura da carteira' : 'VAMO IA - Leitura da base',
        description: briefingDescription,
        recommended_action: criticalCustomers[0]?.suggested_action ?? 'Mantenha a carteira atualizada com pos-venda, recebimento e oportunidades de expansao.',
        priority,
      },
      customers,
      by_seller: [...bySellerMap.values()].sort((a, b) => b.won_revenue - a.won_revenue),
      by_segment: [...bySegmentMap.values()].sort((a, b) => b.won_revenue - a.won_revenue),
      critical_customers: criticalCustomers,
    })
  } catch (error) {
    console.error('GET /api/crm/customers', error)
    return NextResponse.json({ error: 'Erro ao carregar carteira de clientes' }, { status: 500 })
  }
}
