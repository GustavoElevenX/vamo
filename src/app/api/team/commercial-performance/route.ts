import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { getTeamCommercialPerformance } from '@/lib/services/team-commercial-performance.service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer', 'consultant'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const data = await getTeamCommercialPerformance(adminClient, appUser.organization_id, {
      period: searchParams.get('period'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      sellerId: searchParams.get('seller_id'),
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('GET /api/team/commercial-performance', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar performance comercial' },
      { status: 500 },
    )
  }
}
