import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { rejectMission } from '@/lib/services/execution.service'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestor pode reprovar missao' }, { status: 403 })
    }

    const input = await request.json().catch(() => ({}))
    const result = await rejectMission(adminClient, {
      missionId: id,
      organizationId: appUser.organization_id,
      reviewerId: appUser.id,
      reason: input.reason ? String(input.reason) : undefined,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('POST /api/missions/[id]/reject', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reprovar missao' },
      { status: 500 },
    )
  }
}
