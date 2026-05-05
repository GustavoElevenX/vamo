import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { generateDealScript } from '@/lib/services/contextual-ai.service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>
  const dealId = typeof body.dealId === 'string' ? body.dealId : ''
  if (!dealId) return NextResponse.json({ error: 'dealId obrigatorio' }, { status: 400 })

  const result = await generateDealScript(adminClient, dealId, appUser.organization_id)
  return NextResponse.json(result)
}
