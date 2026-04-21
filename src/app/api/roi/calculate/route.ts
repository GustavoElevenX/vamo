import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/roi/calculate
 *
 * Calcula o ROI real da plataforma com base em dados concretos do banco.
 *
 * Fórmula:
 *   ROI = (ΔReceita_Missões + ΔProdutividade + ΔRetenção) / Investimento
 *
 * ── Pilar 1 · ΔReceita de Missões ─────────────────────────────────────────
 *   Cada missão completada gera um bônus ao vendedor (bonus_missao em R$).
 *   Esse bônus reflete uma entrega real de valor (ação de venda concluída).
 *   receita_missoes = total_missoes_completas × bonus_por_missao × multiplicador
 *
 * ── Pilar 2 · ΔProdutividade (economia de tempo) ──────────────────────────
 *   Dias em que a equipe registrou KPIs representam dias sem retrabalho manual.
 *   produtividade = dias_com_registros_kpi × horas_economizadas × custo_hora
 *
 * ── Pilar 3 · ΔRetenção de Equipe ─────────────────────────────────────────
 *   Usuários engajados (streak > 0) têm menor probabilidade de sair.
 *   Formula: taxa_engajamento × rotacoes_evitadas_estimadas × custo_por_contratacao
 *
 * ── Investimento ──────────────────────────────────────────────────────────
 *   Custo mensal da plataforma × nº de meses no período
 *   (configurável em organizations.settings.roi_config.platform_monthly_cost)
 */

interface RoiConfig {
  platform_monthly_cost?: number   // R$/mês — default 497
  hours_saved_per_day?: number      // horas economizadas/dia com KPIs — default 1.5
  manager_hourly_rate?: number      // R$/hora custo operacional — default 60
  cost_per_hire?: number            // R$ custo médio contratar + treinar vendedor — default 6000
  period_days?: number              // janela de cálculo em dias — default 90
  revenue_multiplier?: number       // multiplicador sobre bônus de missão — default 1.0
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const admin = createAdminClient()

