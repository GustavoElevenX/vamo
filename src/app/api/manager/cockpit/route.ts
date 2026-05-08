import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { buildManagerCockpit } from '@/lib/services/manager-cockpit.service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const data = await buildManagerCockpit(
      adminClient,
      appUser.organization_id,
      appUser.id,
      appUser.name,
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/manager/cockpit', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao montar cockpit do gestor' },
      { status: 500 },
    )
  }
}
