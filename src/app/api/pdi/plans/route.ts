import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { createEntityRelationship, createEventWithImpacts, type JsonObject } from '@/lib/services/performance-os.service'

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
    .from('pdi_plans')
    .select('*, gap:pdi_gaps(*), items:pdi_plan_items(*)')
    .eq('organization_id', appUser.organization_id)
    .order('created_at', { ascending: false })

  if (appUser.role === 'seller') query = query.eq('user_id', appUser.id)
  else if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>
  const targetUserId = asString(body.userId, appUser.id)
  const title = asString(body.title)
  if (!title) return NextResponse.json({ error: 'title obrigatorio' }, { status: 400 })

  const { data: plan, error } = await adminClient
    .from('pdi_plans')
    .insert({
      organization_id: appUser.organization_id,
      user_id: targetUserId,
      manager_id: appUser.role === 'seller' ? null : appUser.id,
      gap_id: asString(body.gapId) || null,
      title,
      description: asString(body.description) || null,
      status: asString(body.status, appUser.role === 'seller' ? 'recommended' : 'approved'),
      recommended_by: appUser.role === 'seller' ? 'ai' : 'manager',
      start_date: asString(body.startDate) || null,
      due_date: asString(body.dueDate) || null,
      target_kpi_key: asString(body.targetKpiKey) || null,
      baseline_value: typeof body.baselineValue === 'number' ? body.baselineValue : null,
      target_value: typeof body.targetValue === 'number' ? body.targetValue : null,
      current_value: typeof body.currentValue === 'number' ? body.currentValue : null,
      metadata: asObject(body.metadata),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (plan.gap_id) {
    await adminClient.from('pdi_gaps').update({ status: 'in_pdi' }).eq('id', plan.gap_id)
    await createEntityRelationship(adminClient, {
      organizationId: appUser.organization_id,
      fromEntityType: 'pdi_gap',
      fromEntityId: plan.gap_id,
      toEntityType: 'pdi_plan',
      toEntityId: plan.id,
      relationshipType: 'converted_to_plan',
    })
  }

  const { event } = await createEventWithImpacts(
    adminClient,
    {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId,
      eventType: plan.status === 'approved' ? 'pdi.plan_approved' : 'pdi.plan_created',
      sourceModule: 'pdi',
      entityType: 'pdi_plan',
      entityId: plan.id,
      title: `PDI criado: ${title}`,
      description: asString(body.description) || null,
      impactScore: 55,
      priorityScore: 65,
      metadata: { gapId: plan.gap_id, targetKpiKey: plan.target_kpi_key },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'plan_created' },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: targetUserId, impactType: 'development_priority' },
      { impactedModule: 'mission', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'practice_required' },
      { impactedModule: 'xp', impactedEntityType: 'pdi_plan', impactedEntityId: plan.id, impactType: 'evidence_required' },
    ],
  )

  await createRecommendation(adminClient, {
    organizationId: appUser.organization_id,
    eventId: event.id,
    targetUserId,
    createdByUserId: appUser.id,
    sourceModule: 'pdi',
    recommendationType: 'pdi_training',
    title: `Aplicar PDI em caso real: ${title}`,
    description: 'Conclua o treino curto e registre uma aplicacao em deal, proposta, follow-up ou simulacao.',
    suggestedActionLabel: 'Abrir Meu PDI',
    suggestedActionHref: '/desenvolvimento/pdi',
    priority: 'high',
    metadata: { planId: plan.id },
  })

  return NextResponse.json({ plan, event }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>
  const id = asString(body.id)
  const status = asString(body.status)
  if (!id || !status) return NextResponse.json({ error: 'id e status obrigatorios' }, { status: 400 })

  const { data: plan, error } = await adminClient
    .from('pdi_plans')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan })
}
