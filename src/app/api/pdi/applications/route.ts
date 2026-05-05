import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { submitPdiApplication, validatePdiApplication } from '@/lib/services/pdi.service'
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
  const planId = new URL(request.url).searchParams.get('planId')
  let query = adminClient
    .from('pdi_applications')
    .select('*, plan:pdi_plans(title), deal:crm_deals(title,value,stage), user:users(name)')
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

  try {
    const result = await submitPdiApplication(adminClient, {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId: appUser.role === 'seller' ? appUser.id : asString(body.userId, appUser.id),
      planId,
      dealId: asString(body.dealId) || null,
      activityId: asString(body.activityId) || null,
      applicationType: asString(body.applicationType, 'deal') as any,
      description,
      evidence: asObject(body.evidence),
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
  const body = await request.json() as Record<string, unknown>
  const applicationId = asString(body.applicationId || body.id)
  const status = asString(body.status)

  if (!applicationId || !status) {
    return NextResponse.json({ error: 'applicationId e status obrigatorios' }, { status: 400 })
  }
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem validar aplicacoes' }, { status: 403 })
  }

  try {
    const result = await validatePdiApplication(adminClient, {
      organizationId: appUser.organization_id,
      managerId: appUser.id,
      applicationId,
      status: status as any,
      reviewNotes: asString(body.reviewNotes) || null,
      currentValue: typeof body.currentValue === 'number' ? body.currentValue : null,
      kpiEntryValue: typeof body.kpiEntryValue === 'number' ? body.kpiEntryValue : null,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
  }
}
