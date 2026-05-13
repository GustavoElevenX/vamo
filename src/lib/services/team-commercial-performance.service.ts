import type { SupabaseClient } from '@supabase/supabase-js'

type PeriodKey = 'today' | 'week' | 'month' | 'quarter' | 'custom'

interface PeriodInput {
  period?: string | null
  start?: string | null
  end?: string | null
}

interface SellerRow {
  id: string
  name: string
  avatar_url: string | null
  role: string
}

interface DealRow {
  id: string
  owner_id: string
  account_id: string | null
  title: string
  value: number | string | null
  stage: string
  probability: number | null
  expected_close: string | null
  updated_at: string
  last_activity_at: string | null
  next_action_title: string | null
  next_action_due_at: string | null
  next_action_status: string | null
  forecast_category: string | null
}

interface ActivityRow {
  id: string
  deal_id: string
  user_id: string
  type: string
  occurred_at: string
}

interface KpiDefinitionRow {
  id: string
  name: string
  unit: string | null
  source_event: string | null
  target_daily: number | string | null
  target_weekly: number | string | null
  target_monthly: number | string | null
  targets: Record<string, unknown> | null
}

interface KpiEntryRow {
  user_id: string
  kpi_id: string
  value: number | string | null
  source_event: string | null
}

interface MissionRow {
  id: string
  user_id: string
  status: string
  target_value: number | string | null
  current_value: number | string | null
  deadline: string | null
  xp_reward: number | string | null
  title: string
  kpi_id: string | null
  type: string | null
  created_by: string | null
}

interface XpRow {
  user_id: string
  total_xp: number | null
  current_level: number | null
  current_streak: number | null
}

interface CheckinRow {
  user_id: string
  energy_level: number | null
}

interface NotificationRow {
  id: string
  user_id: string
  sender_id: string | null
  message: string
  title: string | null
  type: string | null
  source: string | null
  context: Record<string, unknown> | null
  created_at: string
}

export interface CommercialSellerPerformance {
  id: string
  name: string
  avatar_url: string | null
  role: string
  revenue_won: number
  individual_goal: number
  goal_pct: number
  forecast_weighted: number
  open_pipeline: number
  pipeline_at_risk: number
  deals_without_next_action: number
  overdue_followups: number
  stalled_deals: number
  won_deals_count: number
  lost_deals_count: number
  finalized_deals_count: number
  avg_ticket: number
  conversion_rate: number
  activities_count: number
  kpi_execution_pct: number
  followups_done: number
  calls_done: number
  whatsapp_done: number
  emails_done: number
  meetings_booked: number
  proposals_sent: number
  deals_updated: number
  missions_active: number
  missions_completed: number
  missions_overdue: number
  xp: number
  level: number
  streak: number
  checkin_energy: number | null
  commercial_score: number
  commercial_score_label: 'Alto desempenho' | 'No caminho' | 'Atenção' | 'Risco'
  status: 'accelerating' | 'selling_with_risk' | 'executing_not_converting' | 'low_execution'
  status_label: string
  status_message: string
  recommended_action: {
    type: 'risk' | 'execution' | 'coaching' | 'recognition' | 'focus'
    label: string
    reason: string
    href: string
  }
}

