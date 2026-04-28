import type { DiagnosticArea } from '@/types'

type AreaScore = { score: number; max: number; pct: number }

type KpiRecommendation = {
  name: string
  unit: string
  source: 'CRM' | 'manual'
  monthlyTarget: number
  rationale: string
}

export type PerformanceInsight = {
  status: 'needs_diagnostic' | 'ready'
  title: string
  message: string
  confidence: 'baixa' | 'media' | 'alta'
  source: {
    diagnosticId?: string
    diagnosticDate?: string
    healthPct?: number
    weakestArea?: string
    weakestAreaPct?: number
    activeKpis: number
    recentKpiEntries: number
    activeMissions: number
  }
  kpiRecommendation?: KpiRecommendation
}

const AREA_LABELS: Record<DiagnosticArea, string> = {
  lead_generation: 'Geração de Leads',
  sales_process: 'Processo de Vendas',
  team_management: 'Gestão de Equipe',
  tools_technology: 'Ferramentas e Tecnologia',
}

const KPI_BY_AREA: Record<DiagnosticArea, Omit<KpiRecommendation, 'rationale'>> = {
  lead_generation: {
    name: 'Leads qualificados gerados',
    unit: 'leads',
    source: 'CRM',
    monthlyTarget: 120,
  },
  sales_process: {
    name: 'Taxa de conversão de propostas',
    unit: '%',
    source: 'CRM',
    monthlyTarget: 30,
  },
  team_management: {
    name: 'Aderência às missões do time',
    unit: '%',
    source: 'manual',
    monthlyTarget: 85,
  },
  tools_technology: {
    name: 'Atualização do CRM no prazo',
    unit: '%',
    source: 'CRM',
    monthlyTarget: 95,
  },
}

function parseMonthlyGoal(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()

  if (normalized.includes('abaixo') && normalized.includes('50')) return 50_000
  if (normalized.includes('50') && normalized.includes('200')) return 125_000
  if (normalized.includes('200') && normalized.includes('500')) return 350_000
  if (normalized.includes('500') && normalized.includes('2m')) return 1_250_000
  if (normalized.includes('2m')) return 2_000_000

  return null
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  })
}

function getWeakestArea(areaScores: Record<string, AreaScore> | null | undefined) {
  const entries = Object.entries(areaScores ?? {}) as [DiagnosticArea, AreaScore][]
  return entries
    .filter(([, score]) => typeof score?.pct === 'number')
    .sort(([, a], [, b]) => a.pct - b.pct)[0]
}

export async function buildPerformanceInsight({
  adminClient,
  organizationId,
}: {
  adminClient: any
  organizationId: string
}): Promise<PerformanceInsight> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { data: latestDiagnostic },
    { data: activeKpis },
    { count: recentKpiEntries },
    { data: activeMissions },
  ] = await Promise.all([
    adminClient
      .from('diagnostic_sessions')
      .select('id, health_pct, quadrant, area_scores, company_context, created_at, completed_at, respondent_name')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('kpi_definitions')
      .select('id, name, active')
      .eq('organization_id', organizationId)
      .eq('active', true),
    adminClient
      .from('kpi_entries')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('recorded_at', thirtyDaysAgo.toISOString().split('T')[0]),
    adminClient
      .from('ai_missions')
      .select('id, status')
      .eq('organization_id', organizationId)
      .in('status', ['pending', 'in_progress']),
  ])

  const sourceBase = {
    activeKpis: activeKpis?.length ?? 0,
    activeMissions: activeMissions?.length ?? 0,
    recentKpiEntries: recentKpiEntries ?? 0,
  }

  if (!latestDiagnostic) {
    return {
      status: 'needs_diagnostic',
      title: 'Diagnóstico necessário',
      message:
        'Ainda não existe diagnóstico concluído para sustentar uma sugestão real. Faça o diagnóstico comercial para a IA recomendar KPIs, missões e ações com base nos gargalos do seu negócio.',
      confidence: 'baixa',
      source: sourceBase,
    }
  }

  const weakest = getWeakestArea(latestDiagnostic.area_scores as Record<string, AreaScore>)
  const weakestArea = weakest?.[0] ?? 'sales_process'
  const weakestScore = weakest?.[1]?.pct ?? latestDiagnostic.health_pct ?? 0
  const areaLabel = AREA_LABELS[weakestArea]
  const baseRecommendation = KPI_BY_AREA[weakestArea]
  const monthlyGoal = parseMonthlyGoal((latestDiagnostic.company_context as any)?.meta_mensal)
  const estimatedImpact = monthlyGoal
    ? Math.round(monthlyGoal * ((100 - Number(latestDiagnostic.health_pct ?? 0)) / 100) * ((100 - weakestScore) / 100))
    : null

  const alreadyConfigured = (activeKpis ?? []).some((kpi: any) =>
    String(kpi.name).toLowerCase() === baseRecommendation.name.toLowerCase()
  )

  const impactText = estimatedImpact
    ? `Impacto estimado do gargalo: ${formatCurrency(estimatedImpact)}/mês.`
    : 'Sem meta mensal suficiente para estimar impacto financeiro com segurança.'

  const message = alreadyConfigured
    ? `O diagnóstico mais recente aponta ${areaLabel} como maior gargalo (${weakestScore}%). O KPI recomendado já está configurado; acompanhe a evolução semanal e ajuste missões nessa área. ${impactText}`
    : `O diagnóstico mais recente aponta ${areaLabel} como maior gargalo (${weakestScore}%). Recomendo acompanhar "${baseRecommendation.name}" como KPI principal porque ele mede diretamente o ponto de maior perda. ${impactText}`

  return {
    status: 'ready',
    title: 'Sugestão real baseada no diagnóstico',
    message,
    confidence: 'alta',
    source: {
      ...sourceBase,
      diagnosticDate: latestDiagnostic.completed_at ?? latestDiagnostic.created_at,
      diagnosticId: latestDiagnostic.id,
      healthPct: Number(latestDiagnostic.health_pct ?? 0),
      weakestArea: areaLabel,
      weakestAreaPct: weakestScore,
    },
    kpiRecommendation: alreadyConfigured
      ? undefined
      : {
          ...baseRecommendation,
          rationale: `Baseado no último diagnóstico: ${areaLabel} foi a área com menor pontuação (${weakestScore}%).`,
        },
  }
}
