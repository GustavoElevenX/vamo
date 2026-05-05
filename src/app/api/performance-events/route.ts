import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import {
  createEventWithImpacts,
  getEntityTimeline,
  getManagerTodayContext,
  getTodaySellerContext,
  type JsonObject,
} from '@/lib/services/performance-os.service'

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
  const url = new URL(request.url)
  const entityType = url.searchParams.get('entityType')
  const entityId = url.searchParams.get('entityId')

  if (entityType && entityId) {
    const timeline = await getEntityTimeline(adminClient, entityType, entityId)
    return NextResponse.json({ timeline })
  }

  if (appUser.role === 'seller') {
    const context = await getTodaySellerContext(adminClient, appUser.id)
    return NextResponse.json(context)
  }

  const context = await getManagerTodayContext(adminClient, appUser.id, appUser.organization_id)
  return NextResponse.json(context)
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>
  const eventType = asString(body.eventType)
  const sourceModule = asString(body.sourceModule)
  const title = asString(body.title)

  if (!eventType || !sourceModule || !title) {
    return NextResponse.json({ error: 'eventType, sourceModule e title sao obrigatorios' }, { status: 400 })
  }

  const result = await createEventWithImpacts(
    adminClient,
    {
      organizationId: appUser.organization_id,
      actorUserId: asString(body.actorUserId, appUser.id),
      targetUserId: asString(body.targetUserId, appUser.id),
      eventType,
      sourceModule,
      entityType: asString(body.entityType) || null,
      entityId: asString(body.entityId) || null,
      title,
      description: asString(body.description) || null,
      impactScore: Number(body.impactScore ?? 0),
      priorityScore: Number(body.priorityScore ?? 0),
      riskScore: Number(body.riskScore ?? 0),
      metadata: asObject(body.metadata),
    },
    Array.isArray(body.impacts)
      ? body.impacts.map((impact) => {
          const item = asObject(impact)
          return {
            impactedModule: asString(item.impactedModule),
            impactedEntityType: asString(item.impactedEntityType) || null,
            impactedEntityId: asString(item.impactedEntityId) || null,
            impactType: asString(item.impactType, 'context'),
            impactValue: typeof item.impactValue === 'number' ? item.impactValue : null,
            impactPayload: asObject(item.impactPayload),
          }
        }).filter((impact) => impact.impactedModule)
      : [],
  )

  return NextResponse.json(result, { status: 201 })
}