export interface CommercialActionQueueItem {
  id: string
  seller_id: string
  seller_name: string
  type: 'risk' | 'execution' | 'coaching' | 'recognition' | 'focus'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  reason: string
  impact_value: number
  suggested_action: string
  message: string
  cta: {
    label: string
    action: string
    href: string
  }
  context: Record<string, unknown>
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function parseCurrency(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '')
  const match = raw.match(/[\d.,]+/)
  if (!match) return 0
  const normalized = match[0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function resolveCommercialPeriod(input: PeriodInput = {}) {
  const now = new Date()
  const requested = (input.period || 'month') as PeriodKey
  let start: Date
  let end: Date
  let label = 'Mes atual'

  if (requested === 'today') {
    start = new Date(now)
    start.setHours(0, 0, 0, 0)
    end = new Date(now)
    end.setHours(23, 59, 59, 999)
    label = 'Hoje'
  } else if (requested === 'week') {
    start = addDays(now, -6)
    start.setHours(0, 0, 0, 0)
    end = new Date(now)
    end.setHours(23, 59, 59, 999)
    label = 'Últimos 7 dias'
  } else if (requested === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    start = new Date(now.getFullYear(), quarterStartMonth, 1)
    end = new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999)
    label = 'Trimestre'
  } else if (requested === 'custom' && input.start && input.end) {
    start = new Date(input.start)
    end = new Date(input.end)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    label = 'Personalizado'
  } else {
    start = monthStart(now)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    label = 'Mes atual'
  }

  return {
    key: requested,
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label,
  }
}

function isOpenDeal(deal: DealRow) {
  return !['closed_won', 'closed_lost'].includes(deal.stage)
}

function isInPeriod(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false
  const date = new Date(value)
  return date >= start && date <= end
}

function isOverdue(value: string | null | undefined) {
  return !!value && new Date(value).getTime() < Date.now()
}

function isDealStalled(deal: DealRow) {
  if (!isOpenDeal(deal)) return false
  const last = deal.last_activity_at || deal.updated_at
  if (!last) return true
  const days = (Date.now() - new Date(last).getTime()) / 86400000
  const threshold = deal.stage === 'negotiation' ? 7 : deal.stage === 'proposal' ? 5 : 4
  return days > threshold
}

function isRiskDeal(deal: DealRow) {
  if (!isOpenDeal(deal)) return false
  const missingNextAction = !deal.next_action_title || deal.next_action_status !== 'open'
  return missingNextAction || isOverdue(deal.next_action_due_at) || isDealStalled(deal)
}

function goalFromProgramGoal(goal: unknown) {
  if (!goal || typeof goal !== 'object') return 0
  const record = goal as Record<string, unknown>
  return parseCurrency(record.valorMeta ?? record.meta ?? record.target ?? record.goal)
}

function buildActionForSeller(seller: Omit<CommercialSellerPerformance, 'recommended_action' | 'status' | 'status_label' | 'status_message' | 'commercial_score_label'>) {
  if (seller.activities_count === 0 || seller.kpi_execution_pct < 30) {
    return {
      status: 'low_execution' as const,
      status_label: 'Baixa execução',
      status_message: 'Precisa de cobrança, missão objetiva ou alinhamento rápido.',
      action: {
        type: 'execution' as const,
        label: 'Enviar nudge',
        reason: 'Baixo volume de ações comerciais registradas no período.',
        href: `/equipe/${seller.id}`,
      },
    }
  }

  if (seller.activities_count >= 8 && seller.conversion_rate < 15 && seller.won_deals_count === 0) {
    return {
      status: 'executing_not_converting' as const,
      status_label: 'Executando, mas não convertendo',
      status_message: 'Precisa de ajuda em proposta, negociacao ou fechamento.',
      action: {
        type: 'coaching' as const,
        label: 'Gerar PDI com IA',
        reason: 'Há execução comercial, mas a conversão em vendas esta baixa.',
        href: '/monitoramento/desenvolvimento',
      },
    }
  }

  if (seller.revenue_won > 0 && seller.pipeline_at_risk > 0) {
    return {
      status: 'selling_with_risk' as const,
      status_label: 'Vendendo, mas com risco',
      status_message: 'Tem potencial de bater meta, mas precisa organizar funil.',
      action: {
        type: 'risk' as const,
        label: 'Criar missão de correcao',
        reason: 'Existe funil em risco apesar de resultado comercial no período.',
        href: `/objetivos/plano-acao?seller=${seller.id}`,
      },
    }
  }

  return {
    status: 'accelerating' as const,
    status_label: 'Acelerando',
    status_message: 'Esta no caminho. Reforce reconhecimento e mantenha o ritmo.',
    action: {
      type: 'recognition' as const,
      label: 'Reconhecer',
      reason: 'Bom ritmo comercial com risco controlado.',
      href: `/equipe/${seller.id}`,
    },
  }
}

function scoreLabel(score: number): CommercialSellerPerformance['commercial_score_label'] {
  if (score >= 80) return 'Alto desempenho'
  if (score >= 60) return 'No caminho'
  if (score >= 40) return 'Atenção'
  return 'Risco'
}

function priorityFromImpact(type: CommercialActionQueueItem['type'], impact: number, seller: CommercialSellerPerformance): CommercialActionQueueItem['priority'] {
  if (type === 'risk' && (impact >= 10000 || seller.overdue_followups > 0)) return 'critical'
  if (type === 'execution' && seller.activities_count === 0) return 'high'
  if (type === 'coaching') return 'high'
  if (type === 'recognition') return 'low'
  return impact > 0 ? 'high' : 'medium'
}

function nudgeMessage(seller: CommercialSellerPerformance, type: CommercialActionQueueItem['type'], impact: number) {
  if (type === 'risk') {
    return `${seller.name}, voce tem ${impact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em oportunidades com risco comercial. Atualize o próximo passo dos deals prioritarios hoje.`
  }
  if (type === 'execution') {
    return `${seller.name}, ainda ha baixa execucao comercial registrada no periodo. Priorize follow-ups e atualize o pipeline antes de abrir novas frentes.`
  }
  if (type === 'coaching') {
    return `${seller.name}, voce esta executando, mas a conversao esta baixa. Revise propostas abertas e tente avancar pelo menos uma oportunidade hoje.`
  }
  if (type === 'recognition') {
    return `${seller.name}, boa performance comercial no periodo. Continue puxando ritmo de venda e mantendo o pipeline organizado.`
  }
  return `${seller.name}, seu maior impacto hoje esta nas oportunidades com maior chance de fechamento. Foque nelas primeiro.`
}

export async function getTeamCommercialPerformance(
  supabase: SupabaseClient,
  organizationId: string,
  input: PeriodInput & { sellerId?: string | null } = {},
) {
  const period = resolveCommercialPeriod(input)

  const [
    sellersRes,
    dealsRes,
    kpisRes,
    entriesRes,
    missionsRes,
    xpRes,
    checkinsRes,
    goalsRes,
    notificationsRes,
    recommendationsRes,
    commissionsRes,
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id,name,avatar_url,role')
      .eq('organization_id', organizationId)
      .eq('role', 'seller')
      .eq('active', true),
    supabase
      .from('crm_deals')
      .select('id,owner_id,account_id,title,value,stage,probability,expected_close,updated_at,last_activity_at,next_action_title,next_action_due_at,next_action_status,forecast_category')
      .eq('organization_id', organizationId),
    supabase
      .from('kpi_definitions')
      .select('id,name,unit,source_event,target_daily,target_weekly,target_monthly,targets')
      .eq('organization_id', organizationId)
      .eq('active', true),
    supabase
      .from('kpi_entries')
      .select('user_id,kpi_id,value,source_event')
      .eq('organization_id', organizationId)
      .gte('recorded_at', period.startIso)
      .lte('recorded_at', period.endIso),
    supabase
      .from('ai_missions')
      .select('id,user_id,status,target_value,current_value,deadline,xp_reward,title,kpi_id,type,created_by')
      .eq('organization_id', organizationId),
    supabase
      .from('user_xp')
      .select('user_id,total_xp,current_level,current_streak')
      .eq('organization_id', organizationId),
    supabase
      .from('daily_checkins')
      .select('user_id,energy_level')
      .eq('organization_id', organizationId)
      .gte('checkin_date', period.start.toISOString().slice(0, 10))
      .lte('checkin_date', period.end.toISOString().slice(0, 10)),
    supabase
      .from('program_goals')
      .select('company_goal,team_goal,individual_goals')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('notifications')
      .select('id,user_id,sender_id,message,title,type,source,context,created_at')
      .eq('organization_id', organizationId)
      .eq('source', 'team_nudge')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('action_recommendations')
      .select('id,target_user_id,title,description,recommendation_type,priority,status,created_at,metadata')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('commission_entries')
      .select('seller_id,status,commission_amount,received_amount,sale_amount')
      .eq('organization_id', organizationId),
  ])

