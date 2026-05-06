import type { SupabaseClient } from '@supabase/supabase-js'
import { awardXp } from './xp.service'
import { createEntityRelationship, createEventWithImpacts } from './performance-os.service'

export type ExecutionEventType =
  | 'crm_activity_call'
  | 'crm_activity_whatsapp'
  | 'crm_activity_email'
  | 'crm_activity_follow_up'
  | 'crm_activity_meeting'
  | 'crm_activity_proposal_sent'
  | 'crm_deal_updated'
  | 'crm_deal_won'
  | 'crm_deal_lost'
  | 'pipeline_next_action_created'
  | 'pipeline_overdue_action_resolved'
  | 'manual_kpi_entry'
  | 'mission_manual_validation_requested'

export interface RegisterExecutionEventInput {
  organizationId: string
  userId: string
  actorUserId?: string
  type: ExecutionEventType
  value?: number
  occurredAt?: string
  source?: string
  sourceEntityType?: string | null
  sourceEntityId?: string | null
  missionId?: string | null
  metadata?: Record<string, unknown>
}

interface KpiRow {
  id: string
  name: string
  slug: string | null
  unit: string | null
  points_per_unit: number | null
  source_event?: string | null
  targets?: Record<string, unknown> | null
}

interface MissionRow {
  id: string
  title: string
  status: string
  xp_reward: number | null
  kpi_id: string | null
  target_value: number | null
  current_value: number | null
  verification_type: 'automatic' | 'manual' | 'hybrid' | null
  criteria: Record<string, unknown> | null
  deadline: string | null
  type: string | null
}

