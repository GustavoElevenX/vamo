import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { detectPdiGaps } from '@/lib/services/pdi.service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth

  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem detectar gaps do time' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    seller_id?: string
    sellerId?: string
    period?: { start?: string; end?: string }
    sources?: string[]
  }

  try {
    const result = await detectPdiGaps(adminClient, {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      sellerId: body.seller_id ?? body.sellerId ?? null,
      period: body.period ?? null,
      sources: Array.isArray(body.sources) ? body.sources as any : null,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao detectar gaps' }, { status: 500 })
  }
}
