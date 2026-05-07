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
  const status = new URL(request.url).searchParams.get('status')
  const source = new URL(request.url).searchParams.get('source')
  const skillSlug = new URL(request.url).searchParams.get('skill_slug')
  const severity = new URL(request.url).searchParams.get('severity')
  let query = adminClient
    .from('pdi_gaps')
    .select('*, user:users(id,name)')
    .eq('organization_id', appUser.organization_id)
    .order('created_at', { ascending: false })

  if (appUser.role === 'seller') query = query.eq('user_id', appUser.id)
  else if (userId) query = query.eq('user_id', userId)
  if (status && status !== 'all') query = query.eq('status', status)
  else if (!status) query = query.in('status', ['open', 'in_training', 'in_pdi', 'improving'])
  if (source) query = query.eq('detected_from', source)
  if (skillSlug) query = query.eq('skill_area', skillSlug)
  if (severity) query = query.eq('severity', severity)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ gaps: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem criar gaps manuais' }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>
  const targetUserId = asString(body.userId, appUser.id)
  const title = asString(body.title)
  const skillArea = asString(body.skillArea)

  if (!title || !skillArea) {
    return NextResponse.json({ error: 'title e skillArea sao obrigatorios' }, { status: 400 })
  }

  const { data: targetUser } = await adminClient
    .from('users')
    .select('id')
    .eq('id', targetUserId)
    .eq('organization_id', appUser.organization_id)
    .eq('active', true)
    .maybeSingle()

  if (!targetUser) {
    return NextResponse.json({ error: 'Vendedor nao encontrado na organizacao' }, { status: 404 })
  }

  try {
    const gap = await detectGap(adminClient, {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId,
      skillArea,
      title,
      description: asString(body.description) || null,
      detectedFrom: asString(body.detectedFrom || body.source, 'manager'),
      sourceEntityType: asString(body.sourceEntityType) || null,
      sourceEntityId: asString(body.sourceEntityId) || null,
      severity: asString(body.severity, 'medium') as 'low' | 'medium' | 'high' | 'critical',
      confidenceScore: Number(body.confidenceScore ?? 0.7),
      impactValue: typeof body.impactValue === 'number' ? body.impactValue : typeof body.impact_value === 'number' ? body.impact_value : null,
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

export async function PATCH(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem alterar gaps' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = asString(body.id || body.gap_id)
  const status = asString(body.status)
  if (!id || !status) return NextResponse.json({ error: 'id e status obrigatorios' }, { status: 400 })

  const { data, error } = await adminClient
    .from('pdi_gaps')
    .update({
      status,
      resolved_at: ['resolved', 'dismissed'].includes(status) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', appUser.organization_id)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ gap: data })
}
