import type { SupabaseClient } from '@supabase/supabase-js'
import { buildManagerCockpit } from './manager-cockpit.service'
import { getManagerTodayContext } from './performance-os.service'
import { getTeamCommercialPerformance } from './team-commercial-performance.service'

function currency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function compactLines(lines: Array<string | null | undefined | false>) {
  return lines.filter(Boolean).join('\n')
}

function buildExecutiveSummary(cockpit: Awaited<ReturnType<typeof buildManagerCockpit>>, teamPerformance: Awaited<ReturnType<typeof getTeamCommercialPerformance>>) {
  const { summary } = teamPerformance
  const priority = cockpit.topDecision?.title ?? teamPerformance.ai_reading.priority

  return {
    resumo: cockpit.briefing.summary,
    prioridadeHoje: priority,
    gapMeta: summary.gap_to_goal,
    receitaGanha: summary.revenue_won,
    forecastProvavel: summary.forecast_weighted,
    pipelineEmRisco: summary.pipeline_at_risk,
    execucaoCritica: summary.deals_without_next_action + summary.overdue_followups + summary.stalled_deals,
  }
}

function buildRiskMap(cockpit: Awaited<ReturnType<typeof buildManagerCockpit>>, teamPerformance: Awaited<ReturnType<typeof getTeamCommercialPerformance>>) {
  return {
    riscoPrincipal: cockpit.briefing.principalRisk,
    vendedoresCriticos: cockpit.teamMap.attention.map((seller) => ({
      id: seller.id,
      nome: seller.name,
      score: seller.score,
      motivos: seller.reasons,
      href: seller.href,
    })),
    oportunidadesEmRisco: cockpit.forecastRisks.map((risk) => ({
      id: risk.id,
      titulo: risk.title,
      vendedor: risk.ownerName,
      valor: risk.value,
      motivo: risk.reason,
      href: risk.href,
    })),
    indicadores: {
      dealsSemProximaAcao: teamPerformance.summary.deals_without_next_action,
      followupsAtrasados: teamPerformance.summary.overdue_followups,
      dealsParados: teamPerformance.summary.stalled_deals,
      missoesAtrasadas: teamPerformance.missions.overdue,
    },
  }
}

function buildOpportunityMap(cockpit: Awaited<ReturnType<typeof buildManagerCockpit>>, teamPerformance: Awaited<ReturnType<typeof getTeamCommercialPerformance>>) {
  return {
    oportunidadePrincipal: cockpit.briefing.principalOpportunity,
    reconhecimentos: cockpit.teamMap.recognition.map((seller) => ({
      id: seller.id,
      nome: seller.name,
      motivo: seller.reasons[0],
      href: seller.href,
    })),
    vendedoresComPotencial: teamPerformance.sellers
      .filter((seller) => seller.forecast_weighted > 0 || seller.status === 'selling_with_risk')
      .slice(0, 5)
      .map((seller) => ({
        id: seller.id,
        nome: seller.name,
        forecast: seller.forecast_weighted,
        pipelineAberto: seller.open_pipeline,
        acao: seller.recommended_action.label,
      })),
  }
}

function buildRecommendedActions(cockpit: Awaited<ReturnType<typeof buildManagerCockpit>>, teamPerformance: Awaited<ReturnType<typeof getTeamCommercialPerformance>>) {
  return [
    ...cockpit.actionQueue.map((item) => ({
      id: item.id,
      titulo: item.title,
      prioridade: item.severity,
      impacto: item.impact,
      contexto: item.description,
      href: item.primaryHref,
      acoes: item.actions,
    })),
    ...teamPerformance.action_queue.slice(0, 5).map((item) => ({
      id: `commercial-${item.id}`,
      titulo: item.title,
      prioridade: item.priority,
      impacto: item.impact_value ? currency(item.impact_value) : item.suggested_action,
      contexto: item.reason,
      href: item.cta.href,
      acoes: [{ label: item.cta.label, href: item.cta.href }],
    })),
  ].slice(0, 12)
}

