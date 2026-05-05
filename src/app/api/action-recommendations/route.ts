import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import {
  acceptRecommendation,
  completeRecommendation,
  createRecommendation,
  dismissRecommendation,
  listManagerRecommendations,
  listSellerRecommendations,
  type RecommendationPriority,
} from '@/lib/services/action-recommendation.service'
import type { JsonObject } from '@/lib/services/performance-os.service'

export const runtime = 'nodejs'

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function priority(value: unknown): RecommendationPriority {
  return ['low', 'medium', 'high', 'critical'].includes(String(value)) ? value as RecommendationPriority : 'medium'
}

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const recommendations = appUser.role === 'seller'
    ? await listSellerRecommendations(adminClient, appUser.id)
    : await listManagerRecommendations(adminClient, appUser.id, appUser.organization_id)

  return NextResponse.json({ recommendations })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>

  const title = asString(body.title)
  const recommendationType = asString(body.recommendationType)
  const sourceModule = asString(body.sourceModule)
  if (!title || !recommendationType || !sourceModule) {
    return NextResponse.json({ error: 'title, recommendationType e sourceModule sao obrigatorios' }, { status: 400 })
  }

  const recommendation = await createRecommendation(adminClient, {
    organizationId: appUser.organization_id,
    eventId: asString(body.eventId) || null,
    targetUserId: asString(body.targetUserId) || appUser.id,
    createdByUserId: appUser.id,
    sourceModule,
    recommendationType,
    title,
    description: asString(body.description) || null,
    suggestedActionLabel: asString(body.suggestedActionLabel, 'Agir agora'),
    suggestedActionHref: asString(body.suggestedActionHref) || null,
    suggestedActionPayload: asObject(body.suggestedActionPayload),
    priority: priority(body.priority),
    dueAt: asString(body.dueAt) || null,
    metadata: asObject(body.metadata),
  })

  return NextResponse.json({ recommendation }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient } = auth
  const body = await request.json() as Record<string, unknown>
  const id = asString(body.id)
  const action = asString(body.action)

  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

  const recommendation =
    action === 'accept' ? await acceptRecommendation(adminClient, id)
      : action === 'complete' ? await completeRecommendation(adminClient, id)
        : action === 'dismiss' ? await dismissRecommendation(adminClient, id)
          : null

  if (!recommendation) return NextResponse.json({ error: 'action invalida' }, { status: 400 })
  return NextResponse.json({ recommendation })
}
