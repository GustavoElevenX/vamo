import type { SupabaseClient } from '@supabase/supabase-js'
import { createRecommendation } from './action-recommendation.service'
import {
  createEntityRelationship,
  createEventWithImpacts,
  type JsonObject,
} from './performance-os.service'
import { awardXp } from './xp.service'
import { checkAndAwardBadges } from './badge.service'

type PdiSeverity = 'low' | 'medium' | 'high' | 'critical'
type PdiPlanStatus = 'recommended' | 'approved' | 'active' | 'completed' | 'paused' | 'rejected'
type PdiApplicationStatus = 'submitted' | 'validated' | 'needs_adjustment' | 'rejected'

interface UserContext {
  organizationId: string
  actorUserId: string
  targetUserId: string
}

interface DetectGapInput extends UserContext {
  skillArea: string
  title: string
  description?: string | null
  detectedFrom: string
  sourceEntityType?: string | null
  sourceEntityId?: string | null
  severity?: PdiSeverity
  confidenceScore?: number
  evidence?: JsonObject
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

function severityFromRatio(ratio: number): PdiSeverity {
  if (ratio < 0.35) return 'critical'
  if (ratio < 0.55) return 'high'
  if (ratio < 0.75) return 'medium'
  return 'low'
}

function tomorrowPlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function defaultPlanItems(skillArea: string) {
  return [
    {
      title: `Microtreino: ${skillArea}`,
      description: 'Revisar um conceito pratico e transformar em um comportamento observavel.',
      item_type: 'training',
      due_at: tomorrowPlus(2),
      metadata: { sequence: 1 },
    },
    {
      title: 'Roleplay no simulador',
      description: 'Praticar a habilidade em uma conversa simulada antes de aplicar em cliente real.',
      item_type: 'simulation',
      due_at: tomorrowPlus(4),
      metadata: { sequence: 2, href: '/simulador' },
    },
    {
      title: 'Aplicacao em oportunidade real',
      description: 'Usar a tecnica em deal, proposta ou follow-up e registrar evidencia.',
      item_type: 'deal_application',
      due_at: tomorrowPlus(7),
      metadata: { sequence: 3 },
    },
    {
      title: 'Validacao do gestor',
      description: 'Gestor revisa evidencia e confirma se houve mudanca de comportamento.',
      item_type: 'manager_review',
      due_at: tomorrowPlus(9),
      metadata: { sequence: 4 },
    },
  ]
}

async function getOrCreateTrainingModule(
  supabase: SupabaseClient,
  organizationId: string,
  skillArea: string,
) {
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
  if (input.sourceEntityId) {
    const { data: existing } = await supabase
      .from('pdi_gaps')
      .select('*')
      .eq('organization_id', input.organizationId)
      .eq('user_id', input.targetUserId)
      .eq('source_entity_id', input.sourceEntityId)
      .in('status', ['open', 'in_pdi', 'improving'])
      .maybeSingle()

    if (existing) return existing
  }

  const { data: gap, error } = await supabase
    .from('pdi_gaps')
    .insert({
      organization_id: input.organizationId,
      user_id: input.targetUserId,
      gap_type: input.detectedFrom === 'kpi' ? 'performance_gap' : 'behavior_gap',
      skill_area: input.skillArea,
      title: input.title,
      description: input.description ?? null,
      detected_from: input.detectedFrom,
      source_entity_type: input.sourceEntityType ?? null,
      source_entity_id: input.sourceEntityId ?? null,
      severity: input.severity ?? 'medium',
      confidence_score: input.confidenceScore ?? 0.7,
      evidence: input.evidence ?? {},
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
      metadata: { skillArea: input.skillArea, detectedFrom: input.detectedFrom },
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
    suggestedActionLabel: 'Abrir PDI',
    suggestedActionHref: '/desenvolvimento/pdi',
    priority: input.severity === 'critical' || input.severity === 'high' ? 'high' : 'medium',
    metadata: { gapId: gap.id, skillArea: input.skillArea },
  })

  return gap
}

export async function recommendPdiPlan(supabase: SupabaseClient, input: RecommendPlanInput) {
  const trainingModule = await getOrCreateTrainingModule(supabase, input.organizationId, input.skillArea)
  const { data: plan, error } = await supabase
    .from('pdi_plans')
    .insert({
      organization_id: input.organizationId,
      user_id: input.targetUserId,
      manager_id: input.managerId ?? null,
      gap_id: input.gapId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'recommended',
      recommended_by: input.recommendedBy ?? 'ai',
      start_date: new Date().toISOString().slice(0, 10),
      due_date: tomorrowPlus(14).slice(0, 10),
      target_kpi_key: input.targetKpiKey ?? null,
      baseline_value: input.baselineValue ?? null,
      target_value: input.targetValue ?? null,
      current_value: input.baselineValue ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        skillArea: input.skillArea,
        trainingModuleId: trainingModule.id,
        flow: ['gap', 'plan', 'training', 'application', 'validation', 'evolution'],
      },
    })
    .select('*')
    .single()

