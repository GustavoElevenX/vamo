import type { SupabaseClient } from '@supabase/supabase-js'
import type { JsonObject } from './performance-os.service'

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical'
export type RecommendationStatus = 'open' | 'accepted' | 'done' | 'dismissed' | 'expired'

export interface CreateRecommendationInput {
  organizationId: string
  eventId?: string | null
  targetUserId?: string | null
  createdByUserId?: string | null
  sourceModule: string
  recommendationType: string
  title: string
  description?: string | null
  suggestedActionLabel?: string | null
  suggestedActionHref?: string | null
  suggestedActionPayload?: JsonObject
  priority?: RecommendationPriority
  dueAt?: string | null
  metadata?: JsonObject
}

export async function createRecommendation(
  supabase: SupabaseClient,
  input: CreateRecommendationInput,
) {
  const { data, error } = await supabase
    .from('action_recommendations')
    .insert({
      organization_id: input.organizationId,
      event_id: input.eventId ?? null,
      target_user_id: input.targetUserId ?? null,
      created_by_user_id: input.createdByUserId ?? null,
      source_module: input.sourceModule,
      recommendation_type: input.recommendationType,
      title: input.title,
      description: input.description ?? null,
      suggested_action_label: input.suggestedActionLabel ?? 'Agir agora',
      suggested_action_href: input.suggestedActionHref ?? null,
      suggested_action_payload: input.suggestedActionPayload ?? {},
      priority: input.priority ?? 'medium',
      due_at: input.dueAt ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function updateRecommendationStatus(
  supabase: SupabaseClient,
  id: string,
  status: RecommendationStatus,
) {
  const { data, error } = await supabase
    .from('action_recommendations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export function acceptRecommendation(supabase: SupabaseClient, id: string) {
  return updateRecommendationStatus(supabase, id, 'accepted')
}

export function completeRecommendation(supabase: SupabaseClient, id: string) {
  return updateRecommendationStatus(supabase, id, 'done')
}

export function dismissRecommendation(supabase: SupabaseClient, id: string) {
  return updateRecommendationStatus(supabase, id, 'dismissed')
}

export async function listSellerRecommendations(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('action_recommendations')
    .select('*, event:performance_events(*)')
    .eq('target_user_id', userId)
    .in('status', ['open', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw error
  return data ?? []
}

export async function listManagerRecommendations(
  supabase: SupabaseClient,
  _managerId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from('action_recommendations')
    .select('*, target:users!action_recommendations_target_user_id_fkey(id,name), event:performance_events(*)')
    .eq('organization_id', organizationId)
    .in('status', ['open', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}