  if (sellersRes.error) throw sellersRes.error
  if (dealsRes.error) throw dealsRes.error
  if (kpisRes.error) throw kpisRes.error
  if (entriesRes.error) throw entriesRes.error
  if (missionsRes.error) throw missionsRes.error
  if (xpRes.error) throw xpRes.error
  if (checkinsRes.error) throw checkinsRes.error

  const allSellers = ((sellersRes.data ?? []) as SellerRow[]).filter((seller) => !input.sellerId || seller.id === input.sellerId)
  const sellerIds = allSellers.map((seller) => seller.id)
  const deals = ((dealsRes.data ?? []) as DealRow[]).filter((deal) => sellerIds.includes(deal.owner_id))
  const dealIds = deals.map((deal) => deal.id)

  const activitiesRes = dealIds.length
    ? await supabase
      .from('crm_activities')
      .select('id,deal_id,user_id,type,occurred_at')
      .in('deal_id', dealIds)
      .gte('occurred_at', period.startIso)
      .lte('occurred_at', period.endIso)
    : { data: [], error: null }

  if (activitiesRes.error) throw activitiesRes.error

  const activities = (activitiesRes.data ?? []) as ActivityRow[]
  const kpis = (kpisRes.data ?? []) as KpiDefinitionRow[]
  const entries = (entriesRes.data ?? []) as KpiEntryRow[]
  const missions = (missionsRes.data ?? []) as MissionRow[]
  const xpRows = (xpRes.data ?? []) as XpRow[]
  const checkins = (checkinsRes.data ?? []) as CheckinRow[]
  const notifications = (notificationsRes.data ?? []) as NotificationRow[]
  const recommendations = recommendationsRes.data ?? []
  const commissions = commissionsRes.data ?? []

