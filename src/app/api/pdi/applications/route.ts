import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { createEntityRelationship, createEventWithImpacts, type JsonObject } from '@/lib/services/performance-os.service'
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
  const planId = new URL(request.url).searchParams.get('planId')
  let query = adminClient
    .from('pdi_applications')
    .select('*, plan:pdi_plans(title), deal:crm_deals(title,value,stage)')
    .eq('organization_id', appUser.organization_id)
    .order('created_at', { ascending: false })

  if (appUser.role === 'seller') query = query.eq('user_id', appUser.id)
  if (planId) query = query.eq('plan_id', planId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ applications: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>
  const planId = asString(body.planId)
  const description = asString(body.description)
  if (!planId || !description) return NextResponse.json({ error: 'planId e description obrigatorios' }, { status: 400 })

  const { data: plan } = await adminClient
    .from('pdi_plans')
    .select('id,user_id,manager_id,title')
    .eq('id', planId)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()

  if (!plan) return NextResponse.json({ error: 'PDI nao encontrado' }, { status: 404 })
  if (appUser.role === 'seller' && plan.user_id !== appUser.id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { data: application, error } = await adminClient
    .from('pdi_applications')
    .insert({
      organization_id: appUser.organization_id,
      plan_id: planId,
      user_id: plan.user_id,
      deal_id: asString(body.dealId) || null,
      activity_id: asString(body.activityId) || null,
      application_type: asString(body.applicationType, 'deal'),
      description,
      evidence: asObject(body.evidence),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const relationships = [
    asString(body.dealId) ? createEntityRelationship(adminClient, {
      organizationId: appUser.organization_id,
      fromEntityType: 'pdi_application',
      fromEntityId: application.id,
      toEntityType: 'crm_deal',
      toEntityId: asString(body.dealId),
      relationshipType: 'applied_in_real_deal',
    }) : null,
    asString(body.activityId) ? createEntityRelationship(adminClient, {
      organizationId: appUser.organization_id,
      fromEntityType: 'pdi_application',
      fromEntityId: application.id,
      toEntityType: 'crm_activity',
      toEntityId: asString(body.activityId),
      relationshipType: 'evidenced_by_activity',
    }) : null,
  ].filter(Boolean)
  await Promise.all(relationships)

  const { event } = await createEventWithImpacts(
    adminClient,
    {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId: plan.user_id,
      eventType: 'pdi.application_submitted',
      sourceModule: 'pdi',
      entityType: 'pdi_application',
      entityId: application.id,
      title: `Aplicacao real enviada: ${plan.title}`,
      description,
      impactScore: 75,
      priorityScore: 55,
      metadata: { planId, dealId: asString(body.dealId) || null },
    },
    [
      { impactedModule: 'pdi', impactedEntityType: 'pdi_plan', impactedEntityId: planId, impactType: 'application_submitted' },
      { impactedModule: 'crm', impactedEntityType: 'crm_deal', impactedEntityId: asString(body.dealId) || null, impactType: 'pdi_applied' },
      { impactedModule: 'xp', impactedEntityType: 'pdi_application', impactedEntityId: application.id, impactType: 'eligible_with_evidence' },
      { impactedModule: 'feed', impactedEntityType: 'pdi_application', impactedEntityId: application.id, impactType: 'recognition_candidate' },
    ],
  )

  if (plan.manager_id) {
    await createRecommendation(adminClient, {
      organizationId: appUser.organization_id,
      eventId: event.id,
      targetUserId: plan.manager_id,
      createdByUserId: appUser.id,
      sourceModule: 'pdi',
      recommendationType: 'manager_alert',
      title: 'Validar aplicacao de PDI',
      description: `${appUser.name} enviou evidencia pratica para o PDI ${plan.title}.`,
      suggestedActionLabel: 'Revisar evidencia',
      suggestedActionHref: '/monitoramento/desenvolvimento',
      priority: 'medium',
      metadata: { applicationId: application.id, planId },
    })
  }

  return NextResponse.json({ application, event }, { status: 201 })
}