    // ── Resolve org ───────────────────────────────────────────────────────
    const { data: appUser } = await admin
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser?.organization_id) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
    }
    if (!['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const orgId = appUser.organization_id

    // Período: precisamos do PERIOD_DAYS antes do batch — só fica disponível
    // após carregar a config. Usamos o default e re-calculamos se a config mudar.
    // Para não sequencializar, disparamos config + queries que não dependem dela em paralelo,
    // assumindo o default de 90 dias para a janela de filtragem.
    const DEFAULT_PERIOD_DAYS = 90
    const defaultStart = new Date()
    defaultStart.setDate(defaultStart.getDate() - DEFAULT_PERIOD_DAYS)
    const defaultStartStr = defaultStart.toISOString()

    // ── Disparo paralelo: config + queries independentes ──────────────────
    const [
      orgRes,
      commRowRes,
      missionsCountRes,
      sellersRes,
      kpiEntriesRes,
    ] = await Promise.all([
      admin.from('organizations').select('settings, plan').eq('id', orgId).single(),
      admin.from('commission_configs').select('bonus_missao').eq('organization_id', orgId).maybeSingle(),
      admin.from('ai_missions').select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'completed').gte('created_at', defaultStartStr),
      admin.from('users').select('id').eq('organization_id', orgId).eq('role', 'seller').eq('active', true),
      admin.from('kpi_entries').select('recorded_at').eq('organization_id', orgId).gte('recorded_at', defaultStartStr),
    ])

    const org = orgRes.data
    const commRow = commRowRes.data
    const sellers = sellersRes.data

    const settings = (org?.settings ?? {}) as Record<string, unknown>
    const roiCfg = (settings.roi_config ?? {}) as RoiConfig
    const commCfg = (settings.commission_configs ?? null) as { bonus_missao?: number } | null

    const BONUS_POR_MISSAO     = commRow?.bonus_missao ?? commCfg?.bonus_missao ?? 75
    const PLATFORM_MONTHLY     = roiCfg.platform_monthly_cost    ?? 497
    const HOURS_SAVED_PER_DAY  = roiCfg.hours_saved_per_day      ?? 1.5
    const MANAGER_HOURLY_RATE  = roiCfg.manager_hourly_rate      ?? 60
    const COST_PER_HIRE        = roiCfg.cost_per_hire             ?? 6000
    const PERIOD_DAYS          = roiCfg.period_days               ?? DEFAULT_PERIOD_DAYS
    const REVENUE_MULTIPLIER   = roiCfg.revenue_multiplier        ?? 1.0

    // Se PERIOD_DAYS for diferente do default, refazemos as queries que dependem da janela.
    let totalMissionsCompleted = missionsCountRes.count ?? 0
    let kpiEntries = kpiEntriesRes.data ?? []

    if (PERIOD_DAYS !== DEFAULT_PERIOD_DAYS) {
      const periodStart = new Date()
      periodStart.setDate(periodStart.getDate() - PERIOD_DAYS)
      const periodStartStr = periodStart.toISOString()

      const [reMissions, reKpi] = await Promise.all([
        admin.from('ai_missions').select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId).eq('status', 'completed').gte('created_at', periodStartStr),
        admin.from('kpi_entries').select('recorded_at').eq('organization_id', orgId).gte('recorded_at', periodStartStr),
      ])
      totalMissionsCompleted = reMissions.count ?? 0
      kpiEntries = reKpi.data ?? []
    }

    const periodStartForBadges = new Date()
    periodStartForBadges.setDate(periodStartForBadges.getDate() - PERIOD_DAYS)
    const periodStartStr = periodStartForBadges.toISOString()

    const totalSellers = sellers?.length ?? 0
    const sellerIds = sellers?.map(s => s.id) ?? []

    // Queries que dependem de sellerIds — em paralelo
    const [xpDataRes, badgesRes] = await Promise.all([
      sellerIds.length > 0
        ? admin.from('user_xp').select('current_streak, last_activity_date')
            .eq('organization_id', orgId).in('user_id', sellerIds)
        : Promise.resolve({ data: [] as { current_streak: number; last_activity_date: string | null }[] }),
      admin.from('user_badges').select('*', { count: 'exact', head: true })
        .in('user_id', sellerIds.length > 0 ? sellerIds : ['__none__'])
        .gte('earned_at', periodStartStr),
    ])

    const activeUsers = (xpDataRes.data ?? []).filter(x =>
      x.current_streak > 0 ||
      (x.last_activity_date &&
        new Date(x.last_activity_date) >= new Date(Date.now() - 7 * 86400000))
    ).length

    const engagementRate = totalSellers > 0
      ? Math.round((activeUsers / totalSellers) * 100)
      : 0

    // Conta dias distintos com pelo menos 1 registro
    const distinctDays = new Set(
      kpiEntries.map(e => e.recorded_at.slice(0, 10))
    ).size

    const badgesEarned = badgesRes.count

    // ── Cálculos ──────────────────────────────────────────────────────────

    // Pilar 1: receita de missões
    // Cada missão completada = bônus monetário real + receita gerada pela entrega
    const receitaMissoes = Math.round(
      totalMissionsCompleted * BONUS_POR_MISSAO * REVENUE_MULTIPLIER
    )

    // Pilar 2: produtividade (economia de tempo em gestão manual)
    // Dias com KPIs registrados = dias sem retrabalho manual de relatórios
    const produtividade = Math.round(
      distinctDays * HOURS_SAVED_PER_DAY * MANAGER_HOURLY_RATE
    )

    // Pilar 3: retenção de equipe
    // Engajamento alto → menos rotatividade → economia em contratação
    // Estimativa conservadora: cada 10% de engajamento evita 0.1 saída por período
    const rotacoesEvitadas = parseFloat(((engagementRate / 100) * 0.5).toFixed(2))
    const retencaoEquipe   = Math.round(rotacoesEvitadas * COST_PER_HIRE)

    // Investimento no período
    const monthsInPeriod = PERIOD_DAYS / 30
    const investimento   = Math.round(PLATFORM_MONTHLY * monthsInPeriod)

    // ROI total
    const roiTotal      = receitaMissoes + produtividade + retencaoEquipe
    const roiMultiplier = investimento > 0
      ? parseFloat((roiTotal / investimento).toFixed(2))
      : 0
    const roiPercent    = investimento > 0
      ? Math.round(((roiTotal - investimento) / investimento) * 100)
      : 0

    // Período do label para exibição
    const periodLabel = PERIOD_DAYS === 30
      ? 'Últimos 30 dias'
      : PERIOD_DAYS === 60
        ? 'Últimos 60 dias'
        : PERIOD_DAYS === 90
          ? 'Últimos 90 dias'
          : `Últimos ${PERIOD_DAYS} dias`

    return NextResponse.json({
      // Resultados
      receita_missoes:  receitaMissoes,
      produtividade,
      retencao_equipe:  retencaoEquipe,
      investimento,
      roi_total:        roiTotal,
      roi_multiplier:   roiMultiplier,
      roi_percent:      roiPercent,

      // Dados brutos usados
      breakdown: {
        missions_completed:    totalMissionsCompleted,
        bonus_por_missao:      BONUS_POR_MISSAO,
        revenue_multiplier:    REVENUE_MULTIPLIER,
        total_sellers:         totalSellers,
        active_users:          activeUsers,
        engagement_rate:       engagementRate,
        distinct_kpi_days:     distinctDays,
        hours_saved_per_day:   HOURS_SAVED_PER_DAY,
        manager_hourly_rate:   MANAGER_HOURLY_RATE,
        rotacoes_evitadas:     rotacoesEvitadas,
        cost_per_hire:         COST_PER_HIRE,
        badges_earned:         badgesEarned ?? 0,
        period_days:           PERIOD_DAYS,
        platform_monthly_cost: PLATFORM_MONTHLY,
      },

      // Metodologia legível
      methodology: {
        receita_missoes: `${totalMissionsCompleted} missões × R$ ${BONUS_POR_MISSAO} bônus × ${REVENUE_MULTIPLIER}x = R$ ${receitaMissoes.toLocaleString('pt-BR')}`,
        produtividade:   `${distinctDays} dias com KPIs × ${HOURS_SAVED_PER_DAY}h economizadas × R$ ${MANAGER_HOURLY_RATE}/h = R$ ${produtividade.toLocaleString('pt-BR')}`,
        retencao_equipe: `${engagementRate}% engajamento → ${rotacoesEvitadas} rotação evitada × R$ ${COST_PER_HIRE.toLocaleString('pt-BR')} custo = R$ ${retencaoEquipe.toLocaleString('pt-BR')}`,
        investimento:    `R$ ${PLATFORM_MONTHLY}/mês × ${monthsInPeriod.toFixed(1)} meses = R$ ${investimento.toLocaleString('pt-BR')}`,
        roi:             `(R$ ${roiTotal.toLocaleString('pt-BR')} / R$ ${investimento.toLocaleString('pt-BR')}) = ${roiMultiplier}× — +${roiPercent}%`,
      },

      period_label: periodLabel,
      period_days:  PERIOD_DAYS,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[ROI Calculate]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