  const goals = goalsRes.data as { company_goal?: unknown; team_goal?: unknown; individual_goals?: Array<{ user_id: string; goal?: string }> } | null
  const teamGoalFromCompany = goalFromProgramGoal(goals?.company_goal)
  const teamGoalFromTeam = goalFromProgramGoal(goals?.team_goal)
  const monthlyGoal = teamGoalFromCompany || teamGoalFromTeam || 0
  const fallbackIndividualGoal = allSellers.length && monthlyGoal ? monthlyGoal / allSellers.length : 0
  const individualGoalMap = new Map<string, number>()
  for (const goal of goals?.individual_goals ?? []) {
    individualGoalMap.set(goal.user_id, parseCurrency(goal.goal))
  }

  const xpMap = new Map(xpRows.map((xp) => [xp.user_id, xp]))
  const checkinMap = new Map<string, number>()
  for (const checkin of checkins) {
    if (checkin.energy_level != null) checkinMap.set(checkin.user_id, num(checkin.energy_level))
  }

  const targetByKpi = new Map<string, number>()
  for (const kpi of kpis) {
    const target = period.key === 'today'
      ? num(kpi.target_daily ?? kpi.targets?.daily, 0)
      : period.key === 'week'
        ? num(kpi.target_weekly ?? kpi.targets?.weekly, 0)
        : num(kpi.target_monthly ?? kpi.targets?.monthly, 0)
    targetByKpi.set(kpi.id, target)
  }

