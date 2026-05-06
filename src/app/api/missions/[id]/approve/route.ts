import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { approveMission } from '@/lib/services/execution.service'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestor pode aprovar missao' }, { status: 403 })
    }

    const result = await approveMission(adminClient, {
      missionId: id,
      organizationId: appUser.organization_id,
      approverId: appUser.id,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('POST /api/missions/[id]/approve', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao aprovar missao' },
      { status: 500 },
    )
  }
}
