import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { detectGap } from '@/lib/services/pdi.service'
import type { JsonObject } from '@/lib/services/performance-os.service'

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

  try {
    const gap = await detectGap(adminClient, {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId,
      skillArea,
      title,
      description: asString(body.description) || null,
      detectedFrom: asString(body.detectedFrom, 'manager_observation'),
      sourceEntityType: asString(body.sourceEntityType) || null,
      sourceEntityId: asString(body.sourceEntityId) || null,
      severity: asString(body.severity, 'medium') as 'low' | 'medium' | 'high' | 'critical',
      confidenceScore: Number(body.confidenceScore ?? 0.7),
      evidence: {
        ...asObject(body.evidence),
        gapType: asString(body.gapType, 'performance_gap'),
      },
    })

    return NextResponse.json({ gap }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}
