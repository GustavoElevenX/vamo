import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { STAGE_STUCK_DAYS, type DealStage } from '@/types/crm'

export const runtime = 'nodejs'

type Priority = 'low' | 'medium' | 'high' | 'critical'
type QueueType = 'forecast' | 'team' | 'execution' | 'commission' | 'pdi' | 'alert' | 'recommendation' | 'recognition'
type Severity = 'critical' | 'high' | 'medium' | 'opportunity' | 'positive'

type ActionLink = {
  label: string
  href: string
}

type ActionQueueItem = {
  id: string
  type: QueueType
  severity: Severity
  score: number
  title: string
  description: string
  impact: string
  entityName: string | null
  primaryHref: string
  actions: ActionLink[]
}

type Seller = {
  id: string
  name: string
  avatar_url: string | null
}

type Deal = {
  id: string
  title: string
  value: number | string | null
  stage: DealStage
  probability: number | null
  expected_close: string | null
  last_activity_at: string | null
  next_action_title: string | null
  next_action_due_at: string | null
  next_action_status: string | null
  forecast_category: string | null
  ai_priority_score: number | null
  owner_id: string
  updated_at: string | null
  owner?: { id: string; name: string; avatar_url?: string | null } | null
  account?: { id: string; name: string } | null
}

type RawDeal = Omit<Deal, 'owner' | 'account'> & {
  owner?: { id: string; name: string; avatar_url?: string | null } | Array<{ id: string; name: string; avatar_url?: string | null }> | null
  account?: { id: string; name: string } | Array<{ id: string; name: string }> | null
}

