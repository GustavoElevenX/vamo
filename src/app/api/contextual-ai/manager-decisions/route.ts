import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { generateManagerAlerts } from '@/lib/services/contextual-ai.service'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const result = await generateManagerAlerts(adminClient, appUser.id, appUser.organization_id)
  return NextResponse.json(result)
}
