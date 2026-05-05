import type { SupabaseClient } from '@supabase/supabase-js'

export type JsonObject = Record<string, unknown>

export interface PerformanceEventRecord {
  id: string
  organization_id: string
  actor_user_id: string | null
  target_user_id: string | null
  event_type: string
  source_module: string
  entity_type: string | null
  entity_id: string | null
  title: string
  description: string | null
  occurred_at: string
  impact_score: number
  priority_score: number
  risk_score: number
  metadata: JsonObject
  created_at: string
}

export interface CreatePerformanceEventInput {
  organizationId: string
  actorUserId?: string | null
  targetUserId?: string | null
  eventType: string
  sourceModule: string
  entityType?: string | null
  entityId?: string | null
  title: string
  description?: string | null
  occurredAt?: string
  impactScore?: number
  priorityScore?: number
  riskScore?: number
  metadata?: JsonObject
}

export interface LinkEventImpactInput {
  organizationId: string
  eventId: string
  impactedModule: string
  impactedEntityType?: string | null
  impactedEntityId?: string | null
  impactType: string
  impactValue?: number | null
  impactPayload?: JsonObject
}

export interface CreateEntityRelationshipInput {
  organizationId: string
  fromEntityType: string
  fromEntityId: string
  toEntityType: string
  toEntityId: string
  relationshipType: string
  metadata?: JsonObject
}

export async function createPerformanceEvent(
  supabase: SupabaseClient,
  input: CreatePerformanceEventInput,
): Promise<PerformanceEventRecord> {
  const { data, error } = await supabase
    .from('performance_events')
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId ?? null,
      target_user_id: input.targetUserId ?? null,
      event_type: input.eventType,
      source_module: input.sourceModule,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      title: input.title,
      description: input.description ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      impact_score: input.impactScore ?? 0,
      priority_score: input.priorityScore ?? 0,
      risk_score: input.riskScore ?? 0,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data as PerformanceEventRecord
}

export async function linkEventImpact(
  supabase: SupabaseClient,
  input: LinkEventImpactInput,
) {
  const { data, error } = await supabase
    .from('event_impacts')
    .insert({
      organization_id: input.organizationId,
      event_id: input.eventId,
      impacted_module: input.impactedModule,
      impacted_entity_type: input.impactedEntityType ?? null,
      impacted_entity_id: input.impactedEntityId ?? null,
      impact_type: input.impactType,
      impact_value: input.impactValue ?? null,
      impact_payload: input.impactPayload ?? {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function linkEventImpacts(
  supabase: SupabaseClient,
  impacts: LinkEventImpactInput[],
) {
  if (!impacts.length) return []
  const { data, error } = await supabase
    .from('event_impacts')
    .insert(
      impacts.map((impact) => ({
        organization_id: impact.organizationId,
        event_id: impact.eventId,
        impacted_module: impact.impactedModule,
        impacted_entity_type: impact.impactedEntityType ?? null,
        impacted_entity_id: impact.impactedEntityId ?? null,
        impact_type: impact.impactType,
        impact_value: impact.impactValue ?? null,
        impact_payload: impact.impactPayload ?? {},
      })),
    )
    .select('*')

  if (error) throw error
  return data ?? []
}

export async function createEntityRelationship(
  supabase: SupabaseClient,
  input: CreateEntityRelationshipInput,
) {
  const { data, error } = await supabase
    .from('entity_relationships')
    .insert({
      organization_id: input.organizationId,
      from_entity_type: input.fromEntityType,
      from_entity_id: input.fromEntityId,
      to_entity_type: input.toEntityType,
      to_entity_id: input.toEntityId,
      relationship_type: input.relationshipType,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function getTodaySellerContext(supabase: SupabaseClient, userId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const [events, recommendations, gaps, health, deals] = await Promise.all([
    supabase
      .from('performance_events')
      .select('*')
      .or(`actor_user_id.eq.${userId},target_user_id.eq.${userId}`)
      .gte('occurred_at', `${today}T00:00:00.000Z`)
      .order('occurred_at', { ascending: false })
      .limit(20),
    supabase
      .from('action_recommendations')
      .select('*')
      .eq('target_user_id', userId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('pdi_gaps')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['open', 'in_pdi', 'improving'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('health_calibrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('crm_deals')
      .select('id,title,value,stage,probability,next_action_title,next_action_due_at,next_action_status,forecast_category,ai_priority_score,updated_at')
      .eq('owner_id', userId)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('ai_priority_score', { ascending: false })
      .limit(8),
  ])

  return {
    events: events.data ?? [],
    recommendations: recommendations.data ?? [],
    gaps: gaps.data ?? [],
    healthCalibration: health.data?.[0] ?? null,
    deals: deals.data ?? [],
  }
}

export async function getManagerTodayContext(
  supabase: SupabaseClient,
  managerId: string,
  organizationId: string,
) {
  const [events, recommendations, gaps, health] = await Promise.all([
    supabase
      .from('performance_events')
      .select('*')
      .eq('organization_id', organizationId)
      .order('occurred_at', { ascending: false })
      .limit(30),
    supabase
      .from('action_recommendations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('pdi_gaps')
      .select('*, user:users(id,name)')
      .eq('organization_id', organizationId)
      .in('status', ['open', 'in_pdi'])
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('health_calibrations')
      .select('*, user:users(id,name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    managerId,
    events: events.data ?? [],
    recommendations: recommendations.data ?? [],
    pdiGaps: gaps.data ?? [],
    healthCalibrations: health.data ?? [],
  }
}

export async function getEntityTimeline(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
) {
  const { data, error } = await supabase
    .from('performance_events')
    .select('*, impacts:event_impacts(*)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('occurred_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}

export async function createEventWithImpacts(
  supabase: SupabaseClient,
  eventInput: CreatePerformanceEventInput,
  impacts: Omit<LinkEventImpactInput, 'organizationId' | 'eventId'>[],
) {
  const event = await createPerformanceEvent(supabase, eventInput)
  const linkedImpacts = await linkEventImpacts(
    supabase,
    impacts.map((impact) => ({
      ...impact,
      organizationId: event.organization_id,
      eventId: event.id,
    })),
  )
  return { event, impacts: linkedImpacts }
}
