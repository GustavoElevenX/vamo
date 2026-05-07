import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { generatePdiTraining } from '@/lib/services/pdi.service'

export const runtime = 'nodejs'

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth

  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem gerar treinamento de PDI' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const gapId = asString(body.gap_id || body.gapId)
  if (!gapId) return NextResponse.json({ error: 'gap_id obrigatorio' }, { status: 400 })

  try {
    const result = await generatePdiTraining(adminClient, {
      organizationId: appUser.organization_id,
      managerId: appUser.id,
      gapId,
      sellerId: asString(body.seller_id || body.sellerId) || null,
      managerNotes: asString(body.manager_notes || body.managerNotes) || null,
      createMission: Boolean(body.create_mission ?? body.createMission),
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao gerar treinamento' }, { status: 500 })
  }
}