  const sellers: CommercialSellerPerformance[] = allSellers.map((seller) => {
    const sellerDeals = deals.filter((deal) => deal.owner_id === seller.id)
    const openDeals = sellerDeals.filter(isOpenDeal)
    const wonDeals = sellerDeals.filter((deal) => deal.stage === 'closed_won' && isInPeriod(deal.updated_at, period.start, period.end))
    const lostDeals = sellerDeals.filter((deal) => deal.stage === 'closed_lost' && isInPeriod(deal.updated_at, period.start, period.end))
    const riskDeals = openDeals.filter(isRiskDeal)
    const noNextActionDeals = openDeals.filter((deal) => !deal.next_action_title || deal.next_action_status !== 'open')
    const overdueDeals = openDeals.filter((deal) => isOverdue(deal.next_action_due_at))
    const stalledDeals = openDeals.filter(isDealStalled)
    const sellerActivities = activities.filter((activity) => {
      const deal = deals.find((item) => item.id === activity.deal_id)
      return deal?.owner_id === seller.id
    })
    const sellerEntries = entries.filter((entry) => entry.user_id === seller.id)
    const sellerMissions = missions.filter((mission) => mission.user_id === seller.id)
    const activeMissions = sellerMissions.filter((mission) => ['pending', 'in_progress', 'awaiting_approval'].includes(mission.status))
    const completedMissions = sellerMissions.filter((mission) => mission.status === 'completed' && (!mission.deadline || isInPeriod(mission.deadline, period.start, period.end)))
    const overdueMissions = sellerMissions.filter((mission) => ['pending', 'in_progress'].includes(mission.status) && isOverdue(mission.deadline))
    const revenueWon = wonDeals.reduce((sum, deal) => sum + num(deal.value), 0)
    const openPipeline = openDeals.reduce((sum, deal) => sum + num(deal.value), 0)
    const forecastWeighted = openDeals.reduce((sum, deal) => sum + num(deal.value) * num(deal.probability) / 100, 0)
    const pipelineAtRisk = riskDeals.reduce((sum, deal) => sum + num(deal.value), 0)
    const finalized = wonDeals.length + lostDeals.length
    const conversionRate = finalized ? wonDeals.length / finalized * 100 : 0
    const avgTicket = wonDeals.length ? revenueWon / wonDeals.length : 0
    const individualGoal = individualGoalMap.get(seller.id) || fallbackIndividualGoal
    const goalPct = individualGoal ? revenueWon / individualGoal * 100 : 0

    const followupsDone = sellerActivities.filter((activity) => ['follow_up', 'whatsapp'].includes(activity.type)).length
    const callsDone = sellerActivities.filter((activity) => activity.type === 'call').length
    const whatsappDone = sellerActivities.filter((activity) => activity.type === 'whatsapp').length
    const emailsDone = sellerActivities.filter((activity) => activity.type === 'email').length
    const meetingsBooked = sellerActivities.filter((activity) => activity.type === 'meeting').length
    const proposalsSent = sellerActivities.filter((activity) => activity.type === 'proposal_sent').length
    const dealsUpdated = sellerEntries.filter((entry) => entry.source_event === 'crm_deal_updated').length

    const kpiProgressValues = kpis.map((kpi) => {
      const target = targetByKpi.get(kpi.id) ?? 0
      if (!target) return null
      const current = sellerEntries
        .filter((entry) => entry.kpi_id === kpi.id)
        .reduce((sum, entry) => sum + num(entry.value), 0)
      return clamp(current / target * 100)
    }).filter((value): value is number => value != null)
    const fallbackExecutionPct = clamp(sellerActivities.length / 20 * 100)
    const kpiExecutionPct = kpiProgressValues.length
      ? Math.round(kpiProgressValues.reduce((sum, value) => sum + value, 0) / kpiProgressValues.length)
      : Math.round(fallbackExecutionPct)

    const forecastHealth = individualGoal ? clamp((revenueWon + forecastWeighted) / individualGoal * 100) : clamp(forecastWeighted / 50000 * 100)
    const riskPenalty = openPipeline ? clamp(pipelineAtRisk / openPipeline * 100) : 0
    const commercialScore = Math.round(clamp(
      clamp(goalPct) * 0.35 +
      forecastHealth * 0.2 +
      clamp(conversionRate) * 0.2 +
      kpiExecutionPct * 0.15 -
      riskPenalty * 0.1,
    ))

    const base = {
      id: seller.id,
      name: seller.name,
      avatar_url: seller.avatar_url,
      role: seller.role,
      revenue_won: revenueWon,
      individual_goal: individualGoal,
      goal_pct: Math.round(goalPct),
      forecast_weighted: forecastWeighted,
      open_pipeline: openPipeline,
      pipeline_at_risk: pipelineAtRisk,
      deals_without_next_action: noNextActionDeals.length,
      overdue_followups: overdueDeals.length,
      stalled_deals: stalledDeals.length,
      won_deals_count: wonDeals.length,
      lost_deals_count: lostDeals.length,
      finalized_deals_count: finalized,
      avg_ticket: avgTicket,
      conversion_rate: Math.round(conversionRate),
      activities_count: sellerActivities.length,
      kpi_execution_pct: kpiExecutionPct,
      followups_done: followupsDone,
      calls_done: callsDone,
      whatsapp_done: whatsappDone,
      emails_done: emailsDone,
      meetings_booked: meetingsBooked,
      proposals_sent: proposalsSent,
      deals_updated: dealsUpdated,
      missions_active: activeMissions.length,
      missions_completed: completedMissions.length,
      missions_overdue: overdueMissions.length,
      xp: num(xpMap.get(seller.id)?.total_xp),
      level: num(xpMap.get(seller.id)?.current_level, 1),
      streak: num(xpMap.get(seller.id)?.current_streak),
      checkin_energy: checkinMap.get(seller.id) ?? null,
      commercial_score: commercialScore,
    }

    const diagnostic = buildActionForSeller(base)
    return {
      ...base,
      commercial_score_label: scoreLabel(commercialScore),
      status: diagnostic.status,
      status_label: diagnostic.status_label,
      status_message: diagnostic.status_message,
      recommended_action: diagnostic.action,
    }
  }).sort((a, b) => b.commercial_score - a.commercial_score || b.revenue_won - a.revenue_won)

