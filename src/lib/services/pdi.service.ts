import type { SupabaseClient } from '@supabase/supabase-js'
import { createRecommendation } from './action-recommendation.service'
import {
  createEntityRelationship,
  createEventWithImpacts,
  type JsonObject,
} from './performance-os.service'
import { awardXp } from './xp.service'
import { checkAndAwardBadges } from './badge.service'
import { callOpenAIJSON, isOpenAIConfigured } from './openai.service'
import { callOpenRouterJSON, isOpenRouterConfigured } from './openrouter.service'

type PdiSeverity = 'low' | 'medium' | 'high' | 'critical'
type PdiPlanStatus = 'recommended' | 'pending_approval' | 'approved' | 'active' | 'completed' | 'paused' | 'rejected' | 'cancelled'
type PdiApplicationStatus = 'submitted' | 'approved' | 'validated' | 'needs_revision' | 'needs_adjustment' | 'rejected'
type PdiGapSource =
  | 'kpi'
  | 'crm'
  | 'lost_deal'
  | 'commercial_performance'
  | 'customer_portfolio'
  | 'mission'
  | 'health_checkin'
  | 'simulation'
  | 'manager'

interface UserContext {
  organizationId: string
  actorUserId: string
  targetUserId: string
}

interface DetectGapInput extends UserContext {
  skillArea: string
  title: string
  description?: string | null
  detectedFrom: PdiGapSource | string
  sourceEntityType?: string | null
  sourceEntityId?: string | null
  severity?: PdiSeverity
  confidenceScore?: number
  evidence?: JsonObject
  impactValue?: number | null
}

interface RecommendPlanInput extends UserContext {
  managerId?: string | null
  gapId?: string | null
  title: string
  description?: string | null
  skillArea: string
  targetKpiKey?: string | null
  baselineValue?: number | null
  targetValue?: number | null
  status?: PdiPlanStatus
  recommendedBy?: 'ai' | 'manager' | 'system'
  metadata?: JsonObject
}

interface SubmitApplicationInput extends UserContext {
  planId: string
  dealId?: string | null
  activityId?: string | null
  accountId?: string | null
  applicationType?: 'deal' | 'follow_up' | 'proposal' | 'roleplay' | 'simulation'
  description: string
  evidence?: JsonObject
}

interface ValidateApplicationInput {
  organizationId: string
  managerId: string
  applicationId: string
  status: PdiApplicationStatus
  reviewNotes?: string | null
  currentValue?: number | null
  kpiEntryValue?: number | null
}

interface DetectPdiGapsInput {
  organizationId: string
  actorUserId: string
  sellerId?: string | null
  period?: { start?: string | null; end?: string | null } | null
  sources?: PdiGapSource[] | null
}

interface GeneratedTrainingPayload {
  title: string
  problem_summary: string
  sales_impact: string
  quick_concept: string
  practical_example: string
  script: string
  checklist: string[]
  exercise: string
  roleplay_prompt?: string | null
  real_case_application: string
  required_evidence: string
  validation_criteria: string
  recommended_deadline_days: number
  recommended_xp: number
}

function severityFromRatio(ratio: number): PdiSeverity {
  if (ratio < 0.35) return 'critical'
  if (ratio < 0.55) return 'high'
  if (ratio < 0.75) return 'medium'
  return 'low'
}

function severityFromCount(count: number): PdiSeverity {
  if (count >= 8) return 'critical'
  if (count >= 5) return 'high'
  if (count >= 3) return 'medium'
  return 'low'
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function tomorrowPlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeSkillSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function sourceEntityId(value: unknown) {
  return typeof value === 'string' && isUuid(value) ? value : null
}

function openPlanStatuses() {
  return ['recommended', 'pending_approval', 'approved', 'active']
}

function activeGapStatuses() {
  return ['open', 'in_pdi', 'improving', 'in_training']
}

function periodRange(input?: DetectPdiGapsInput['period']) {
  const end = input?.end ? new Date(input.end) : new Date()
  const start = input?.start ? new Date(input.start) : new Date(end)
  if (!input?.start) start.setDate(start.getDate() - 30)
  return { startIso: start.toISOString(), endIso: end.toISOString(), startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

function isOpenDeal(deal: { stage?: string | null }) {
  return !['closed_won', 'closed_lost'].includes(String(deal.stage ?? ''))
}

function isOverdue(value: string | null | undefined) {
  if (!value) return false
  return new Date(value).getTime() < Date.now()
}

function daysSince(value: string | null | undefined) {
  if (!value) return 999
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 999
  return Math.floor((Date.now() - time) / 86400000)
}

async function notifyUser(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    userId: string
    senderId?: string | null
    title: string
    message: string
    type?: string
    source?: string
    actionHref?: string | null
    context?: JsonObject
  },
) {
  await supabase.from('notifications').insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    sender_id: params.senderId ?? null,
    title: params.title,
    message: params.message,
    type: params.type ?? 'pdi',
    source: params.source ?? 'pdi',
    action_href: params.actionHref ?? null,
    context: params.context ?? {},
  })
}

function defaultPlanItems(skillArea: string) {
  return [
    {
      title: `Conceito rapido: ${skillArea}`,
      description: 'Entender o comportamento esperado, por que ele afeta venda e como aplicar no contexto comercial.',
      item_type: 'lesson',
      due_at: tomorrowPlus(2),
      metadata: { sequence: 1, required: true },
    },
    {
      title: 'Roleplay no simulador',
      description: 'Praticar a habilidade em uma conversa simulada antes de aplicar em cliente real.',
      item_type: 'roleplay',
      due_at: tomorrowPlus(4),
      metadata: { sequence: 2, href: '/simulador', required: true },
    },
    {
      title: 'Aplicacao em oportunidade real',
      description: 'Usar a tecnica em deal, proposta ou follow-up e registrar evidencia.',
      item_type: 'real_case_application',
      due_at: tomorrowPlus(7),
      metadata: { sequence: 3, required: true },
    },
    {
      title: 'Validacao do gestor',
      description: 'Gestor revisa evidencia e confirma se houve mudanca de comportamento.',
      item_type: 'manager_review',
      due_at: tomorrowPlus(9),
      metadata: { sequence: 4, required: true },
    },
  ]
}

