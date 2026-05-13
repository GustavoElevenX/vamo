import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getTeamCommercialPerformance,
  type CommercialActionQueueItem,
  type CommercialSellerPerformance,
} from './team-commercial-performance.service'

type Severity = 'critical' | 'high' | 'medium' | 'opportunity' | 'positive'

function currency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function priorityToSeverity(priority: CommercialActionQueueItem['priority']): Severity {
  if (priority === 'critical') return 'critical'
  if (priority === 'high') return 'high'
  if (priority === 'medium') return 'medium'
  return 'positive'
}

function sellerSeverity(seller: CommercialSellerPerformance): Severity {
  if (seller.commercial_score < 30 || seller.pipeline_at_risk > 0 || seller.overdue_followups > 0) return 'critical'
  if (seller.commercial_score < 50 || seller.status === 'low_execution') return 'high'
  if (seller.commercial_score < 70 || seller.status !== 'accelerating') return 'medium'
  return 'positive'
}

function sellerScore(seller: CommercialSellerPerformance) {
  return Math.max(0, Math.min(100, 100 - seller.commercial_score + Math.min(seller.pipeline_at_risk / 1000, 25)))
}

function actionHrefFor(item: CommercialActionQueueItem) {
  if (item.cta?.href) return item.cta.href
  if (item.seller_id) return `/equipe/${item.seller_id}`
  return '/monitoramento/equipe'
}

function buildQueueItem(item: CommercialActionQueueItem) {
  const primaryHref = actionHrefFor(item)

  return {
    id: item.id,
    type: item.type === 'risk' ? 'forecast' : item.type === 'recognition' ? 'recognition' : 'team',
    severity: priorityToSeverity(item.priority),
    score: item.priority === 'critical' ? 90 : item.priority === 'high' ? 72 : item.priority === 'medium' ? 50 : 32,
    title: item.title,
    description: item.reason,
    impact: item.impact_value > 0 ? currency(item.impact_value) : item.suggested_action,
    entityName: item.seller_name,
    primaryHref,
    actions: [
      { label: item.cta?.label || 'Ver contexto', href: primaryHref },
      {
        label: 'Pedir analise a IA',
        href: `/chat-ia?prompt=${encodeURIComponent(`Analise ${item.seller_name} e recomende a melhor acao. Contexto: ${item.reason}`)}`,
      },
      {
        label: item.type === 'recognition' ? 'Gerar reconhecimento' : 'Criar plano',
        href: `/chat-ia?prompt=${encodeURIComponent(`Crie um plano de acao para ${item.seller_name}. Contexto: ${item.reason}`)}`,
      },
    ],
  }
}