  const summary = {
    monthly_goal: monthlyGoal,
    revenue_won: sellers.reduce((sum, seller) => sum + seller.revenue_won, 0),
    forecast_weighted: sellers.reduce((sum, seller) => sum + seller.forecast_weighted, 0),
    gap_to_goal: 0,
    gap_real: 0,
    avg_ticket: 0,
    won_deals_count: sellers.reduce((sum, seller) => sum + seller.won_deals_count, 0),
    open_pipeline: sellers.reduce((sum, seller) => sum + seller.open_pipeline, 0),
    pipeline_at_risk: sellers.reduce((sum, seller) => sum + seller.pipeline_at_risk, 0),
    deals_without_next_action: sellers.reduce((sum, seller) => sum + seller.deals_without_next_action, 0),
    overdue_followups: sellers.reduce((sum, seller) => sum + seller.overdue_followups, 0),
    stalled_deals: sellers.reduce((sum, seller) => sum + seller.stalled_deals, 0),
    pending_receipts: commissions
      .filter((entry: any) => ['pending', 'blocked', 'scheduled'].includes(String(entry.status)))
      .reduce((sum: number, entry: any) => sum + num(entry.received_amount || entry.sale_amount), 0),
  }
  summary.gap_to_goal = Math.max(0, summary.monthly_goal - summary.revenue_won - summary.forecast_weighted)
  summary.gap_real = Math.max(0, summary.monthly_goal - summary.revenue_won)
  summary.avg_ticket = summary.won_deals_count ? summary.revenue_won / summary.won_deals_count : 0

  const topRevenueSeller = [...sellers].sort((a, b) => b.revenue_won - a.revenue_won)[0] ?? null
  const topRiskSeller = [...sellers].sort((a, b) => b.pipeline_at_risk - a.pipeline_at_risk)[0] ?? null
  const recognitionSeller = sellers.find((seller) => seller.status === 'accelerating') ?? topRevenueSeller
  const attentionSeller = sellers.find((seller) => seller.status !== 'accelerating') ?? topRiskSeller