type TeamMember = {
  id: string
  name: string
  risk: Severity
  score: number
  reasons: string[]
  href: string
  metrics: {
    energy: number | null
    kpisToday: number
    activeDeals: number
    overdueDeals: number
    currentStreak: number
    lastActivityDate: string | null
    completedMissionsMonth: number
    totalXp: number
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function monthStartIso() {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function currency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function daysSince(value: string | null | undefined) {
  if (!value) return 999
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 999
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

function isOverdue(dateValue: string | null | undefined) {
  if (!dateValue) return false
  const due = new Date(dateValue)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return due < today
}

function severityFromScore(score: number): Severity {
  if (score >= 85) return 'critical'
  if (score >= 65) return 'high'
  if (score >= 35) return 'medium'
  return 'positive'
}

function priorityWeight(priority: unknown) {
  const weights: Record<Priority, number> = { low: 20, medium: 40, high: 70, critical: 90 }
  return weights[String(priority) as Priority] ?? 40
}

function sortByScore<T extends { score: number }>(items: T[]) {
  return [...items].sort((a, b) => b.score - a.score)
}

function dealRiskScore(deal: Deal) {
  const value = numberValue(deal.value)
  const noNextAction = !deal.next_action_title || deal.next_action_status !== 'open'
  const overdue = isOverdue(deal.next_action_due_at)
  const staleDays = daysSince(deal.last_activity_at || deal.updated_at)
  const stuckLimit = STAGE_STUCK_DAYS[deal.stage] ?? 7
  const stuck = staleDays > stuckLimit
  const forecastWeight = deal.forecast_category === 'commit' ? 18 : deal.forecast_category === 'best_case' ? 12 : 6

  return Math.min(100,
    Math.round(Math.min(value / 1000, 30)
      + (noNextAction ? 25 : 0)
      + (overdue ? 25 : 0)
      + (stuck ? 18 : 0)
      + forecastWeight
      + Math.min(numberValue(deal.ai_priority_score) / 5, 20)),
  )
}

function dealRiskReason(deal: Deal) {
  const reasons: string[] = []
  if (!deal.next_action_title || deal.next_action_status !== 'open') reasons.push('sem proximo passo aberto')
  if (isOverdue(deal.next_action_due_at)) reasons.push('follow-up vencido')
  const staleDays = daysSince(deal.last_activity_at || deal.expected_close)
  if (staleDays > (STAGE_STUCK_DAYS[deal.stage] ?? 7)) reasons.push(`${staleDays} dias sem atividade registrada`)
  if (deal.forecast_category === 'commit') reasons.push('marcado como commit')
  return reasons.length ? reasons.join(', ') : 'risco comercial acima dos demais deals abertos'
}

export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const today = todayIso()
    const monthStart = monthStartIso()

    const { data: sellers } = await adminClient
      .from('users')
      .select('id,name,avatar_url')
      .eq('organization_id', appUser.organization_id)
      .eq('role', 'seller')
      .eq('active', true)

    const sellerRows = (sellers ?? []) as Seller[]
    const sellerIds = sellerRows.map((seller) => seller.id)
    const sellerMap = new Map(sellerRows.map((seller) => [seller.id, seller]))

    const [
      dealsResult,
      kpisTodayResult,
      xpResult,
      checkinsResult,
      missionsResult,
      recommendationsResult,
      alertsResult,
      commissionEntriesResult,
      commissionDisputesResult,
      pdiGapsResult,
      pdiPlansResult,
      pdiApplicationsResult,
    ] = await Promise.all([
      adminClient
        .from('crm_deals')
        .select('id,title,value,stage,probability,expected_close,last_activity_at,next_action_title,next_action_due_at,next_action_status,forecast_category,ai_priority_score,owner_id,updated_at,account:crm_accounts(id,name),owner:users!crm_deals_owner_id_fkey(id,name,avatar_url)')
        .eq('organization_id', appUser.organization_id)
        .not('stage', 'in', '("closed_won","closed_lost")'),
      adminClient
        .from('kpi_entries')
        .select('id,user_id,value,points_earned,recorded_at')
        .eq('organization_id', appUser.organization_id)
        .eq('recorded_at', today),
      sellerIds.length
        ? adminClient
          .from('user_xp')
          .select('user_id,total_xp,current_level,current_streak,last_activity_date')
          .eq('organization_id', appUser.organization_id)
          .in('user_id', sellerIds)
        : Promise.resolve({ data: [] }),
      sellerIds.length
        ? adminClient
          .from('daily_checkins')
          .select('user_id,energy_level,intention,obstacle,checkin_date')
          .eq('organization_id', appUser.organization_id)
          .in('user_id', sellerIds)
          .eq('checkin_date', today)
        : Promise.resolve({ data: [] }),
      sellerIds.length
        ? adminClient
          .from('ai_missions')
          .select('id,user_id,title,status,xp_reward,completed_at,created_at')
          .eq('organization_id', appUser.organization_id)
          .in('user_id', sellerIds)
          .gte('created_at', `${monthStart}T00:00:00.000Z`)
        : Promise.resolve({ data: [] }),
      adminClient
        .from('action_recommendations')
        .select('id,target_user_id,source_module,recommendation_type,title,description,suggested_action_label,suggested_action_href,priority,status,due_at,created_at')
        .eq('organization_id', appUser.organization_id)
        .in('status', ['open', 'accepted'])
        .limit(50),
      adminClient
        .from('ai_alerts')
        .select('id,type,severity,title,description,entity_type,entity_id,quick_action,read,created_at')
        .eq('organization_id', appUser.organization_id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(30),
      adminClient
        .from('commission_entries')
        .select('id,seller_id,sale_id,customer_name,product_name,commission_amount,status,status_reason,period_reference,created_at')
        .eq('organization_id', appUser.organization_id)
        .eq('period_reference', monthStart.slice(0, 7))
        .in('status', ['pending', 'disputed']),
      adminClient
        .from('commission_disputes')
        .select('id,seller_id,commission_entry_id,reason,description,status,created_at')
        .eq('organization_id', appUser.organization_id)
        .eq('status', 'under_review'),
      adminClient
        .from('pdi_gaps')
        .select('id,user_id,title,skill_area,severity,status,created_at')
        .eq('organization_id', appUser.organization_id)
        .in('status', ['open', 'in_pdi']),
      adminClient
        .from('pdi_plans')
        .select('id,user_id,title,status,due_date,created_at')
        .eq('organization_id', appUser.organization_id)
        .in('status', ['recommended', 'approved', 'active']),
      adminClient
        .from('pdi_applications')
        .select('id,user_id,plan_id,deal_id,description,status,created_at')
        .eq('organization_id', appUser.organization_id)
        .eq('status', 'submitted'),
    ])

    const deals = ((dealsResult.data ?? []) as unknown as RawDeal[])
      .map<Deal>((deal) => ({
        ...deal,
        value: numberValue(deal.value),
        owner: Array.isArray(deal.owner) ? deal.owner[0] ?? null : deal.owner ?? null,
        account: Array.isArray(deal.account) ? deal.account[0] ?? null : deal.account ?? null,
      }))
    const kpisToday = kpisTodayResult.data ?? []
    const xpRows = xpResult.data ?? []
    const checkins = checkinsResult.data ?? []
    const missions = missionsResult.data ?? []
    const recommendations = recommendationsResult.data ?? []
    const alerts = alertsResult.data ?? []
    const commissionEntries = commissionEntriesResult.data ?? []
    const commissionDisputes = commissionDisputesResult.data ?? []
    const pdiGaps = pdiGapsResult.data ?? []
    const pdiPlans = pdiPlansResult.data ?? []
    const pdiApplications = pdiApplicationsResult.data ?? []

    const kpisBySeller = new Map<string, number>()
    for (const entry of kpisToday as Array<{ user_id: string }>) {
      kpisBySeller.set(entry.user_id, (kpisBySeller.get(entry.user_id) ?? 0) + 1)
    }

    const xpBySeller = new Map<string, { total_xp?: number; current_streak?: number; last_activity_date?: string | null }>()
    for (const xp of xpRows as Array<{ user_id: string; total_xp?: number; current_streak?: number; last_activity_date?: string | null }>) {
      xpBySeller.set(xp.user_id, xp)
    }

    const checkinBySeller = new Map<string, { energy_level?: number | null; obstacle?: string | null }>()
    for (const checkin of checkins as Array<{ user_id: string; energy_level?: number | null; obstacle?: string | null }>) {
      checkinBySeller.set(checkin.user_id, checkin)
    }

    const activeDealsBySeller = new Map<string, Deal[]>()
    for (const deal of deals) {
      const current = activeDealsBySeller.get(deal.owner_id) ?? []
      current.push(deal)
      activeDealsBySeller.set(deal.owner_id, current)
    }

    const completedMissionsBySeller = new Map<string, number>()
    const activeMissions = (missions as Array<{ status: string }>).filter((mission) => ['pending', 'in_progress'].includes(mission.status))
    for (const mission of missions as Array<{ user_id: string; status: string }>) {
      if (mission.status === 'completed') {
        completedMissionsBySeller.set(mission.user_id, (completedMissionsBySeller.get(mission.user_id) ?? 0) + 1)
      }
    }

    const forecastRisks = sortByScore(
      deals
        .map((deal) => ({
          id: deal.id,
          title: deal.title,
          ownerName: deal.owner?.name ?? sellerMap.get(deal.owner_id)?.name ?? 'Vendedor',
          accountName: deal.account?.name ?? null,
          value: numberValue(deal.value),
          stage: deal.stage,
          forecastCategory: deal.forecast_category,
          nextActionDueAt: deal.next_action_due_at,
          score: dealRiskScore(deal),
          reason: dealRiskReason(deal),
          href: `/crm/${deal.id}`,
        }))
        .filter((deal) => deal.score >= 35),
    ).slice(0, 8)

    const team = sortByScore(sellerRows.map<TeamMember>((seller) => {
      const xp = xpBySeller.get(seller.id)
      const checkin = checkinBySeller.get(seller.id)
      const sellerDeals = activeDealsBySeller.get(seller.id) ?? []
      const overdueDeals = sellerDeals.filter((deal) => isOverdue(deal.next_action_due_at) || !deal.next_action_title).length
      const kpiCount = kpisBySeller.get(seller.id) ?? 0
      const currentStreak = numberValue(xp?.current_streak)
      const energy = checkin?.energy_level ?? null
      const reasons: string[] = []
      let score = 0

      if (energy !== null && energy <= 2) {
        score += 35
        reasons.push(`energia ${energy}/5 no check-in`)
      }
      if (kpiCount === 0) {
        score += 18
        reasons.push('sem KPI registrado hoje')
      }
      if (currentStreak === 0) {
        score += 18
        reasons.push('streak zerada')
      }
      if (overdueDeals > 0) {
        score += Math.min(30, overdueDeals * 12)
        reasons.push(`${overdueDeals} deal${overdueDeals > 1 ? 's' : ''} exigindo proximo passo`)
      }
      if (checkin?.obstacle) {
        score += 10
        reasons.push('obstaculo declarado no check-in')
      }

      return {
        id: seller.id,
        name: seller.name,
        risk: severityFromScore(score),
        score,
        reasons,
        href: `/equipe/${seller.id}`,
        metrics: {
          energy,
          kpisToday: kpiCount,
          activeDeals: sellerDeals.length,
          overdueDeals,
          currentStreak,
          lastActivityDate: xp?.last_activity_date ?? null,
          completedMissionsMonth: completedMissionsBySeller.get(seller.id) ?? 0,
          totalXp: numberValue(xp?.total_xp),
        },
      }
    }))

    const teamAttention = team.filter((member) => member.score >= 35).slice(0, 6)
    const teamRecognition = [...team]
      .filter((member) => member.metrics.completedMissionsMonth > 0 || member.metrics.totalXp > 0 || member.metrics.currentStreak >= 5)
      .sort((a, b) => b.metrics.completedMissionsMonth - a.metrics.completedMissionsMonth || b.metrics.totalXp - a.metrics.totalXp)
      .slice(0, 4)
    const teamStable = team.filter((member) => member.score < 35).slice(0, 4)

    const pendingCommissionAmount = (commissionEntries as Array<{ commission_amount: number | string; status: string }>)
      .filter((entry) => entry.status === 'pending')
      .reduce((sum, entry) => sum + numberValue(entry.commission_amount), 0)
    const disputedCommissionAmount = (commissionEntries as Array<{ commission_amount: number | string; status: string }>)
      .filter((entry) => entry.status === 'disputed')
      .reduce((sum, entry) => sum + numberValue(entry.commission_amount), 0)

    const actionQueue: ActionQueueItem[] = []

    for (const deal of forecastRisks.slice(0, 5)) {
      actionQueue.push({
        id: `deal-${deal.id}`,
        type: 'forecast',
        severity: severityFromScore(deal.score),
        score: deal.score,
        title: `${deal.title} precisa de decisao comercial`,
        description: `${deal.ownerName}${deal.accountName ? `, conta ${deal.accountName}` : ''}: ${deal.reason}.`,
        impact: `${currency(deal.value)} em pipeline aberto`,
        entityName: deal.ownerName,
        primaryHref: deal.href,
        actions: [
          { label: 'Ver deal', href: deal.href },
          { label: 'Gerar roteiro', href: `/chat-ia?prompt=${encodeURIComponent(`Gerar roteiro de follow-up para o deal ${deal.title}`)}` },
          { label: 'Ver funil', href: '/monitoramento/funil' },
        ],
      })
    }

    for (const member of teamAttention.slice(0, 5)) {
      actionQueue.push({
        id: `team-${member.id}`,
        type: 'team',
        severity: member.risk,
        score: member.score,
        title: `${member.name} exige atencao do gestor`,
        description: member.reasons.join(', '),
        impact: `${member.metrics.activeDeals} deal${member.metrics.activeDeals === 1 ? '' : 's'} aberto${member.metrics.activeDeals === 1 ? '' : 's'} e ${member.metrics.kpisToday} KPI${member.metrics.kpisToday === 1 ? '' : 's'} hoje`,
        entityName: member.name,
        primaryHref: member.href,
        actions: [
          { label: 'Ver vendedor', href: member.href },
          { label: 'Gerar pauta 1:1', href: `/chat-ia?prompt=${encodeURIComponent(`Gerar pauta de 1:1 para ${member.name} com base nos sinais de execucao, energia e pipeline`)}` },
          { label: 'Criar missao', href: '/missoes' },
        ],
      })
    }

    for (const dispute of (commissionDisputes as Array<{ id: string; seller_id: string; reason: string; description?: string | null }>).slice(0, 3)) {
      const seller = sellerMap.get(dispute.seller_id)
      actionQueue.push({
        id: `commission-dispute-${dispute.id}`,
        type: 'commission',
        severity: 'high',
        score: 68,
        title: `Contestacao de comissao aguardando resposta`,
        description: `${seller?.name ?? 'Vendedor'} abriu contestacao: ${dispute.reason}.`,
        impact: 'Risco de desalinhamento sobre ganho variavel',
        entityName: seller?.name ?? null,
        primaryHref: '/monitoramento/comissionamento',
        actions: [
          { label: 'Revisar comissao', href: '/monitoramento/comissionamento' },
          { label: 'Ver vendedor', href: seller ? `/equipe/${seller.id}` : '/monitoramento/equipe' },
        ],
      })
    }

    if (pendingCommissionAmount > 0) {
      actionQueue.push({
        id: 'commission-pending',
        type: 'commission',
        severity: 'medium',
        score: Math.min(80, 40 + pendingCommissionAmount / 500),
        title: 'Comissoes pendentes no periodo',
        description: `${commissionEntries.length} lancamento${commissionEntries.length === 1 ? '' : 's'} de comissao ainda dependem de recebimento, ajuste ou revisao.`,
        impact: `${currency(pendingCommissionAmount + disputedCommissionAmount)} em comissao nao resolvida`,
        entityName: null,
        primaryHref: '/monitoramento/comissionamento',
        actions: [
          { label: 'Revisar comissoes', href: '/monitoramento/comissionamento' },
        ],
      })
    }

    for (const application of (pdiApplications as Array<{ id: string; user_id: string; description: string }>).slice(0, 3)) {
      const seller = sellerMap.get(application.user_id)
      actionQueue.push({
        id: `pdi-application-${application.id}`,
        type: 'pdi',
        severity: 'medium',
        score: 52,
        title: 'Aplicacao de PDI aguardando validacao',
        description: `${seller?.name ?? 'Vendedor'} enviou evidencia para revisao do gestor.`,
        impact: 'Desenvolvimento aplicado precisa voltar para execucao',
        entityName: seller?.name ?? null,
        primaryHref: '/monitoramento/desenvolvimento',
        actions: [
          { label: 'Validar aplicacao', href: '/monitoramento/desenvolvimento' },
          { label: 'Ver vendedor', href: seller ? `/equipe/${seller.id}` : '/monitoramento/equipe' },
        ],
      })
    }

    for (const recommendation of recommendations as Array<{ id: string; target_user_id: string | null; title: string; description: string | null; priority: Priority; suggested_action_label: string | null; suggested_action_href: string | null; source_module: string }>) {
      const seller = recommendation.target_user_id ? sellerMap.get(recommendation.target_user_id) : null
      actionQueue.push({
        id: `recommendation-${recommendation.id}`,
        type: 'recommendation',
        severity: severityFromScore(priorityWeight(recommendation.priority)),
        score: priorityWeight(recommendation.priority),
        title: recommendation.title,
        description: recommendation.description ?? `Recomendacao gerada pelo modulo ${recommendation.source_module}.`,
        impact: seller ? `Impacta ${seller.name}` : 'Impacta a execucao comercial',
        entityName: seller?.name ?? null,
        primaryHref: recommendation.suggested_action_href || '/monitoramento/alertas',
        actions: [
          { label: recommendation.suggested_action_label || 'Agir agora', href: recommendation.suggested_action_href || '/monitoramento/alertas' },
        ],
      })
    }

    for (const alert of alerts as Array<{ id: string; title: string; description: string | null; severity: string; entity_type: string | null; entity_id: string | null }>) {
      const seller = alert.entity_type === 'user' && alert.entity_id ? sellerMap.get(alert.entity_id) : null
      const score = alert.severity === 'critical' ? 88 : alert.severity === 'warning' ? 58 : alert.severity === 'opportunity' ? 42 : 28
      actionQueue.push({
        id: `alert-${alert.id}`,
        type: 'alert',
        severity: alert.severity === 'critical' ? 'critical' : alert.severity === 'opportunity' ? 'opportunity' : alert.severity === 'positive' ? 'positive' : 'medium',
        score,
        title: alert.title,
        description: alert.description ?? 'Alerta gerado a partir de dados reais da conta.',
        impact: seller ? `Impacta ${seller.name}` : 'Impacta acompanhamento do gestor',
        entityName: seller?.name ?? null,
        primaryHref: seller ? `/equipe/${seller.id}` : '/monitoramento/alertas',
        actions: [
          { label: seller ? 'Ver vendedor' : 'Ver contexto', href: seller ? `/equipe/${seller.id}` : '/monitoramento/alertas' },
        ],
      })
    }

    for (const member of teamRecognition.slice(0, 2)) {
      if (member.score >= 35) continue
      actionQueue.push({
        id: `recognition-${member.id}`,
        type: 'recognition',
        severity: 'opportunity',
        score: 32 + member.metrics.completedMissionsMonth * 4,
        title: `${member.name} tem sinal para reconhecimento`,
        description: `${member.metrics.completedMissionsMonth} missao${member.metrics.completedMissionsMonth === 1 ? '' : 'es'} concluida${member.metrics.completedMissionsMonth === 1 ? '' : 's'} no mes e ${member.metrics.totalXp.toLocaleString('pt-BR')} XP acumulado.`,
        impact: 'Reforca comportamento que pode puxar o time',
        entityName: member.name,
        primaryHref: '/feed',
        actions: [
          { label: 'Reconhecer no feed', href: '/feed' },
          { label: 'Ver vendedor', href: member.href },
        ],
      })
    }

    const sortedQueue = sortByScore(actionQueue).slice(0, 12)
    const topDecision = sortedQueue[0] ?? null

    const forecastRiskAmount = forecastRisks.reduce((sum, deal) => sum + deal.value, 0)
    const dealsWithoutNextStep = deals.filter((deal) => !deal.next_action_title || deal.next_action_status !== 'open').length
    const overdueFollowups = deals.filter((deal) => isOverdue(deal.next_action_due_at)).length
    const sellersWithExecutionToday = new Set<string>([
      ...[...kpisBySeller.keys()],
      ...(checkins as Array<{ user_id: string }>).map((checkin) => checkin.user_id),
      ...(missions as Array<{ user_id: string; status: string; completed_at?: string | null }>).filter((mission) => mission.status === 'completed' && mission.completed_at?.startsWith(today)).map((mission) => mission.user_id),
    ])
    const executionPercent = sellerRows.length ? Math.round((sellersWithExecutionToday.size / sellerRows.length) * 100) : 0

    const principalRisk = topDecision?.title ?? 'Sem intervencao critica detectada com os dados atuais'
    const principalOpportunity = forecastRisks[0]
      ? `${currency(forecastRisks[0].value)} em ${forecastRisks[0].title}`
      : teamRecognition[0]
        ? `Reconhecer ${teamRecognition[0].name} pelo desempenho registrado`
        : 'Nenhuma oportunidade prioritaria detectada'
    const principalPerson = teamAttention[0]?.name ?? teamRecognition[0]?.name ?? null
    const principalAction = topDecision?.actions[0]?.label ?? 'Acompanhar indicadores reais ao longo do dia'

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      manager: {
        id: appUser.id,
        name: appUser.name,
      },
      briefing: {
        title: 'VAMO IA - Briefing do gestor',
        summary: topDecision
          ? `Prioridade de hoje: ${topDecision.title}. ${topDecision.impact}.`
          : 'Ainda nao ha sinais suficientes para recomendar uma intervencao critica. Acompanhe execucao, funil e comissao conforme novos registros entrarem.',
        principalRisk,
        principalOpportunity,
        principalPerson,
        principalAction,
        quickIndicators: [
          { label: 'Pipeline em risco', value: currency(forecastRiskAmount) },
          { label: 'Pessoas em atencao', value: String(teamAttention.length) },
          { label: 'Comissao pendente', value: currency(pendingCommissionAmount + disputedCommissionAmount) },
        ],
      },
      metrics: {
        forecast: {
          title: 'Forecast em risco',
          value: currency(forecastRiskAmount),
          detail: `${dealsWithoutNextStep} sem proximo passo | ${overdueFollowups} follow-up${overdueFollowups === 1 ? '' : 's'} vencido${overdueFollowups === 1 ? '' : 's'}`,
          href: '/monitoramento/funil',
        },
        team: {
          title: 'Equipe em atencao',
          value: String(teamAttention.length),
          detail: `${teamAttention.filter((member) => member.risk === 'critical' || member.risk === 'high').length} risco alto | ${teamRecognition.length} reconhecimento${teamRecognition.length === 1 ? '' : 's'} possivel${teamRecognition.length === 1 ? '' : 's'}`,
          href: '/monitoramento/equipe',
        },
        execution: {
          title: 'Execucao comercial',
          value: `${executionPercent}%`,
          detail: `${kpisToday.length} KPI${kpisToday.length === 1 ? '' : 's'} hoje | ${activeMissions.length} missao${activeMissions.length === 1 ? '' : 'es'} ativa${activeMissions.length === 1 ? '' : 's'}`,
          href: '/performance',
        },
        commission: {
          title: 'Comissao e fechamento',
          value: currency(pendingCommissionAmount + disputedCommissionAmount),
          detail: `${commissionDisputes.length} contestacao${commissionDisputes.length === 1 ? '' : 'es'} | ${commissionEntries.length} lancamento${commissionEntries.length === 1 ? '' : 's'} pendente${commissionEntries.length === 1 ? '' : 's'}`,
          href: '/monitoramento/comissionamento',
        },
      },
      topDecision,
      teamMap: {
        attention: teamAttention,
        recognition: teamRecognition,
        stable: teamStable,
      },
      forecastRisks,
      development: {
        openGaps: pdiGaps.length,
        plansToApprove: (pdiPlans as Array<{ status: string }>).filter((plan) => plan.status === 'recommended').length,
        activePlans: (pdiPlans as Array<{ status: string }>).filter((plan) => ['approved', 'active'].includes(plan.status)).length,
        applicationsToValidate: pdiApplications.length,
        href: '/monitoramento/desenvolvimento',
      },
      commission: {
        pendingAmount: currency(pendingCommissionAmount),
        disputedAmount: currency(disputedCommissionAmount),
        disputes: commissionDisputes.length,
        pendingEntries: commissionEntries.length,
        href: '/monitoramento/comissionamento',
      },
      actionQueue: sortedQueue,
      quickAccess: [
        { label: 'Funil', href: '/monitoramento/funil' },
        { label: 'Equipe', href: '/monitoramento/equipe' },
        { label: 'Saude', href: '/monitoramento/saude-equipe' },
        { label: 'ROI', href: '/monitoramento/roi' },
        { label: 'Comissoes', href: '/monitoramento/comissionamento' },
        { label: 'VAMO IA', href: '/chat-ia' },
      ],
      dataHealth: {
        sellers: sellerRows.length,
        deals: deals.length,
        kpisToday: kpisToday.length,
        recommendations: recommendations.length,
        alerts: alerts.length,
      },
    })
  } catch (error) {
    console.error('GET /api/manager/cockpit', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao montar cockpit do gestor' },
      { status: 500 },
    )
  }
}
