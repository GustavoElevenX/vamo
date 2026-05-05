import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { approvePdiPlan, recommendPdiPlan } from '@/lib/services/pdi.service'
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

  try {
    const result = await recommendPdiPlan(adminClient, {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId,
      managerId: appUser.role === 'seller' ? null : appUser.id,
      gapId: asString(body.gapId) || null,
      title,
      description: asString(body.description) || null,
      skillArea: asString(body.skillArea, title),
      targetKpiKey: asString(body.targetKpiKey) || null,
      baselineValue: typeof body.baselineValue === 'number' ? body.baselineValue : null,
      targetValue: typeof body.targetValue === 'number' ? body.targetValue : null,
      status: asString(body.status, appUser.role === 'seller' ? 'recommended' : 'approved') as any,
      recommendedBy: appUser.role === 'seller' ? 'ai' : 'manager',
      metadata: asObject(body.metadata),
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem aprovar ou ajustar PDI' }, { status: 403 })
  }

  const body = await request.json() as Record<string, unknown>
  const id = asString(body.id)
  const status = asString(body.status)
  if (!id || !status) return NextResponse.json({ error: 'id e status obrigatorios' }, { status: 400 })

  try {
    const result = await approvePdiPlan(adminClient, {
      organizationId: appUser.organization_id,
      managerId: appUser.id,
      planId: id,
      title: asString(body.title) || undefined,
      description: body.description === undefined ? undefined : asString(body.description),
      status: status as any,
      dueDate: body.dueDate === undefined ? undefined : asString(body.dueDate) || null,
      targetValue: typeof body.targetValue === 'number' ? body.targetValue : undefined,
      currentValue: typeof body.currentValue === 'number' ? body.currentValue : undefined,
      metadata: body.metadata ? asObject(body.metadata) : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}