  const actionQueue: CommercialActionQueueItem[] = sellers.flatMap((seller) => {
    const items: CommercialActionQueueItem[] = []
    if (seller.pipeline_at_risk > 0) {
      items.push({
        id: `${seller.id}:risk`,
        seller_id: seller.id,
        seller_name: seller.name,
        type: 'risk',
        priority: priorityFromImpact('risk', seller.pipeline_at_risk, seller),
        title: `${seller.name} tem pipeline em risco`,
        reason: `${seller.deals_without_next_action} deals sem proxima acao, ${seller.overdue_followups} follow-ups atrasados e ${seller.stalled_deals} deals parados.`,
        impact_value: seller.pipeline_at_risk,
        suggested_action: 'Criar missão de correcao e cobrar atualizacao do funil.',
        message: nudgeMessage(seller, 'risk', seller.pipeline_at_risk),
        cta: { label: 'Ver funil', action: 'open_pipeline', href: `/crm?owner_id=${seller.id}` },
        context: { value_at_risk: seller.pipeline_at_risk, deals_without_next_action: seller.deals_without_next_action, overdue_followups: seller.overdue_followups },
      })
    }
    if (seller.status === 'low_execution') {
      items.push({
        id: `${seller.id}:execution`,
        seller_id: seller.id,
        seller_name: seller.name,
        type: 'execution',
        priority: priorityFromImpact('execution', 0, seller),
        title: `${seller.name} esta com baixa execucao`,
        reason: `${seller.activities_count} acoes comerciais registradas no periodo e ${seller.kpi_execution_pct}% de execucao medida.`,
        impact_value: 0,
        suggested_action: 'Enviar nudge de execução e criar missão simples de retorno.',
        message: nudgeMessage(seller, 'execution', 0),
        cta: { label: 'Enviar nudge', action: 'send_nudge', href: `/equipe/${seller.id}` },
        context: { activities_count: seller.activities_count, kpi_execution_pct: seller.kpi_execution_pct },
      })
    }
    if (seller.status === 'executing_not_converting') {
      items.push({
        id: `${seller.id}:coaching`,
        seller_id: seller.id,
        seller_name: seller.name,
        type: 'coaching',
        priority: 'high',
        title: `${seller.name} executa, mas nao converte`,
        reason: `${seller.activities_count} acoes, ${seller.proposals_sent} propostas e ${seller.conversion_rate}% de conversao.`,
        impact_value: seller.forecast_weighted,
        suggested_action: 'Gerar PDI de proposta, negociacao ou fechamento e criar pauta de 1:1.',
        message: nudgeMessage(seller, 'coaching', seller.forecast_weighted),
        cta: { label: 'Gerar PDI com IA', action: 'generate_pdi', href: '/monitoramento/desenvolvimento' },
        context: { activities_count: seller.activities_count, proposals_sent: seller.proposals_sent, conversion_rate: seller.conversion_rate },
      })
    }
    if (seller.status === 'accelerating' && seller.revenue_won > 0) {
      items.push({
        id: `${seller.id}:recognition`,
        seller_id: seller.id,
        seller_name: seller.name,
        type: 'recognition',
        priority: 'low',
        title: `${seller.name} merece reconhecimento`,
        reason: `${seller.revenue_won.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vendido e score comercial ${seller.commercial_score}.`,
        impact_value: seller.revenue_won,
        suggested_action: 'Reconhecer no mural ou enviar nudge positivo.',
        message: nudgeMessage(seller, 'recognition', seller.revenue_won),
        cta: { label: 'Reconhecer', action: 'recognize', href: `/equipe/${seller.id}` },
        context: { revenue_won: seller.revenue_won, commercial_score: seller.commercial_score },
      })
    }
    return items
  }).sort((a, b) => {
    const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }
    return priorityWeight[b.priority] - priorityWeight[a.priority] || b.impact_value - a.impact_value
  }).slice(0, 12)

  const executionByEvent = [
    { event: 'crm_activity_follow_up', label: 'retornos' },
    { event: 'crm_activity_call', label: 'Ligacoes' },
    { event: 'crm_activity_whatsapp', label: 'WhatsApps' },
    { event: 'crm_activity_meeting', label: 'Reunioes' },
    { event: 'crm_activity_proposal_sent', label: 'Propostas' },
    { event: 'crm_deal_updated', label: 'oportunidades atualizados' },
    { event: 'crm_deal_won', label: 'Vendas ganhas' },
  ].map((item) => {
    const relatedKpis = kpis.filter((kpi) => kpi.source_event === item.event)
    const target = relatedKpis.reduce((sum, kpi) => sum + (targetByKpi.get(kpi.id) ?? 0), 0)
    const done = entries
      .filter((entry) => entry.source_event === item.event || relatedKpis.some((kpi) => kpi.id === entry.kpi_id))
      .reduce((sum, entry) => sum + num(entry.value), 0)
    const leader = sellers
      .map((seller) => ({
        name: seller.name,
        value: entries
          .filter((entry) => entry.user_id === seller.id && (entry.source_event === item.event || relatedKpis.some((kpi) => kpi.id === entry.kpi_id)))
          .reduce((sum, entry) => sum + num(entry.value), 0),
      }))
      .sort((a, b) => b.value - a.value)[0]
    const lagging = sellers
      .map((seller) => ({
        name: seller.name,
        value: entries
          .filter((entry) => entry.user_id === seller.id && (entry.source_event === item.event || relatedKpis.some((kpi) => kpi.id === entry.kpi_id)))
          .reduce((sum, entry) => sum + num(entry.value), 0),
      }))
      .sort((a, b) => a.value - b.value)[0]
    return {
      ...item,
      done,
      target,
      pct: target ? Math.round(clamp(done / target * 100)) : null,
      leader: leader?.value ? leader.name : null,
      lagging: lagging?.name ?? null,
    }
  })

  const missionSummary = {
    active: missions.filter((mission) => sellerIds.includes(mission.user_id) && ['pending', 'in_progress', 'awaiting_approval'].includes(mission.status)).length,
    completed: missions.filter((mission) => sellerIds.includes(mission.user_id) && mission.status === 'completed').length,
    overdue: missions.filter((mission) => sellerIds.includes(mission.user_id) && ['pending', 'in_progress'].includes(mission.status) && isOverdue(mission.deadline)).length,
    estimated_pipeline_impact: actionQueue.filter((item) => item.type === 'risk').reduce((sum, item) => sum + item.impact_value, 0),
    critical: actionQueue.find((item) => item.type === 'risk') ?? null,
  }

  const risks = {
    deals_without_next_action: summary.deals_without_next_action,
    overdue_followups: summary.overdue_followups,
    stalled_deals: summary.stalled_deals,
    pipeline_at_risk: summary.pipeline_at_risk,
    top_risk_seller: topRiskSeller ? {
      id: topRiskSeller.id,
      name: topRiskSeller.name,
      value: topRiskSeller.pipeline_at_risk,
    } : null,
  }

  const gamification = {
    total_xp: sellers.reduce((sum, seller) => sum + seller.xp, 0),
    avg_streak: sellers.length ? Math.round(sellers.reduce((sum, seller) => sum + seller.streak, 0) / sellers.length) : 0,
    engagement_ranking: [...sellers].sort((a, b) => b.xp - a.xp).slice(0, 5).map((seller) => ({
      id: seller.id,
      name: seller.name,
      xp: seller.xp,
      streak: seller.streak,
      energy: seller.checkin_energy,
    })),
  }

  const aiReading = {
    title: 'VAMO IA - Leitura da equipe',
    summary: summary.revenue_won > 0
      ? `O time vendeu ${summary.revenue_won.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no periodo e tem ${summary.forecast_weighted.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de forecast provavel.`
      : 'Nenhuma venda ganha registrada no período. Comece pelos oportunidades em proposta, retornos atrasados e vendedores sem ação comercial.',
    goal: monthlyGoal
      ? `Meta comercial: ${monthlyGoal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Gap real: ${summary.gap_real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
      : 'Meta comercial do período ainda não foi cadastrada.',
    risk: summary.pipeline_at_risk > 0
      ? `Principal risco: ${summary.pipeline_at_risk.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em pipeline com pendencias comerciais.`
      : 'Funil sem risco comercial relevante pelos critérios atuais.',
    opportunity: topRevenueSeller
      ? `${topRevenueSeller.name} lidera em receita vendida no periodo.`
      : 'Ainda não há líder comercial claro no período.',
    attention: attentionSeller
      ? `${attentionSeller.name} precisa de atencao: ${attentionSeller.status_message}`
      : 'Nenhum vendedor em atencao critica no momento.',
    recognition: recognitionSeller
      ? `${recognitionSeller.name} merece reconhecimento ou reforco positivo.`
      : 'Reconhecimento será sugerido assim que houver resultado comercial no período.',
    priority: actionQueue[0]?.suggested_action ?? 'Comece criando próximas ações para oportunidades abertas e missão simples de retorno.',
  }

  const sellerProfile = input.sellerId && sellers[0]
    ? {
        seller: sellers[0],
        deals: deals.filter((deal) => deal.owner_id === input.sellerId),
        activities: activities.filter((activity) => {
          const deal = deals.find((item) => item.id === activity.deal_id)
          return deal?.owner_id === input.sellerId
        }),
        missions: missions.filter((mission) => mission.user_id === input.sellerId),
        nudges: notifications.filter((notification) => notification.user_id === input.sellerId),
        recommendations: recommendations.filter((recommendation: any) => recommendation.target_user_id === input.sellerId),
      }
    : null

  return {
    period: {
      start: period.startIso,
      end: period.endIso,
      label: period.label,
      key: period.key,
    },
    summary,
    ai_reading: aiReading,
    sellers,
    action_queue: actionQueue,
    execution: executionByEvent,
    missions: missionSummary,
    risks,
    gamification,
    seller_profile: sellerProfile,
  }
}
