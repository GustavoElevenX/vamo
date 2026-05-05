import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { generateTodayPriorities } from '@/lib/services/contextual-ai.service'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const result = await generateTodayPriorities(adminClient, appUser.id, appUser.organization_id)
  return NextResponse.json(result)
}