  if (error) throw error

  const items = defaultPlanItems(input.skillArea).map((item) => ({
    organization_id: input.organizationId,
    plan_id: plan.id,
    training_module_id: item.item_type === 'training' ? trainingModule.id : null,
    ...item,
  }))

  await supabase.from('pdi_plan_items').insert(items)

  if (input.gapId) {
    await supabase.from('pdi_gaps').update({ status: 'in_pdi' }).eq('id', input.gapId)
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
      eventType: plan.status === 'approved' ? 'pdi.plan_approved' : 'pdi.plan_recommended',
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
    recommendationType: plan.status === 'approved' ? 'pdi_training' : 'pdi_approval',
    title: plan.status === 'approved' ? `Aplicar PDI: ${input.title}` : `Aprovar PDI: ${input.title}`,
    description: plan.status === 'approved'
      ? 'Treino estruturado liberado para aplicacao real.'
      : 'Revise, ajuste e aprove o plano antes da aplicacao em campo.',
    suggestedActionLabel: plan.status === 'approved' ? 'Abrir Meu PDI' : 'Revisar PDI',
    suggestedActionHref: plan.status === 'approved' ? '/desenvolvimento/pdi' : '/monitoramento/desenvolvimento',
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
    status: params.status ?? 'approved',
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

  const { event } = await createEventWithImpacts(
    supabase,
    {
      organizationId: params.organizationId,
      actorUserId: params.managerId,
      targetUserId: plan.user_id,
      eventType: plan.status === 'rejected' ? 'pdi.plan_rejected' : 'pdi.plan_approved',
      sourceModule: 'pdi',
      entityType: 'pdi_plan',
      entityId: plan.id,
      title: plan.status === 'rejected' ? `PDI rejeitado: ${plan.title}` : `PDI aprovado: ${plan.title}`,
      description: plan.description,
      impactScore: plan.status === 'rejected' ? 20 : 70,
      priorityScore: plan.status === 'rejected' ? 30 : 75,
      metadata: { managerId: params.managerId },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: plan.status },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: plan.user_id, impactType: 'pdi_status_changed' },
    ],
  )

  if (plan.status !== 'rejected') {
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

  const { data: application, error } = await supabase
    .from('pdi_applications')
    .insert({
      organization_id: input.organizationId,
      plan_id: input.planId,
      user_id: input.targetUserId,
      deal_id: input.dealId ?? null,
      activity_id: input.activityId ?? null,
      application_type: input.applicationType ?? 'deal',
      description: input.description,
      evidence: input.evidence ?? {},
    })
    .select('*')
    .single()

  if (error) throw error

  await supabase
    .from('pdi_plans')
    .update({ status: plan.status === 'approved' ? 'active' : plan.status, updated_at: new Date().toISOString() })
    .eq('id', plan.id)

  await supabase
    .from('pdi_plan_items')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('plan_id', plan.id)
    .in('item_type', ['deal_application', 'follow_up_application', 'proposal_application', 'simulation'])

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
      metadata: { planId: plan.id, dealId: input.dealId ?? null },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'application_submitted' },
      { impactedModule: 'crm', impactedEntityType: 'crm_deal', impactedEntityId: input.dealId ?? null, impactType: 'pdi_applied' },
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
  const validated = input.status === 'validated'
  const currentValue = input.currentValue ?? plan.current_value ?? null
  const deltaValue = currentValue !== null && plan.baseline_value !== null
    ? Number(currentValue) - Number(plan.baseline_value)
    : null

  let evidence = null
  let completed = false
  const eventType = validated ? 'pdi.application_validated' : 'pdi.application_adjustment_requested'

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
      .eq('status', 'validated')

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

  return { application: updated, evidence: null, completed: false, event }
}
