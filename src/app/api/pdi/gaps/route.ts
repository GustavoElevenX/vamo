import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { createEventWithImpacts, type JsonObject } from '@/lib/services/performance-os.service'
import { createRecommendation } from '@/lib/services/action-recommendation.service'

export const runtime = 'nodejs'

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export async function GET(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const userId = new URL(request.url).searchParams.get('userId')
  let query = adminClient
    .from('pdi_gaps')
    .select('*, user:users(id,name)')
    .eq('organization_id', appUser.organization_id)
    .order('created_at', { ascending: false })

  if (appUser.role === 'seller') query = query.eq('user_id', appUser.id)
  else if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ gaps: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>
  const targetUserId = asString(body.userId, appUser.id)
  const title = asString(body.title)
  const skillArea = asString(body.skillArea)

  if (!title || !skillArea) {
    return NextResponse.json({ error: 'title e skillArea sao obrigatorios' }, { status: 400 })
  }

  const { data: gap, error } = await adminClient
    .from('pdi_gaps')
    .insert({
      organization_id: appUser.organization_id,
      user_id: targetUserId,
      gap_type: asString(body.gapType, 'performance_gap'),
      skill_area: skillArea,
      title,
      description: asString(body.description) || null,
      detected_from: asString(body.detectedFrom, 'manager_observation'),
      source_entity_type: asString(body.sourceEntityType) || null,
      source_entity_id: asString(body.sourceEntityId) || null,
      severity: asString(body.severity, 'medium'),
      confidence_score: Number(body.confidenceScore ?? 0.7),
      evidence: asObject(body.evidence),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { event } = await createEventWithImpacts(
    adminClient,
    {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId,
      eventType: 'pdi.gap_detected',
      sourceModule: 'pdi',
      entityType: 'pdi_gap',
      entityId: gap.id,
      title: `Gap detectado: ${title}`,
      description: asString(body.description) || null,
      impactScore: 40,
      priorityScore: asString(body.severity) === 'critical' ? 90 : 60,
      riskScore: asString(body.severity) === 'critical' ? 85 : 50,
      metadata: { skillArea, detectedFrom: asString(body.detectedFrom, 'manager_observation') },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_gap', impactedEntityId: gap.id, impactType: 'gap_detected' },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: targetUserId, impactType: 'seller_priority' },
      { impactedModule: 'hoje_gestor', impactedEntityType: 'user', impactedEntityId: targetUserId, impactType: 'manager_decision' },
      { impactedModule: 'ai', impactedEntityType: 'pdi_gap', impactedEntityId: gap.id, impactType: 'pdi_recommendation_needed' },
    ],
  )

  await createRecommendation(adminClient, {
    organizationId: appUser.organization_id,
    eventId: event.id,
    targetUserId,
    createdByUserId: appUser.id,
    sourceModule: 'pdi',
    recommendationType: 'pdi_plan',
    title: `Criar PDI aplicado: ${title}`,
    description: 'Transforme este gap em treino curto, aplicacao real e evidencia de evolucao.',
    suggestedActionLabel: 'Abrir PDI',
    suggestedActionHref: '/desenvolvimento/pdi',
    priority: 'high',
    metadata: { gapId: gap.id, skillArea },
  })

  return NextResponse.json({ gap, event }, { status: 201 })
}