async function getOrCreateTrainingModule(
  supabase: SupabaseClient,
  organizationId: string,
  skillArea: string,
  generated?: GeneratedTrainingPayload | null,
  gapId?: string | null,
) {
  if (generated) {
    const { data, error } = await supabase
      .from('training_modules')
      .insert({
        organization_id: organizationId,
        gap_id: gapId ?? null,
        title: generated.title,
        description: generated.problem_summary,
        skill_area: skillArea,
        module_type: 'micro_training',
        estimated_minutes: 15,
        content: {
          problemSummary: generated.problem_summary,
          salesImpact: generated.sales_impact,
          quickConcept: generated.quick_concept,
          practicalExample: generated.practical_example,
          script: generated.script,
          checklist: generated.checklist,
          exercise: generated.exercise,
          roleplayPrompt: generated.roleplay_prompt ?? null,
          realCaseApplication: generated.real_case_application,
          requiredEvidence: generated.required_evidence,
          validationCriteria: generated.validation_criteria,
          recommendedDeadlineDays: generated.recommended_deadline_days,
          recommendedXp: generated.recommended_xp,
        },
      })
      .select('*')
      .single()

    if (error) throw error
    return data
  }

  const { data: existing } = await supabase
    .from('training_modules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('skill_area', skillArea)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('training_modules')
    .insert({
      organization_id: organizationId,
      title: `Treino aplicado: ${skillArea}`,
      description: 'Modulo estruturado criado automaticamente para transformar gap em pratica, aplicacao real e evidencia.',
      skill_area: skillArea,
      module_type: 'micro_training',
      estimated_minutes: 12,
      content: {
        steps: [
          'Entenda o comportamento esperado.',
          'Pratique em simulacao curta.',
          'Aplique em uma oportunidade real.',
          'Registre evidencia e resultado.',
        ],
      },
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function detectGapFromKpi(
  supabase: SupabaseClient,
  input: UserContext & {
    kpiId: string
    kpiName: string
    currentValue: number
    targetValue: number
    skillArea?: string
  },
) {
  const ratio = input.targetValue > 0 ? input.currentValue / input.targetValue : 1
  if (ratio >= 0.8) return null

  return detectGap(supabase, {
    ...input,
    skillArea: input.skillArea ?? input.kpiName,
    title: `Gap em ${input.kpiName}`,
    description: `KPI esta em ${Math.round(ratio * 100)}% da meta. O PDI deve focar pratica aplicada para reduzir esta lacuna.`,
    detectedFrom: 'kpi',
    sourceEntityType: 'kpi_definition',
    sourceEntityId: input.kpiId,
    severity: severityFromRatio(ratio),
    confidenceScore: Math.min(0.95, 1 - ratio + 0.35),
    evidence: {
      kpiId: input.kpiId,
      kpiName: input.kpiName,
      currentValue: input.currentValue,
      targetValue: input.targetValue,
      ratio,
    },
  })
}

export async function detectGapFromCrm(
  supabase: SupabaseClient,
  input: UserContext & {
    dealId?: string | null
    activityId?: string | null
    reason: string
    skillArea?: string
    evidence?: JsonObject
  },
) {
  const sourceEntityType = input.activityId ? 'crm_activity' : input.dealId ? 'crm_deal' : 'crm'
  const sourceEntityId = input.activityId ?? input.dealId ?? null

  return detectGap(supabase, {
    ...input,
    skillArea: input.skillArea ?? 'execucao_comercial',
    title: `Gap comercial: ${input.reason}`,
    description: 'Sinal vindo do CRM pede treino pratico conectado ao comportamento observado.',
    detectedFrom: 'crm',
    sourceEntityType,
    sourceEntityId,
    severity: 'medium',
    confidenceScore: 0.72,
    evidence: input.evidence ?? {},
  })
}

export async function detectGap(supabase: SupabaseClient, input: DetectGapInput) {
  const skillArea = normalizeSkillSlug(input.skillArea)
  let existingQuery = supabase
    .from('pdi_gaps')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('user_id', input.targetUserId)
    .eq('skill_area', skillArea)
    .eq('detected_from', input.detectedFrom)
    .in('status', activeGapStatuses())

  if (input.sourceEntityId) existingQuery = existingQuery.eq('source_entity_id', input.sourceEntityId)
  const { data: existing } = await existingQuery
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const mergedEvidence = {
      ...((existing.evidence && typeof existing.evidence === 'object') ? existing.evidence : {}),
      latest: input.evidence ?? {},
      updatedByDetectionAt: new Date().toISOString(),
    }
    const { data: updated } = await supabase
      .from('pdi_gaps')
      .update({
        title: input.title,
        description: input.description ?? existing.description,
        severity: input.severity ?? existing.severity,
        confidence_score: Math.max(num(existing.confidence_score), input.confidenceScore ?? 0.7),
        evidence: mergedEvidence,
        impact_value: input.impactValue ?? existing.impact_value ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    return updated ?? existing
  }

  const { data: gap, error } = await supabase
    .from('pdi_gaps')
    .insert({
      organization_id: input.organizationId,
      user_id: input.targetUserId,
      gap_type: input.detectedFrom === 'kpi' ? 'performance_gap' : 'behavior_gap',
      skill_area: skillArea,
      title: input.title,
      description: input.description ?? null,
      detected_from: input.detectedFrom,
      source_entity_type: input.sourceEntityType ?? null,
      source_entity_id: sourceEntityId(input.sourceEntityId),
      severity: input.severity ?? 'medium',
      confidence_score: input.confidenceScore ?? 0.7,
      evidence: input.evidence ?? {},
      impact_value: input.impactValue ?? null,
      created_by: input.actorUserId,
    })
    .select('*')
    .single()

  if (error) throw error

  const { event } = await createEventWithImpacts(
    supabase,
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      eventType: 'pdi.gap_detected',
      sourceModule: 'pdi',
      entityType: 'pdi_gap',
      entityId: gap.id,
      title: `Gap detectado: ${input.title}`,
      description: input.description ?? null,
      impactScore: 45,
      priorityScore: input.severity === 'critical' ? 95 : input.severity === 'high' ? 80 : 60,
      riskScore: input.severity === 'critical' ? 90 : input.severity === 'high' ? 70 : 45,
      metadata: { skillArea, detectedFrom: input.detectedFrom },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_gap', impactedEntityId: gap.id, impactType: 'gap_detected' },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: input.targetUserId, impactType: 'seller_priority' },
      { impactedModule: 'hoje_gestor', impactedEntityType: 'user', impactedEntityId: input.targetUserId, impactType: 'manager_decision' },
      { impactedModule: 'ai', impactedEntityType: 'pdi_gap', impactedEntityId: gap.id, impactType: 'pdi_recommendation_needed' },
    ],
  )

  await createRecommendation(supabase, {
    organizationId: input.organizationId,
    eventId: event.id,
    targetUserId: input.targetUserId,
    createdByUserId: input.actorUserId,
    sourceModule: 'pdi',
    recommendationType: 'pdi_plan',
    title: `Recomendar PDI: ${input.skillArea}`,
    description: 'Converter o gap em microtreino, roleplay, aplicacao real e validacao.',
    suggestedActionLabel: 'Gerar treinamento com IA',
    suggestedActionHref: '/monitoramento/desenvolvimento',
    priority: input.severity === 'critical' || input.severity === 'high' ? 'high' : 'medium',
    metadata: { gapId: gap.id, skillArea },
  })

  return gap
}

export async function detectPdiGaps(supabase: SupabaseClient, input: DetectPdiGapsInput) {
  const period = periodRange(input.period)
  const enabledSources = new Set<PdiGapSource>(input.sources?.length ? input.sources : [
    'kpi',
    'crm',
    'lost_deal',
    'commercial_performance',
    'customer_portfolio',
    'mission',
    'health_checkin',
    'simulation',
    'manager',
  ])

  let sellersQuery = supabase
    .from('users')
    .select('id,name')
    .eq('organization_id', input.organizationId)
    .eq('role', 'seller')
    .eq('active', true)

  if (input.sellerId) sellersQuery = sellersQuery.eq('id', input.sellerId)
  const { data: sellers, error: sellersError } = await sellersQuery
  if (sellersError) throw sellersError

  const sellerRows = (sellers ?? []) as Array<{ id: string; name: string }>
  const sellerIds = sellerRows.map((seller) => seller.id)
  const beforeCountRes = await supabase
    .from('pdi_gaps')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', input.organizationId)

  if (!sellerIds.length) return { created: 0, updated: 0, gaps: [] }

  const [
    kpisRes,
    entriesRes,
    dealsRes,
    activitiesRes,
    missionsRes,
    checkinsRes,
    simulationsRes,
  ] = await Promise.all([
    enabledSources.has('kpi')
      ? supabase
        .from('kpi_definitions')
        .select('id,name,slug,target_daily,target_weekly,target_monthly,targets,active')
        .eq('organization_id', input.organizationId)
        .eq('active', true)
      : Promise.resolve({ data: [], error: null }),
    enabledSources.has('kpi')
      ? supabase
        .from('kpi_entries')
        .select('user_id,kpi_id,value,source_event,recorded_at')
        .eq('organization_id', input.organizationId)
        .in('user_id', sellerIds)
        .gte('recorded_at', period.startDate)
        .lte('recorded_at', period.endDate)
      : Promise.resolve({ data: [], error: null }),
    enabledSources.has('crm') || enabledSources.has('lost_deal') || enabledSources.has('customer_portfolio') || enabledSources.has('commercial_performance')
      ? supabase
        .from('crm_deals')
        .select('id,owner_id,account_id,title,value,stage,lost_reason,last_activity_at,next_action_title,next_action_due_at,next_action_status,received_amount,updated_at,created_at')
        .eq('organization_id', input.organizationId)
        .in('owner_id', sellerIds)
      : Promise.resolve({ data: [], error: null }),
    enabledSources.has('commercial_performance')
      ? supabase
        .from('crm_activities')
        .select('id,deal_id,user_id,type,occurred_at')
        .in('user_id', sellerIds)
        .gte('occurred_at', period.startIso)
        .lte('occurred_at', period.endIso)
      : Promise.resolve({ data: [], error: null }),
    enabledSources.has('mission')
      ? supabase
        .from('ai_missions')
        .select('id,user_id,title,status,deadline,type,current_value,target_value,created_at')
        .eq('organization_id', input.organizationId)
        .in('user_id', sellerIds)
      : Promise.resolve({ data: [], error: null }),
    enabledSources.has('health_checkin')
      ? supabase
        .from('daily_checkins')
        .select('id,user_id,energy_level,obstacle,checkin_date')
        .eq('organization_id', input.organizationId)
        .in('user_id', sellerIds)
        .gte('checkin_date', period.startDate)
        .lte('checkin_date', period.endDate)
      : Promise.resolve({ data: [], error: null }),
    enabledSources.has('simulation')
      ? supabase
        .from('simulation_sessions')
        .select('id,user_id,feedback,completed,created_at')
        .eq('organization_id', input.organizationId)
        .in('user_id', sellerIds)
        .eq('completed', true)
        .gte('created_at', period.startIso)
        .lte('created_at', period.endIso)
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [kpisRes, entriesRes, dealsRes, activitiesRes, missionsRes, checkinsRes, simulationsRes]) {
    if ('error' in result && result.error) throw result.error
  }

  const kpis = (kpisRes.data ?? []) as any[]
  const entries = (entriesRes.data ?? []) as any[]
  const deals = (dealsRes.data ?? []) as any[]
  const activities = (activitiesRes.data ?? []) as any[]
  const missions = (missionsRes.data ?? []) as any[]
  const checkins = (checkinsRes.data ?? []) as any[]
  const simulations = (simulationsRes.data ?? []) as any[]
  const gaps: any[] = []

  async function registerGap(params: Omit<DetectGapInput, keyof UserContext>) {
    const gap = await detectGap(supabase, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      targetUserId: params.evidence?.sellerId as string,
      ...params,
      evidence: {
        ...(params.evidence ?? {}),
        period: { start: period.startDate, end: period.endDate },
        detectedBy: 'detectPdiGaps',
      },
    })
    gaps.push(gap)
  }

  for (const seller of sellerRows) {
    const sellerDeals = deals.filter((deal) => deal.owner_id === seller.id)
    const sellerOpenDeals = sellerDeals.filter(isOpenDeal)
    const sellerActivities = activities.filter((activity) => activity.user_id === seller.id)
    const sellerMissions = missions.filter((mission) => mission.user_id === seller.id)
    const sellerCheckins = checkins.filter((checkin) => checkin.user_id === seller.id)
    const sellerSimulations = simulations.filter((session) => session.user_id === seller.id)

    if (enabledSources.has('kpi')) {
      for (const kpi of kpis) {
        const target = num(kpi.target_monthly ?? kpi.targets?.monthly ?? kpi.targets?.month)
        if (!target) continue
        const current = entries
          .filter((entry) => entry.user_id === seller.id && entry.kpi_id === kpi.id)
          .reduce((sum, entry) => sum + num(entry.value), 0)
        const ratio = current / target
        if (ratio < 0.8) {
          const skill = normalizeSkillSlug(String(kpi.slug || kpi.name || 'disciplina_comercial'))
          await registerGap({
            skillArea: skill.includes('follow') ? 'follow_up' : skill,
            title: `Gap em ${kpi.name}`,
            description: `${seller.name} esta em ${Math.round(ratio * 100)}% da meta de ${kpi.name}.`,
            detectedFrom: 'kpi',
            sourceEntityType: 'kpi_entry',
            sourceEntityId: null,
            severity: severityFromRatio(ratio),
            confidenceScore: clamp(0.45 + (1 - ratio), 0.55, 0.95),
            impactValue: Math.max(0, target - current),
            evidence: { sellerId: seller.id, kpiId: kpi.id, kpiName: kpi.name, currentValue: current, targetValue: target, ratio },
          })
        }
      }
    }

    if (enabledSources.has('crm')) {
      const withoutNextAction = sellerOpenDeals.filter((deal) => !deal.next_action_title || deal.next_action_status !== 'open')
      const overdue = sellerOpenDeals.filter((deal) => isOverdue(deal.next_action_due_at))
      const stalled = sellerOpenDeals.filter((deal) => daysSince(deal.last_activity_at || deal.updated_at) >= 7)
      const impact = [...withoutNextAction, ...overdue, ...stalled].reduce((sum, deal) => sum + num(deal.value), 0)
      if (withoutNextAction.length + overdue.length + stalled.length >= 2) {
        await registerGap({
          skillArea: overdue.length ? 'cadencia_comercial' : 'organizacao_de_pipeline',
          title: `${seller.name} tem pipeline sem proximo passo claro`,
          description: `${withoutNextAction.length} deals sem proxima acao, ${overdue.length} follow-ups atrasados e ${stalled.length} oportunidades paradas.`,
          detectedFrom: 'crm',
          sourceEntityType: 'crm_deal',
          sourceEntityId: withoutNextAction[0]?.id ?? overdue[0]?.id ?? stalled[0]?.id ?? null,
          severity: severityFromCount(withoutNextAction.length + overdue.length + stalled.length),
          confidenceScore: 0.84,
          impactValue: impact,
          evidence: { sellerId: seller.id, withoutNextAction: withoutNextAction.length, overdueFollowups: overdue.length, stalledDeals: stalled.length, impact },
        })
      }
    }

    if (enabledSources.has('lost_deal')) {
      const lostDeals = sellerDeals.filter((deal) => deal.stage === 'closed_lost' && deal.lost_reason)
      const byReason = new Map<string, any[]>()
      for (const deal of lostDeals) {
        const reason = normalizeSkillSlug(String(deal.lost_reason))
        byReason.set(reason, [...(byReason.get(reason) ?? []), deal])
      }
      for (const [reason, rows] of byReason.entries()) {
        if (rows.length < 2) continue
        const skill = reason.includes('valor') ? 'construcao_de_valor' : reason.includes('preco') ? 'objecoes' : reason.includes('concorrente') ? 'negociacao' : 'fechamento'
        const impact = rows.reduce((sum, deal) => sum + num(deal.value), 0)
        await registerGap({
          skillArea: skill,
          title: `${seller.name} perdeu oportunidades por ${reason.replace(/_/g, ' ')}`,
          description: `${rows.length} deals perdidos pelo mesmo motivo indicam um gap comercial recorrente.`,
          detectedFrom: 'lost_deal',
          sourceEntityType: 'crm_deal',
          sourceEntityId: rows[0]?.id ?? null,
          severity: severityFromCount(rows.length),
          confidenceScore: 0.88,
          impactValue: impact,
          evidence: { sellerId: seller.id, reason, lostDeals: rows.length, impact, deals: rows.map((deal) => ({ id: deal.id, title: deal.title, value: deal.value })) },
        })
      }
    }

    if (enabledSources.has('commercial_performance')) {
      const won = sellerDeals.filter((deal) => deal.stage === 'closed_won')
      const lost = sellerDeals.filter((deal) => deal.stage === 'closed_lost')
      const finalized = won.length + lost.length
      const conversion = finalized ? won.length / finalized : 0
      const proposals = sellerActivities.filter((activity) => activity.type === 'proposal_sent').length
      if (sellerActivities.length >= 8 && conversion < 0.15) {
        await registerGap({
          skillArea: proposals > 0 ? 'fechamento' : 'qualificacao',
          title: `${seller.name} executa, mas converte pouco`,
          description: `${sellerActivities.length} acoes no periodo com ${Math.round(conversion * 100)}% de conversao em vendas.`,
          detectedFrom: 'commercial_performance',
          sourceEntityType: 'manual_note',
          sourceEntityId: null,
          severity: conversion === 0 ? 'high' : 'medium',
          confidenceScore: 0.78,
          impactValue: sellerOpenDeals.reduce((sum, deal) => sum + num(deal.value), 0),
          evidence: { sellerId: seller.id, activities: sellerActivities.length, proposals, won: won.length, lost: lost.length, conversion },
        })
      }
    }

    if (enabledSources.has('customer_portfolio')) {
      const wonWithoutRecentAction = sellerDeals.filter((deal) => deal.stage === 'closed_won' && daysSince(deal.last_activity_at || deal.updated_at) >= 14)
      const pendingReceipt = sellerDeals.filter((deal) => deal.stage === 'closed_won' && num(deal.received_amount) < num(deal.value))
      const expansionStalled = sellerOpenDeals.filter((deal) => deal.account_id && ['proposal', 'negotiation'].includes(String(deal.stage)) && daysSince(deal.last_activity_at || deal.updated_at) >= 10)
      const importantWithoutContact = sellerDeals.filter((deal) => deal.account_id && num(deal.value) >= 10000 && daysSince(deal.last_activity_at || deal.updated_at) >= 30)
      if (wonWithoutRecentAction.length >= 2) {
        await registerGap({
          skillArea: 'pos_venda',
          title: `${seller.name} tem clientes ganhos sem pos-venda recente`,
          description: `${wonWithoutRecentAction.length} clientes ganhos estao sem acao recente de acompanhamento.`,
          detectedFrom: 'customer_portfolio',
          sourceEntityType: 'crm_account',
          sourceEntityId: wonWithoutRecentAction[0]?.account_id ?? null,
          severity: severityFromCount(wonWithoutRecentAction.length),
          confidenceScore: 0.76,
          impactValue: wonWithoutRecentAction.reduce((sum, deal) => sum + num(deal.value), 0),
          evidence: { sellerId: seller.id, customersWithoutPostSale: wonWithoutRecentAction.length },
        })
      }
      if (pendingReceipt.length >= 2) {
        await registerGap({
          skillArea: 'organizacao_de_carteira',
          title: `${seller.name} tem clientes com recebimento pendente sem acao clara`,
          description: `${pendingReceipt.length} clientes ganhos possuem valor recebido menor que o valor vendido.`,
          detectedFrom: 'customer_portfolio',
          sourceEntityType: 'crm_account',
          sourceEntityId: pendingReceipt[0]?.account_id ?? null,
          severity: severityFromCount(pendingReceipt.length),
          confidenceScore: 0.78,
          impactValue: pendingReceipt.reduce((sum, deal) => sum + Math.max(0, num(deal.value) - num(deal.received_amount)), 0),
          evidence: { sellerId: seller.id, pendingReceipts: pendingReceipt.length },
        })
      }
      if (expansionStalled.length >= 2) {
        await registerGap({
          skillArea: 'expansao',
          title: `${seller.name} tem expansoes paradas na carteira`,
          description: `${expansionStalled.length} oportunidades de expansao estao paradas em proposta ou negociacao.`,
          detectedFrom: 'customer_portfolio',
          sourceEntityType: 'crm_account',
          sourceEntityId: expansionStalled[0]?.account_id ?? null,
          severity: severityFromCount(expansionStalled.length),
          confidenceScore: 0.77,
          impactValue: expansionStalled.reduce((sum, deal) => sum + num(deal.value), 0),
          evidence: { sellerId: seller.id, expansionStalled: expansionStalled.length },
        })
      }
      if (importantWithoutContact.length >= 2) {
        await registerGap({
          skillArea: 'relacionamento',
          title: `${seller.name} tem clientes importantes sem contato recente`,
          description: `${importantWithoutContact.length} contas relevantes estao sem contato recente.`,
          detectedFrom: 'customer_portfolio',
          sourceEntityType: 'crm_account',
          sourceEntityId: importantWithoutContact[0]?.account_id ?? null,
          severity: severityFromCount(importantWithoutContact.length),
          confidenceScore: 0.73,
          impactValue: importantWithoutContact.reduce((sum, deal) => sum + num(deal.value), 0),
          evidence: { sellerId: seller.id, importantWithoutContact: importantWithoutContact.length },
        })
      }
    }

    if (enabledSources.has('mission')) {
      const overdueMissions = sellerMissions.filter((mission) => ['pending', 'in_progress'].includes(mission.status) && isOverdue(mission.deadline))
      if (overdueMissions.length >= 2) {
        await registerGap({
          skillArea: 'disciplina_comercial',
          title: `${seller.name} acumula missoes comerciais atrasadas`,
          description: `${overdueMissions.length} missoes atrasadas sugerem gap de rotina, priorizacao ou aplicacao pratica.`,
          detectedFrom: 'mission',
          sourceEntityType: 'ai_mission',
          sourceEntityId: overdueMissions[0]?.id ?? null,
          severity: severityFromCount(overdueMissions.length),
          confidenceScore: 0.8,
          evidence: { sellerId: seller.id, overdueMissions: overdueMissions.length, missions: overdueMissions.map((mission) => mission.title) },
        })
      }
    }

    if (enabledSources.has('health_checkin')) {
      const lowEnergy = sellerCheckins.filter((checkin) => num(checkin.energy_level, 5) <= 2)
      const executionRisk = sellerActivities.length < 3 || sellerOpenDeals.some((deal) => !deal.next_action_title || isOverdue(deal.next_action_due_at))
      if (lowEnergy.length >= 2 && executionRisk) {
        await registerGap({
          skillArea: 'saude_operacional',
          title: `${seller.name} precisa de apoio de ritmo comercial`,
          description: 'Energia baixa apareceu junto com risco de execucao, entao a recomendacao e pauta de 1:1, ajuste de carga ou missao simples.',
          detectedFrom: 'health_checkin',
          sourceEntityType: 'daily_checkin',
          sourceEntityId: lowEnergy[0]?.id ?? null,
          severity: lowEnergy.length >= 4 ? 'high' : 'medium',
          confidenceScore: 0.68,
          evidence: { sellerId: seller.id, lowEnergyCheckins: lowEnergy.length, activities: sellerActivities.length, executionRisk },
        })
      }
    }

    if (enabledSources.has('simulation')) {
      for (const session of sellerSimulations) {
        const feedback = session.feedback ?? {}
        const score = num(feedback.score ?? feedback.nota ?? feedback.totalScore ?? feedback.overall_score, 100)
        if (score >= 70) continue
        const weakArea = normalizeSkillSlug(String(feedback.weak_area ?? feedback.gap ?? feedback.area ?? 'comunicacao'))
        await registerGap({
          skillArea: weakArea.includes('preco') ? 'objecoes' : weakArea || 'comunicacao',
          title: `${seller.name} teve dificuldade no simulador`,
          description: `Simulacao concluida com nota ${score}, pedindo treino aplicado antes do proximo caso real.`,
          detectedFrom: 'simulation',
          sourceEntityType: 'simulation_result',
          sourceEntityId: session.id,
          severity: score < 45 ? 'high' : 'medium',
          confidenceScore: 0.74,
          evidence: { sellerId: seller.id, simulationId: session.id, score, feedback },
        })
      }
    }
  }

  const afterCountRes = await supabase
    .from('pdi_gaps')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', input.organizationId)

  const before = beforeCountRes.count ?? 0
  const after = afterCountRes.count ?? before
  const uniqueGapIds = new Set(gaps.map((gap) => gap.id))
  return {
    created: Math.max(0, after - before),
    updated: Math.max(0, uniqueGapIds.size - Math.max(0, after - before)),
    gaps,
  }
}

function fallbackTraining(gap: any, managerNotes?: string | null): GeneratedTrainingPayload {
  const skill = String(gap.skill_area ?? 'habilidade_comercial').replace(/_/g, ' ')
  return {
    title: `Treino aplicado de ${skill}`,
    problem_summary: gap.description ?? `Gap comercial em ${skill} detectado a partir de evidencias reais.`,
    sales_impact: `Esse comportamento reduz conversao, velocidade de pipeline ou retencao. Impacto estimado: ${num(gap.impact_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    quick_concept: `Antes de agir, conecte dor, proximo passo e criterio de sucesso. O vendedor precisa transformar ${skill} em comportamento observavel no CRM ou cliente.`,
    practical_example: 'Em um deal parado, retome o contato com uma pergunta de impacto, confirme prioridade e combine uma proxima acao com data.',
    script: '1. Contextualize o ultimo contato. 2. Reforce dor e impacto. 3. Mostre o custo da inacao. 4. Combine o proximo passo com data. 5. Registre a evidencia no CRM.',
    checklist: [
      'Escolheu um deal ou cliente real.',
      'Usou uma pergunta de diagnostico ou valor.',
      'Definiu proximo passo claro.',
      'Registrou evidencia e resultado.',
      'Trouxe aprendizado para validacao do gestor.',
    ],
    exercise: managerNotes?.trim() || `Reescreva uma abordagem real usando a habilidade ${skill} e aplique em uma oportunidade aberta.`,
    roleplay_prompt: `Simule uma conversa em que o cliente resiste ao proximo passo e o vendedor precisa praticar ${skill}.`,
    real_case_application: 'Aplicar a tecnica em 1 oportunidade ou cliente real e registrar resumo, proximo passo, outcome e evidencia.',
    required_evidence: 'Resumo da conversa, deal/cliente selecionado, resultado obtido e print/link quando existir.',
    validation_criteria: 'Gestor valida se houve uso claro da tecnica, proximo passo definido e evidencia conectada ao problema original.',
    recommended_deadline_days: 7,
    recommended_xp: 120,
  }
}

async function generateTrainingPayload(gap: any, seller: any, managerNotes?: string | null) {
  const fallback = fallbackTraining(gap, managerNotes)
  if (!isOpenAIConfigured() && !isOpenRouterConfigured()) return fallback

  const systemPrompt = 'Voce e a VAMO IA. Gere microtreinamentos comerciais aplicados, especificos, sem curso generico, em JSON valido.'
  const userPrompt = JSON.stringify({
    regra: 'O PDI deve nascer de dados comerciais e terminar em aplicacao real validada pelo gestor.',
    vendedor: { id: seller?.id, nome: seller?.name },
    gap: {
      id: gap.id,
      habilidade: gap.skill_area,
      origem: gap.detected_from,
      titulo: gap.title,
      descricao: gap.description,
      evidencia: gap.evidence,
      impacto: gap.impact_value,
      gravidade: gap.severity,
      confianca: gap.confidence_score,
    },
    observacoes_do_gestor: managerNotes ?? null,
    formato_obrigatorio: Object.keys(fallback),
  })

  try {
    const result = isOpenAIConfigured()
      ? await callOpenAIJSON<GeneratedTrainingPayload>({ systemPrompt, userPrompt, temperature: 0.35, maxTokens: 1800 })
      : await callOpenRouterJSON<GeneratedTrainingPayload>({ systemPrompt, userPrompt, temperature: 0.35, maxTokens: 1800 })
    return { ...fallback, ...result.data, checklist: Array.isArray(result.data.checklist) ? result.data.checklist : fallback.checklist }
  } catch {
    return fallback
  }
}

export async function generatePdiTraining(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    managerId: string
    gapId: string
    sellerId?: string | null
    managerNotes?: string | null
    createMission?: boolean
  },
) {
  const { data: gap, error: gapError } = await supabase
    .from('pdi_gaps')
    .select('*, user:users(id,name)')
    .eq('organization_id', params.organizationId)
    .eq('id', params.gapId)
    .maybeSingle()

  if (gapError) throw gapError
  if (!gap) throw new Error('Gap nao encontrado')

  const seller = Array.isArray(gap.user) ? gap.user[0] : gap.user
  const sellerId = params.sellerId ?? gap.user_id
  const trainingPayload = await generateTrainingPayload(gap, seller, params.managerNotes)
  const result = await recommendPdiPlan(supabase, {
    organizationId: params.organizationId,
    actorUserId: params.managerId,
    targetUserId: sellerId,
    managerId: params.managerId,
    gapId: gap.id,
    title: trainingPayload.title,
    description: `${trainingPayload.problem_summary}\n\n${trainingPayload.sales_impact}`,
    skillArea: gap.skill_area,
    targetKpiKey: gap.evidence?.kpiId ? String(gap.evidence.kpiId) : null,
    baselineValue: typeof gap.evidence?.currentValue === 'number' ? gap.evidence.currentValue : null,
    targetValue: typeof gap.evidence?.targetValue === 'number' ? gap.evidence.targetValue : null,
    status: 'pending_approval',
    recommendedBy: 'ai',
    metadata: {
      generatedBy: 'vamo_ai',
      managerNotes: params.managerNotes ?? null,
      trainingPayload,
      impactValue: gap.impact_value ?? null,
      source: gap.detected_from,
    },
  })

  let mission = null
  if (params.createMission) {
    const { data } = await supabase
      .from('ai_missions')
      .insert({
        organization_id: params.organizationId,
        user_id: sellerId,
        created_by: params.managerId,
        pdi_plan_id: result.plan.id,
        gap_id: gap.id,
        title: `Aplicar PDI: ${trainingPayload.title}`,
        description: trainingPayload.real_case_application,
        area: 'sales_process',
        type: 'pdi',
        difficulty: gap.severity === 'critical' ? 3 : gap.severity === 'high' ? 2 : 1,
        xp_reward: trainingPayload.recommended_xp,
        criteria: {
          pdi_plan_id: result.plan.id,
          gap_id: gap.id,
          requiredEvidence: trainingPayload.required_evidence,
          validationCriteria: trainingPayload.validation_criteria,
        },
        resources: [{ type: 'pdi', href: '/desenvolvimento/pdi', label: 'Meu PDI' }],
        status: 'awaiting_approval',
        deadline: tomorrowPlus(trainingPayload.recommended_deadline_days),
        verification_type: 'manual',
      })
      .select('*')
      .single()
    mission = data
  }

  await notifyUser(supabase, {
    organizationId: params.organizationId,
    userId: params.managerId,
    senderId: params.managerId,
    title: `PDI aguardando aprovacao: ${trainingPayload.title}`,
    message: 'A VAMO IA gerou um treinamento aplicado. Revise, ajuste e aprove antes de liberar ao vendedor.',
    actionHref: '/monitoramento/desenvolvimento',
    context: { planId: result.plan.id, gapId: gap.id, missionId: mission?.id ?? null },
  })

  return { ...result, training: trainingPayload, mission }
}

export async function recommendPdiPlan(supabase: SupabaseClient, input: RecommendPlanInput) {
  const generatedTraining = input.metadata?.trainingPayload as GeneratedTrainingPayload | undefined
  const trainingModule = await getOrCreateTrainingModule(supabase, input.organizationId, normalizeSkillSlug(input.skillArea), generatedTraining, input.gapId)
  const dueDays = generatedTraining?.recommended_deadline_days ?? 14
  const { data: plan, error } = await supabase
    .from('pdi_plans')
    .insert({
      organization_id: input.organizationId,
      user_id: input.targetUserId,
      manager_id: input.managerId ?? null,
      gap_id: input.gapId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'pending_approval',
      recommended_by: input.recommendedBy ?? 'ai',
      start_date: new Date().toISOString().slice(0, 10),
      due_date: tomorrowPlus(dueDays).slice(0, 10),
      target_kpi_key: input.targetKpiKey ?? null,
      baseline_value: input.baselineValue ?? null,
      target_value: input.targetValue ?? null,
      current_value: input.baselineValue ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        skillArea: normalizeSkillSlug(input.skillArea),
        trainingModuleId: trainingModule.id,
        trainingPayload: generatedTraining ?? null,
        flow: ['gap', 'plan', 'training', 'application', 'validation', 'evolution'],
      },
    })
    .select('*')
    .single()

  if (error) throw error

  const generatedItems = generatedTraining
    ? [
      {
        title: 'Estudar conceito e impacto comercial',
        description: generatedTraining.quick_concept,
        item_type: 'lesson',
        due_at: tomorrowPlus(2),
        metadata: { sequence: 1, required: true },
      },
      {
        title: 'Executar checklist/script',
        description: generatedTraining.script,
        item_type: 'checklist',
        due_at: tomorrowPlus(3),
        metadata: { sequence: 2, required: true, checklist: generatedTraining.checklist },
      },
      {
        title: 'Roleplay aplicado',
        description: generatedTraining.roleplay_prompt ?? generatedTraining.exercise,
        item_type: 'roleplay',
        due_at: tomorrowPlus(5),
        metadata: { sequence: 3, required: Boolean(generatedTraining.roleplay_prompt) },
      },
      {
        title: 'Aplicacao em caso real',
        description: generatedTraining.real_case_application,
        item_type: 'real_case_application',
        due_at: tomorrowPlus(dueDays),
        metadata: { sequence: 4, required: true, requiredEvidence: generatedTraining.required_evidence },
      },
      {
        title: 'Feedback do gestor',
        description: generatedTraining.validation_criteria,
        item_type: 'manager_feedback',
        due_at: tomorrowPlus(dueDays + 2),
        metadata: { sequence: 5, required: true },
      },
    ]
    : defaultPlanItems(input.skillArea)

  const items = generatedItems.map((item) => ({
    organization_id: input.organizationId,
    plan_id: plan.id,
    training_module_id: ['lesson', 'checklist', 'training'].includes(item.item_type) ? trainingModule.id : null,
    ...item,
  }))

  await supabase.from('pdi_plan_items').insert(items)
  await supabase.from('training_modules').update({ pdi_plan_id: plan.id }).eq('id', trainingModule.id)

  if (input.gapId) {
    const gapStatus = ['approved', 'active'].includes(plan.status) ? 'in_pdi' : 'open'
    await supabase.from('pdi_gaps').update({ status: gapStatus }).eq('id', input.gapId)
    await createEntityRelationship(supabase, {
      organizationId: input.organizationId,
      fromEntityType: 'pdi_gap',
      fromEntityId: input.gapId,
      toEntityType: 'pdi_plan',
      toEntityId: plan.id,
      relationshipType: 'converted_to_plan',
    })
  }

  const { event } = await createEventWithImpacts(
    supabase,
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      eventType: ['approved', 'active'].includes(plan.status) ? 'pdi.plan_approved' : 'pdi.plan_recommended',
      sourceModule: 'pdi',
      entityType: 'pdi_plan',
      entityId: plan.id,
      title: `PDI recomendado: ${input.title}`,
      description: input.description ?? null,
      impactScore: 60,
      priorityScore: 70,
      metadata: { gapId: input.gapId ?? null, skillArea: input.skillArea },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'plan_recommended' },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: input.targetUserId, impactType: 'development_priority' },
      { impactedModule: 'mission', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'practice_required' },
      { impactedModule: 'xp', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'evidence_required' },
    ],
  )

  await createRecommendation(supabase, {
    organizationId: input.organizationId,
    eventId: event.id,
    targetUserId: input.managerId ?? input.targetUserId,
    createdByUserId: input.actorUserId,
    sourceModule: 'pdi',
    recommendationType: ['approved', 'active'].includes(plan.status) ? 'pdi_training' : 'pdi_approval',
    title: ['approved', 'active'].includes(plan.status) ? `Aplicar PDI: ${input.title}` : `Aprovar PDI: ${input.title}`,
    description: ['approved', 'active'].includes(plan.status)
      ? 'Treino estruturado liberado para aplicacao real.'
      : 'Revise, ajuste e aprove o plano antes da aplicacao em campo.',
    suggestedActionLabel: ['approved', 'active'].includes(plan.status) ? 'Abrir Meu PDI' : 'Revisar PDI',
    suggestedActionHref: ['approved', 'active'].includes(plan.status) ? '/desenvolvimento/pdi' : '/monitoramento/desenvolvimento',
    priority: 'high',
    metadata: { planId: plan.id, gapId: input.gapId ?? null },
  })

  return { plan, event }
}

export async function approvePdiPlan(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    managerId: string
    planId: string
    title?: string
    description?: string
    status?: PdiPlanStatus
    dueDate?: string | null
    targetValue?: number | null
    currentValue?: number | null
    metadata?: JsonObject
  },
) {
  const updatePayload: Record<string, unknown> = {
    status: params.status ?? 'active',
    manager_id: params.managerId,
    updated_at: new Date().toISOString(),
  }
  if (params.title) updatePayload.title = params.title
  if (params.description !== undefined) updatePayload.description = params.description
  if (params.dueDate !== undefined) updatePayload.due_date = params.dueDate
  if (params.targetValue !== undefined) updatePayload.target_value = params.targetValue
  if (params.currentValue !== undefined) updatePayload.current_value = params.currentValue
  if (params.metadata) updatePayload.metadata = params.metadata

  const { data: plan, error } = await supabase
    .from('pdi_plans')
    .update(updatePayload)
    .eq('id', params.planId)
    .eq('organization_id', params.organizationId)
    .select('*')
    .single()

  if (error) throw error

  const releasingPlan = !['rejected', 'cancelled'].includes(plan.status)
  const { error: missionReleaseError } = await supabase
    .from('ai_missions')
    .update({
      status: releasingPlan ? 'pending' : 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', params.organizationId)
    .eq('pdi_plan_id', plan.id)
    .eq('status', 'awaiting_approval')
    .eq('current_value', 0)

  if (missionReleaseError) throw missionReleaseError

  if (plan.gap_id) {
    const gapStatus = ['rejected', 'cancelled'].includes(plan.status) ? 'dismissed' : 'in_pdi'
    await supabase
      .from('pdi_gaps')
      .update({ status: gapStatus, updated_at: new Date().toISOString() })
      .eq('id', plan.gap_id)
  }

  const { event } = await createEventWithImpacts(
    supabase,
    {
      organizationId: params.organizationId,
      actorUserId: params.managerId,
      targetUserId: plan.user_id,
      eventType: ['rejected', 'cancelled'].includes(plan.status) ? 'pdi.plan_rejected' : 'pdi.plan_approved',
      sourceModule: 'pdi',
      entityType: 'pdi_plan',
      entityId: plan.id,
      title: ['rejected', 'cancelled'].includes(plan.status) ? `PDI rejeitado: ${plan.title}` : `PDI aprovado: ${plan.title}`,
      description: plan.description,
      impactScore: ['rejected', 'cancelled'].includes(plan.status) ? 20 : 70,
      priorityScore: ['rejected', 'cancelled'].includes(plan.status) ? 30 : 75,
      metadata: { managerId: params.managerId },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: plan.status },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: plan.user_id, impactType: 'pdi_status_changed' },
    ],
  )

  if (!['rejected', 'cancelled'].includes(plan.status)) {
    await createRecommendation(supabase, {
      organizationId: params.organizationId,
      eventId: event.id,
      targetUserId: plan.user_id,
      createdByUserId: params.managerId,
      sourceModule: 'pdi',
      recommendationType: 'pdi_training',
      title: `Executar PDI aprovado: ${plan.title}`,
      description: 'Concluir o treino e registrar uma aplicacao real com evidencia.',
      suggestedActionLabel: 'Abrir Meu PDI',
      suggestedActionHref: '/desenvolvimento/pdi',
      priority: 'high',
      metadata: { planId: plan.id },
    })

    await notifyUser(supabase, {
      organizationId: params.organizationId,
      userId: plan.user_id,
      senderId: params.managerId,
      title: `Novo PDI liberado: ${plan.title}`,
      message: 'Seu gestor aprovou um PDI aplicado. Abra o treino, pratique e envie evidencia em uma oportunidade real.',
      actionHref: '/desenvolvimento/pdi',
      context: { planId: plan.id, gapId: plan.gap_id ?? null },
    })
  }

  return { plan, event }
}

export async function submitPdiApplication(supabase: SupabaseClient, input: SubmitApplicationInput) {
  const { data: plan } = await supabase
    .from('pdi_plans')
    .select('*')
    .eq('id', input.planId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (!plan) throw new Error('PDI nao encontrado')
  if (plan.user_id !== input.targetUserId) throw new Error('PDI pertence a outro usuario')

  let accountId = input.accountId ?? null
  if (input.dealId) {
    const { data: deal } = await supabase
      .from('crm_deals')
      .select('id, account_id, organization_id')
      .eq('id', input.dealId)
      .eq('organization_id', input.organizationId)
      .maybeSingle()

    if (!deal) throw new Error('Oportunidade nao encontrada na organizacao')
    if (!accountId) accountId = deal.account_id ?? null
  }

  if (accountId) {
    const { data: account } = await supabase
      .from('crm_accounts')
      .select('id, organization_id')
      .eq('id', accountId)
      .eq('organization_id', input.organizationId)
      .maybeSingle()

    if (!account) throw new Error('Cliente nao encontrado na organizacao')
  }

  const { data: application, error } = await supabase
    .from('pdi_applications')
    .insert({
      organization_id: input.organizationId,
      plan_id: input.planId,
      user_id: input.targetUserId,
      deal_id: input.dealId ?? null,
      account_id: accountId,
      activity_id: input.activityId ?? null,
      application_type: input.applicationType ?? 'deal',
      description: input.description,
      evidence: { ...(input.evidence ?? {}), accountId },
    })
    .select('*')
    .single()

  if (error) throw error

  await supabase
    .from('pdi_plans')
    .update({ status: ['approved', 'pending_approval'].includes(plan.status) ? 'active' : plan.status, updated_at: new Date().toISOString() })
    .eq('id', plan.id)

  await supabase
    .from('pdi_plan_items')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('plan_id', plan.id)
    .in('item_type', ['deal_application', 'real_case_application', 'follow_up_application', 'proposal_application', 'simulation'])

  const relationships = [
    input.dealId ? createEntityRelationship(supabase, {
      organizationId: input.organizationId,
      fromEntityType: 'pdi_application',
      fromEntityId: application.id,
      toEntityType: 'crm_deal',
      toEntityId: input.dealId,
      relationshipType: 'applied_in_real_deal',
    }) : null,
    input.activityId ? createEntityRelationship(supabase, {
      organizationId: input.organizationId,
      fromEntityType: 'pdi_application',
      fromEntityId: application.id,
      toEntityType: 'crm_activity',
      toEntityId: input.activityId,
      relationshipType: 'evidenced_by_activity',
    }) : null,
    accountId ? createEntityRelationship(supabase, {
      organizationId: input.organizationId,
      fromEntityType: 'pdi_application',
      fromEntityId: application.id,
      toEntityType: 'crm_account',
      toEntityId: accountId,
      relationshipType: 'applied_in_customer_context',
    }) : null,
  ].filter(Boolean)
  await Promise.all(relationships)

  const { event } = await createEventWithImpacts(
    supabase,
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      eventType: 'pdi.application_submitted',
      sourceModule: 'pdi',
      entityType: 'pdi_application',
      entityId: application.id,
      title: `Aplicacao real enviada: ${plan.title}`,
      description: input.description,
      impactScore: 75,
      priorityScore: 60,
      metadata: { planId: plan.id, dealId: input.dealId ?? null, accountId },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'application_submitted' },
      { impactedModule: 'crm', impactedEntityType: 'crm_deal', impactedEntityId: input.dealId ?? null, impactType: 'pdi_applied' },
      { impactedModule: 'crm', impactedEntityType: 'crm_account', impactedEntityId: accountId, impactType: 'pdi_applied' },
      { impactedModule: 'xp', impactedEntityType: 'pdi_application', impactedEntityId: application.id, impactType: 'eligible_with_evidence' },
      { impactedModule: 'feed', impactedEntityType: 'pdi_application', impactedEntityId: application.id, impactType: 'recognition_candidate' },
    ],
  )

  if (plan.manager_id) {
    await createRecommendation(supabase, {
      organizationId: input.organizationId,
      eventId: event.id,
      targetUserId: plan.manager_id,
      createdByUserId: input.actorUserId,
      sourceModule: 'pdi',
      recommendationType: 'manager_alert',
      title: 'Validar aplicacao de PDI',
      description: 'Ha evidencia pratica aguardando validacao formal.',
      suggestedActionLabel: 'Revisar evidencia',
      suggestedActionHref: '/monitoramento/desenvolvimento',
      priority: 'medium',
      metadata: { applicationId: application.id, planId: plan.id },
    })
  }

  return { application, event, plan }
}

export async function validatePdiApplication(supabase: SupabaseClient, input: ValidateApplicationInput) {
  const { data: application } = await supabase
    .from('pdi_applications')
    .select('*, plan:pdi_plans(*)')
    .eq('id', input.applicationId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (!application) throw new Error('Aplicacao nao encontrada')

  const { data: updated, error } = await supabase
    .from('pdi_applications')
    .update({
      status: input.status,
      reviewed_by: input.managerId,
      reviewed_at: new Date().toISOString(),
      review_notes: input.reviewNotes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.applicationId)
    .eq('organization_id', input.organizationId)
    .select('*')
    .single()

  if (error) throw error

  const plan = application.plan
  const validated = input.status === 'validated' || input.status === 'approved'
  const currentValue = input.currentValue ?? plan.current_value ?? null
  const deltaValue = currentValue !== null && plan.baseline_value !== null
    ? Number(currentValue) - Number(plan.baseline_value)
    : null

  let evidence = null
  let completed = false
  const eventType = validated
    ? 'pdi.application_validated'
    : input.status === 'rejected'
      ? 'pdi.application_rejected'
      : 'pdi.application_adjustment_requested'

  if (validated) {
    const { data } = await supabase
      .from('pdi_evolution_evidence')
      .insert({
        organization_id: input.organizationId,
        plan_id: plan.id,
        user_id: application.user_id,
        source_entity_type: 'pdi_application',
        source_entity_id: application.id,
        kpi_key: plan.target_kpi_key,
        baseline_value: plan.baseline_value,
        current_value: currentValue,
        delta_value: deltaValue,
        evidence: {
          applicationEvidence: application.evidence,
          reviewNotes: input.reviewNotes ?? null,
          status: input.status,
        },
      })
      .select('*')
      .single()
    evidence = data

    const shouldCompleteByKpi = plan.target_value !== null && currentValue !== null && Number(currentValue) >= Number(plan.target_value)
      const { count: validatedApplications } = await supabase
      .from('pdi_applications')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', plan.id)
      .in('status', ['validated', 'approved'])

    completed = shouldCompleteByKpi || (validatedApplications ?? 0) >= 2

    await supabase
      .from('pdi_plans')
      .update({
        status: completed ? 'completed' : 'active',
        current_value: currentValue,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id)

    if (plan.gap_id) {
      await supabase
        .from('pdi_gaps')
        .update({ status: completed ? 'resolved' : 'improving', updated_at: new Date().toISOString() })
        .eq('id', plan.gap_id)
    }

    if (plan.target_kpi_key && input.kpiEntryValue !== null && input.kpiEntryValue !== undefined) {
      const kpiQuery = supabase
        .from('kpi_definitions')
        .select('id, points_per_unit')
        .eq('organization_id', input.organizationId)
      const { data: kpi } = await (isUuid(plan.target_kpi_key)
        ? kpiQuery.eq('id', plan.target_kpi_key).maybeSingle()
        : kpiQuery.eq('slug', plan.target_kpi_key).maybeSingle())

      if (kpi) {
        await supabase.from('kpi_entries').insert({
          organization_id: input.organizationId,
          user_id: application.user_id,
          kpi_id: kpi.id,
          value: input.kpiEntryValue,
          points_earned: Math.round(Number(input.kpiEntryValue) * Number(kpi.points_per_unit ?? 1)),
          source: 'manual',
        })
      }
    }

    const { event } = await createEventWithImpacts(
      supabase,
      {
        organizationId: input.organizationId,
        actorUserId: input.managerId,
        targetUserId: application.user_id,
        eventType,
        sourceModule: 'pdi',
        entityType: 'pdi_application',
        entityId: application.id,
        title: completed ? `PDI concluido com evidencia: ${plan.title}` : `Aplicacao validada: ${plan.title}`,
        description: input.reviewNotes ?? null,
        impactScore: completed ? 90 : 75,
        priorityScore: completed ? 65 : 55,
        metadata: { planId: plan.id, evidenceId: data?.id ?? null, deltaValue, completed },
      },
      [
        { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: completed ? 'completed' : 'evidence_validated' },
        { impactedModule: 'kpi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'kpi_updated', impactValue: deltaValue },
        { impactedModule: 'xp', impactedEntityType: 'pdi_application', impactedEntityId: application.id, impactType: 'xp_awarded_with_evidence' },
        { impactedModule: 'feed', impactedEntityType: 'pdi_application', impactedEntityId: application.id, impactType: 'recognition_published' },
      ],
    )

    await awardXp(supabase, {
      userId: application.user_id,
      organizationId: input.organizationId,
      amount: completed ? 180 : 90,
      sourceType: 'pdi_application',
      sourceId: application.id,
      performanceEventId: event.id,
      evidence: { planId: plan.id, applicationId: application.id, evidenceId: data?.id ?? null, deltaValue },
      impactExpected: completed ? 'PDI concluido com mudanca de comportamento comprovada' : 'Aplicacao validada em contexto real',
      description: completed ? `PDI concluido: ${plan.title}` : `Aplicacao de PDI validada: ${plan.title}`,
    })

    await checkAndAwardBadges(supabase, application.user_id, input.organizationId, {
      performanceEventId: event.id,
      evidence: { source: 'pdi_application', applicationId: application.id },
    })

    await supabase.from('feed_posts').insert({
      organization_id: input.organizationId,
      type: completed ? 'milestone' : 'achievement',
      author_id: input.managerId,
      target_user_id: application.user_id,
      content: completed
        ? `concluiu o PDI "${plan.title}" com evidencia real de evolucao.`
        : `validou aplicacao real do PDI "${plan.title}".`,
    })

    await notifyUser(supabase, {
      organizationId: input.organizationId,
      userId: application.user_id,
      senderId: input.managerId,
      title: 'Sua aplicacao de PDI foi aprovada',
      message: completed
        ? `Seu PDI "${plan.title}" foi concluido com evidencia real de evolucao.`
        : `Sua aplicacao do PDI "${plan.title}" foi validada pelo gestor.`,
      actionHref: '/desenvolvimento/pdi',
      context: { planId: plan.id, applicationId: application.id, completed },
    })

    return { application: updated, evidence, completed, event }
  }

  const { event } = await createEventWithImpacts(
    supabase,
    {
      organizationId: input.organizationId,
      actorUserId: input.managerId,
      targetUserId: application.user_id,
      eventType,
      sourceModule: 'pdi',
      entityType: 'pdi_application',
      entityId: application.id,
      title: `PDI precisa ajuste: ${plan.title}`,
      description: input.reviewNotes ?? null,
      impactScore: 35,
      priorityScore: 70,
      metadata: { planId: plan.id, status: input.status },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'adjustment_needed' },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: application.user_id, impactType: 'retry_application' },
    ],
  )

  await createRecommendation(supabase, {
    organizationId: input.organizationId,
    eventId: event.id,
    targetUserId: application.user_id,
    createdByUserId: input.managerId,
    sourceModule: 'pdi',
    recommendationType: 'pdi_retry',
    title: `Ajustar aplicacao do PDI: ${plan.title}`,
    description: input.reviewNotes ?? 'Gestor pediu ajuste na evidencia antes de validar evolucao.',
    suggestedActionLabel: 'Reenviar evidencia',
    suggestedActionHref: '/desenvolvimento/pdi',
    priority: 'high',
    metadata: { planId: plan.id, applicationId: application.id },
  })

  await notifyUser(supabase, {
    organizationId: input.organizationId,
    userId: application.user_id,
    senderId: input.managerId,
    title: input.status === 'rejected' ? 'Aplicacao de PDI reprovada' : 'Ajuste solicitado no PDI',
    message: input.reviewNotes ?? 'Seu gestor pediu ajuste na evidencia antes de validar evolucao.',
    actionHref: '/desenvolvimento/pdi',
    context: { planId: plan.id, applicationId: application.id, status: input.status },
  })

  return { application: updated, evidence: null, completed: false, event }
}