export async function buildManagerCockpit(
  adminClient: SupabaseClient,
  organizationId: string,
  managerId: string,
  managerName = 'Gestor',
) {
  const performance = await getTeamCommercialPerformance(adminClient, organizationId, { period: 'month' })
  const { summary, sellers, action_queue: commercialQueue, missions, risks, ai_reading } = performance

  const pdiResult = await adminClient
    .from('pdi_plans')
    .select('id,status')
    .eq('organization_id', organizationId)
    .in('status', ['recommended', 'pending_approval', 'approved', 'active'])

  const pdiGapsResult = await adminClient
    .from('pdi_gaps')
    .select('id')
    .eq('organization_id', organizationId)
    .in('status', ['open', 'in_pdi'])

  const pdiApplicationsResult = await adminClient
    .from('pdi_applications')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'submitted')

  const commissionEntriesResult = await adminClient
    .from('commission_entries')
    .select('id,commission_amount,status')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'disputed'])

  const alertsResult = await adminClient
    .from('ai_alerts')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('read', false)

  const recommendationsResult = await adminClient
    .from('action_recommendations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'open')

  const pdiPlans = pdiResult.data ?? []
  const pdiGaps = pdiGapsResult.data ?? []
  const pdiApplications = pdiApplicationsResult.data ?? []
  const commissionEntries = commissionEntriesResult.data ?? []
  const alerts = alertsResult.data ?? []
  const recommendations = recommendationsResult.data ?? []

  const attention = [...sellers]
    .filter((seller) => seller.status !== 'accelerating' || seller.pipeline_at_risk > 0 || seller.overdue_followups > 0 || seller.missions_overdue > 0)
    .sort((a, b) => sellerScore(b) - sellerScore(a))
    .slice(0, 6)
    .map((seller) => ({
      id: seller.id,
      name: seller.name,
      risk: sellerSeverity(seller),
      score: sellerScore(seller),
      reasons: [
        seller.status_message,
        seller.pipeline_at_risk > 0 ? `${currency(seller.pipeline_at_risk)} em pipeline em risco` : '',
        seller.overdue_followups > 0 ? `${seller.overdue_followups} follow-up(s) atrasado(s)` : '',
        seller.deals_without_next_action > 0 ? `${seller.deals_without_next_action} deal(s) sem proxima acao` : '',
      ].filter(Boolean),
      href: `/equipe/${seller.id}`,
      metrics: {
        energy: seller.checkin_energy,
        kpisToday: seller.activities_count,
        activeDeals: seller.open_pipeline > 0 ? 1 : 0,
        overdueDeals: seller.overdue_followups + seller.deals_without_next_action,
        currentStreak: seller.streak,
        lastActivityDate: null,
        completedMissionsMonth: seller.missions_completed,
        totalXp: seller.xp,
      },
    }))

  const recognition = [...sellers]
    .filter((seller) => seller.status === 'accelerating' || seller.revenue_won > 0 || seller.missions_completed > 0)
    .sort((a, b) => b.revenue_won - a.revenue_won || b.missions_completed - a.missions_completed || b.xp - a.xp)
    .slice(0, 4)
    .map((seller) => ({
      id: seller.id,
      name: seller.name,
      risk: 'positive' as Severity,
      score: Math.max(20, seller.commercial_score),
      reasons: [seller.status_message],
      href: `/equipe/${seller.id}`,
      metrics: {
        energy: seller.checkin_energy,
        kpisToday: seller.activities_count,
        activeDeals: seller.open_pipeline > 0 ? 1 : 0,
        overdueDeals: seller.overdue_followups + seller.deals_without_next_action,
        currentStreak: seller.streak,
        lastActivityDate: null,
        completedMissionsMonth: seller.missions_completed,
        totalXp: seller.xp,
      },
    }))

  const stable = [...sellers]
    .filter((seller) => !attention.some((member) => member.id === seller.id))
    .slice(0, 4)
    .map((seller) => ({
      id: seller.id,
      name: seller.name,
      risk: 'positive' as Severity,
      score: seller.commercial_score,
      reasons: [seller.status_message],
      href: `/equipe/${seller.id}`,
      metrics: {
        energy: seller.checkin_energy,
        kpisToday: seller.activities_count,
        activeDeals: seller.open_pipeline > 0 ? 1 : 0,
        overdueDeals: seller.overdue_followups + seller.deals_without_next_action,
        currentStreak: seller.streak,
        lastActivityDate: null,
        completedMissionsMonth: seller.missions_completed,
        totalXp: seller.xp,
      },
    }))

  const actionQueue = commercialQueue.slice(0, 12).map(buildQueueItem)
  const topDecision = actionQueue[0] ?? null
  const forecastRisks = sellers
    .filter((seller) => seller.pipeline_at_risk > 0 || seller.deals_without_next_action > 0 || seller.overdue_followups > 0)
    .sort((a, b) => b.pipeline_at_risk - a.pipeline_at_risk || b.overdue_followups - a.overdue_followups)
    .slice(0, 8)
    .map((seller) => ({
      id: seller.id,
      title: `Pipeline de ${seller.name}`,
      ownerName: seller.name,
      accountName: null,
      value: seller.pipeline_at_risk,
      stage: 'open',
      forecastCategory: 'risk',
      nextActionDueAt: null,
      score: sellerScore(seller),
      reason: `${seller.deals_without_next_action} deal(s) sem proxima acao, ${seller.overdue_followups} follow-up(s) atrasado(s)`,
      href: `/crm?owner_id=${seller.id}`,
    }))

  const pendingCommissionAmount = commissionEntries
    .filter((entry: any) => entry.status === 'pending')
    .reduce((sum: number, entry: any) => sum + Number(entry.commission_amount || 0), 0)
  const disputedCommissionAmount = commissionEntries
    .filter((entry: any) => entry.status === 'disputed')
    .reduce((sum: number, entry: any) => sum + Number(entry.commission_amount || 0), 0)
  const executionPercent = sellers.length
    ? Math.round((sellers.filter((seller) => seller.activities_count > 0 || seller.missions_completed > 0).length / sellers.length) * 100)
    : 0

  return {
    generatedAt: new Date().toISOString(),
    manager: {
      id: managerId,
      name: managerName,
    },
    briefing: {
      title: 'VAMO IA - Briefing do gestor',
      summary: topDecision
        ? `Prioridade de hoje: ${topDecision.title}. ${topDecision.impact}.`
        : ai_reading.summary,
      principalRisk: topDecision?.title ?? ai_reading.risk,
      principalOpportunity: ai_reading.opportunity,
      principalPerson: attention[0]?.name ?? recognition[0]?.name ?? null,
      principalAction: topDecision?.actions[0]?.label ?? ai_reading.priority,
      quickIndicators: [
        { label: 'Funil em risco', value: currency(summary.pipeline_at_risk) },
        { label: 'Gap de meta', value: currency(summary.gap_to_goal) },
        { label: 'Pessoas em atencao', value: String(attention.length) },
      ],
    },
    metrics: {
      forecast: {
        title: 'Previsão em risco',
        value: currency(summary.pipeline_at_risk),
        detail: `${summary.deals_without_next_action} sem próximo passo | ${summary.overdue_followups} follow-up(s) vencido(s)`,
        href: '/monitoramento/funil',
      },
      team: {
        title: 'Equipe em atencao',
        value: String(attention.length),
        detail: `${attention.filter((member) => member.risk === 'critical' || member.risk === 'high').length} risco alto | ${recognition.length} reconhecimento(s) possivel(is)`,
        href: '/monitoramento/equipe',
      },
      execution: {
        title: 'Execução comercial',
        value: `${executionPercent}%`,
        detail: `${summary.deals_without_next_action + summary.overdue_followups} pendencia(s) de pipeline | ${missions.active} missao(oes) ativa(s)`,
        href: '/monitoramento/missoes',
      },
      commission: {
        title: 'Comissão e fechamento',
        value: currency(pendingCommissionAmount + disputedCommissionAmount),
        detail: `${commissionEntries.length} lancamento(s) pendente(s) ou contestado(s)`,
        href: '/monitoramento/comissionamento',
      },
    },
    topDecision,
    teamMap: {
      attention,
      recognition,
      stable,
    },
    forecastRisks,
    development: {
      openGaps: pdiGaps.length,
      plansToApprove: pdiPlans.filter((plan: any) => ['recommended', 'pending_approval'].includes(plan.status)).length,
      activePlans: pdiPlans.filter((plan: any) => ['approved', 'active'].includes(plan.status)).length,
      applicationsToValidate: pdiApplications.length,
      href: '/monitoramento/desenvolvimento',
    },
    commission: {
      pendingAmount: currency(pendingCommissionAmount),
      disputedAmount: currency(disputedCommissionAmount),
      disputes: commissionEntries.filter((entry: any) => entry.status === 'disputed').length,
      pendingEntries: commissionEntries.length,
      href: '/monitoramento/comissionamento',
    },
    actionQueue,
    quickAccess: [
      { label: 'Funil', href: '/monitoramento/funil' },
      { label: 'Equipe', href: '/monitoramento/equipe' },
      { label: 'Saúde', href: '/monitoramento/saude-equipe' },
      { label: 'ROI', href: '/monitoramento/roi' },
      { label: 'Comissões', href: '/monitoramento/comissionamento' },
      { label: 'VAMO IA', href: '/chat-ia' },
    ],
    dataHealth: {
      sellers: sellers.length,
      deals: summary.open_pipeline > 0 ? 1 : 0,
      kpisToday: sellers.reduce((sum, seller) => sum + seller.activities_count, 0),
      recommendations: recommendations.length,
      alerts: alerts.length,
    },
    source: {
      summary,
      risks,
    },
  }
}