function buildLLMContext(
  executiveSummary: ReturnType<typeof buildExecutiveSummary>,
  risks: ReturnType<typeof buildRiskMap>,
  opportunities: ReturnType<typeof buildOpportunityMap>,
  recommendedActions: ReturnType<typeof buildRecommendedActions>,
  recentEvents: Awaited<ReturnType<typeof getManagerTodayContext>>,
) {
  const topSellers = risks.vendedoresCriticos.slice(0, 5)
  const topRisks = risks.oportunidadesEmRisco.slice(0, 5)
  const topActions = recommendedActions.slice(0, 8)

  return compactLines([
    '\n\nCONTEXTO OPERACIONAL DO GESTOR (Commercial Brain):',
    `Resumo executivo: ${executiveSummary.resumo}`,
    `Prioridade de hoje: ${executiveSummary.prioridadeHoje}`,
    `Receita ganha: ${currency(executiveSummary.receitaGanha)} | Forecast provavel: ${currency(executiveSummary.forecastProvavel)} | Gap de meta: ${currency(executiveSummary.gapMeta)}`,
    `Pipeline em risco: ${currency(executiveSummary.pipelineEmRisco)} | Pendencias comerciais: ${executiveSummary.execucaoCritica}`,
    `Risco principal: ${risks.riscoPrincipal}`,
    topSellers.length
      ? `Vendedores em atencao: ${topSellers.map((seller) => `${seller.nome} (${seller.motivos.join('; ')}) [id: ${seller.id}]`).join(' | ')}`
      : 'Vendedores em atencao: nenhum sinal critico no momento.',
    topRisks.length
      ? `Oportunidades/pipeline em risco: ${topRisks.map((risk) => `${risk.titulo} com ${risk.vendedor}, ${currency(risk.valor)} (${risk.motivo})`).join(' | ')}`
      : 'Oportunidades/funil em risco: nenhum risco relevante detectado.',
    opportunities.reconhecimentos.length
      ? `Reconhecimentos possiveis: ${opportunities.reconhecimentos.map((seller) => `${seller.nome} (${seller.motivo}) [id: ${seller.id}]`).join(' | ')}`
      : null,
    topActions.length
      ? `Acoes recomendadas abertas: ${topActions.map((action) => `${action.titulo} (${action.prioridade}) - ${action.contexto}`).join(' | ')}`
      : 'Ações recomendadas abertas: nenhuma ação priorizada.',
    `Eventos recentes registrados: ${recentEvents.events.length}; recomendacoes abertas: ${recentEvents.recommendations.length}; gaps de PDI: ${recentEvents.pdiGaps.length}; calibracoes de saude: ${recentEvents.healthCalibrations.length}.`,
    'Use esse contexto para diagnosticar, decidir, simular e executar. Quando uma ação envolver alterar banco, enviar mensagem, criar missão, PDI, meta, comissão ou XP, proponha tool com confirmacao.',
  ])
}

export async function buildCommercialBrainContext(
  adminClient: SupabaseClient,
  organizationId: string,
  managerId: string,
  managerName = 'Gestor',
) {
  const [cockpit, teamPerformance, recentEvents] = await Promise.all([
    buildManagerCockpit(adminClient, organizationId, managerId, managerName),
    getTeamCommercialPerformance(adminClient, organizationId, { period: 'month' }),
    getManagerTodayContext(adminClient, managerId, organizationId),
  ])

  const executiveSummary = buildExecutiveSummary(cockpit, teamPerformance)
  const risks = buildRiskMap(cockpit, teamPerformance)
  const opportunities = buildOpportunityMap(cockpit, teamPerformance)
  const recommendedActions = buildRecommendedActions(cockpit, teamPerformance)
  const llmContext = buildLLMContext(executiveSummary, risks, opportunities, recommendedActions, recentEvents)

  return {
    cockpit,
    teamPerformance,
    recentEvents,
    executiveSummary,
    risks,
    opportunities,
    recommendedActions,
    llmContext,
  }
}