const EVENT_CONFIG: Record<ExecutionEventType, { label: string; xp: number; module: string }> = {
  crm_activity_call: { label: 'Ligacao registrada', xp: 2, module: 'crm' },
  crm_activity_whatsapp: { label: 'WhatsApp registrado', xp: 1, module: 'crm' },
  crm_activity_email: { label: 'E-mail registrado', xp: 1, module: 'crm' },
  crm_activity_follow_up: { label: 'Follow-up registrado', xp: 2, module: 'crm' },
  crm_activity_meeting: { label: 'Reuniao registrada', xp: 10, module: 'crm' },
  crm_activity_proposal_sent: { label: 'Proposta enviada', xp: 15, module: 'crm' },
  crm_deal_updated: { label: 'Deal atualizado', xp: 1, module: 'crm' },
  crm_deal_won: { label: 'Venda ganha', xp: 50, module: 'crm' },
  crm_deal_lost: { label: 'Venda perdida registrada', xp: 0, module: 'crm' },
  pipeline_next_action_created: { label: 'Proxima acao criada', xp: 2, module: 'crm' },
  pipeline_overdue_action_resolved: { label: 'Pendencia do pipeline resolvida', xp: 5, module: 'crm' },
  manual_kpi_entry: { label: 'Acao comercial registrada', xp: 0, module: 'execution' },
  mission_manual_validation_requested: { label: 'Validacao de missao solicitada', xp: 0, module: 'mission' },
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function criteriaType(criteria: Record<string, unknown> | null, fallback: string | null) {
  return String(criteria?.type || fallback || 'kpi_target')
}

function missionMatchesEvent(mission: MissionRow, kpis: KpiRow[], eventType: ExecutionEventType) {
  const criteria = mission.criteria ?? {}
  const type = criteriaType(criteria, mission.type)

  if (type === 'manual_validation') return false
  if (type === 'revenue_target') return eventType === 'crm_deal_won'
  if (type === 'pipeline_cleanup') {
    return eventType === 'pipeline_overdue_action_resolved' || eventType === 'pipeline_next_action_created'
  }

  const criteriaEvent = typeof criteria.source_event === 'string' ? criteria.source_event : null
  if (criteriaEvent) return criteriaEvent === eventType

  if (mission.kpi_id) return kpis.some((kpi) => kpi.id === mission.kpi_id)
  return false
}

async function awardMissionXpOnce(
  supabase: SupabaseClient,
  mission: MissionRow,
  organizationId: string,
  userId: string,
  performanceEventId?: string,
) {
  const reward = numeric(mission.xp_reward, 0)
  if (reward <= 0) return null

  return awardXp(supabase, {
    userId,
    organizationId,
    amount: reward,
    sourceType: 'mission',
    sourceId: mission.id,
    performanceEventId,
    evidence: { missionId: mission.id, title: mission.title },
    impactExpected: 'Concluir objetivo comercial validado pela regra da missao.',
    description: `Missao concluida: ${mission.title}`,
  })
}

export async function registerExecutionEvent(
  supabase: SupabaseClient,
  input: RegisterExecutionEventInput,
) {
  const value = numeric(input.value, 1)
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const config = EVENT_CONFIG[input.type]
  const actorUserId = input.actorUserId ?? input.userId
  const metadata = input.metadata ?? {}

  const { data: kpisData, error: kpisError } = await supabase
    .from('kpi_definitions')
    .select('id,name,slug,unit,points_per_unit,source_event,targets')
    .eq('organization_id', input.organizationId)
    .eq('active', true)

  if (kpisError) throw kpisError

  const matchingKpis = ((kpisData ?? []) as KpiRow[]).filter((kpi) => {
    const legacyEvent = typeof kpi.targets?.source_event === 'string' ? kpi.targets.source_event : null
    return kpi.source_event === input.type || legacyEvent === input.type
  })

  const { event, impacts } = await createEventWithImpacts(
    supabase,
    {
      organizationId: input.organizationId,
      actorUserId,
      targetUserId: input.userId,
      eventType: input.type,
      sourceModule: config.module,
      entityType: input.sourceEntityType ?? null,
      entityId: input.sourceEntityId ?? null,
      title: config.label,
      description: typeof metadata.description === 'string' ? metadata.description : null,
      occurredAt,
      impactScore: input.type === 'crm_deal_won' ? 90 : matchingKpis.length ? 65 : 45,
      priorityScore: input.type === 'crm_deal_lost' ? 70 : 45,
      riskScore: input.type === 'crm_deal_lost' ? 85 : 20,
      metadata: { ...metadata, executionEventType: input.type, value },
    },
    [
      { impactedModule: 'kpi', impactedEntityType: 'execution_event', impactedEntityId: input.sourceEntityId ?? null, impactType: 'kpi_update_candidate', impactValue: matchingKpis.length },
      { impactedModule: 'mission', impactedEntityType: 'execution_event', impactedEntityId: input.sourceEntityId ?? null, impactType: 'mission_progress_candidate' },
      { impactedModule: 'xp', impactedEntityType: 'user', impactedEntityId: input.userId, impactType: 'execution_xp_candidate', impactValue: config.xp },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: input.userId, impactType: 'execution_registered' },
    ],
  )

  const kpiEntries = []
  for (const kpi of matchingKpis) {
    const pointsEarned = value * numeric(kpi.points_per_unit, 0)
    const { data: entry, error: entryError } = await supabase
      .from('kpi_entries')
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        kpi_id: kpi.id,
        value,
        points_earned: pointsEarned,
        recorded_at: occurredAt,
        source: input.source ?? 'api',
        source_event: input.type,
        source_entity_type: input.sourceEntityType ?? null,
        source_entity_id: input.sourceEntityId ?? null,
        mission_id: input.missionId ?? null,
        metadata: { ...metadata, performanceEventId: event.id },
      })
      .select('id,kpi_id,points_earned')
      .single()

    if (entryError) throw entryError
    kpiEntries.push(entry)

    if (input.sourceEntityType && input.sourceEntityId) {
      await createEntityRelationship(supabase, {
        organizationId: input.organizationId,
        fromEntityType: input.sourceEntityType,
        fromEntityId: input.sourceEntityId,
        toEntityType: 'kpi_entry',
        toEntityId: entry.id,
        relationshipType: 'updates_kpi',
        metadata: { executionEventType: input.type, kpiId: kpi.id },
      })
    }
  }

  let actionXp = null
  if (config.xp > 0) {
    actionXp = await awardXp(supabase, {
      userId: input.userId,
      organizationId: input.organizationId,
      amount: config.xp,
      sourceType: input.type.startsWith('crm_deal') ? 'crm_deal' : input.type.startsWith('crm_activity') ? 'crm_activity' : 'kpi',
      sourceId: input.sourceEntityId ?? undefined,
      performanceEventId: event.id,
      evidence: { ...metadata, executionEventType: input.type, sourceEntityType: input.sourceEntityType ?? null },
      impactExpected: 'Registrar acao comercial real e alimentar KPIs, missoes e cockpit.',
      description: `${config.label}: +${config.xp} XP`,
    })
  }

  const { data: missionsData, error: missionsError } = await supabase
    .from('ai_missions')
    .select('id,title,status,xp_reward,kpi_id,target_value,current_value,verification_type,criteria,deadline,type')
    .eq('organization_id', input.organizationId)
    .eq('user_id', input.userId)
    .in('status', ['pending', 'in_progress'])

  if (missionsError) throw missionsError

  const missionUpdates = []
  const completedMissions = []
  const now = new Date()

  for (const mission of ((missionsData ?? []) as MissionRow[])) {
    if (mission.deadline && new Date(mission.deadline) < now) {
      await supabase.from('ai_missions').update({ status: 'expired', updated_at: now.toISOString() }).eq('id', mission.id)
      continue
    }

    if (!missionMatchesEvent(mission, matchingKpis, input.type)) continue

    const targetValue = numeric(mission.target_value, numeric(mission.criteria?.target_value, 0))
    const previousValue = numeric(mission.current_value, 0)
    const increment = criteriaType(mission.criteria, mission.type) === 'revenue_target'
      ? numeric(metadata.revenue ?? metadata.value ?? value, value)
      : value
    const currentValue = previousValue + increment
    const reachedTarget = targetValue <= 0 ? currentValue > previousValue : currentValue >= targetValue
    const verificationType = mission.verification_type ?? 'automatic'
    const nextStatus = reachedTarget
      ? verificationType === 'automatic'
        ? 'completed'
        : 'awaiting_approval'
      : 'in_progress'

    const updatePayload: Record<string, unknown> = {
      current_value: currentValue,
      status: nextStatus,
      updated_at: now.toISOString(),
    }
    if (nextStatus === 'completed') updatePayload.completed_at = now.toISOString()

    const { error: missionUpdateError } = await supabase
      .from('ai_missions')
      .update(updatePayload)
      .eq('id', mission.id)

    if (missionUpdateError) throw missionUpdateError

    if (input.sourceEntityType && input.sourceEntityId) {
      await createEntityRelationship(supabase, {
        organizationId: input.organizationId,
        fromEntityType: input.sourceEntityType,
        fromEntityId: input.sourceEntityId,
        toEntityType: 'ai_mission',
        toEntityId: mission.id,
        relationshipType: 'progresses_mission',
        metadata: { executionEventType: input.type, increment, currentValue, targetValue },
      })
    }

    const missionUpdate = { id: mission.id, title: mission.title, previousValue, currentValue, targetValue, status: nextStatus }
    missionUpdates.push(missionUpdate)

    if (nextStatus === 'completed' && mission.status !== 'completed') {
      const xpResult = await awardMissionXpOnce(supabase, mission, input.organizationId, input.userId, event.id)
      completedMissions.push({ ...missionUpdate, xpResult })
    }
  }

  return {
    event,
    impacts,
    kpiEntries,
    actionXp,
    missionUpdates,
    completedMissions,
  }
}

export async function approveMission(
  supabase: SupabaseClient,
  params: { missionId: string; organizationId: string; approverId: string },
) {
  const { data: mission, error } = await supabase
    .from('ai_missions')
    .select('id,title,user_id,organization_id,status,xp_reward')
    .eq('id', params.missionId)
    .eq('organization_id', params.organizationId)
    .maybeSingle()

  if (error) throw error
  if (!mission) throw new Error('Missao nao encontrada')
  if (mission.status === 'completed') return { mission, xpResult: null }

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('ai_missions')
    .update({
      status: 'completed',
      approved_by: params.approverId,
      approved_at: now,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', params.missionId)
    .eq('organization_id', params.organizationId)
    .select('*')
    .single()

  if (updateError) throw updateError

  const xpResult = await awardXp(supabase, {
    userId: mission.user_id,
    organizationId: params.organizationId,
    amount: numeric(mission.xp_reward, 0),
    sourceType: 'mission',
    sourceId: mission.id,
    evidence: { approvedBy: params.approverId },
    impactExpected: 'Validacao do gestor para concluir missao.',
    description: `Missao aprovada: ${mission.title}`,
  })

  return { mission: updated, xpResult }
}

export async function rejectMission(
  supabase: SupabaseClient,
  params: { missionId: string; organizationId: string; reviewerId: string; reason?: string },
) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ai_missions')
    .update({
      status: 'rejected',
      rejected_by: params.reviewerId,
      rejected_at: now,
      rejection_reason: params.reason ?? null,
      updated_at: now,
    })
    .eq('id', params.missionId)
    .eq('organization_id', params.organizationId)
    .select('*')
    .single()

  if (error) throw error
  return { mission: data }
}
