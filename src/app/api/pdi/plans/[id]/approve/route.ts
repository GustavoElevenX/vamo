import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { approvePdiPlan } from '@/lib/services/pdi.service'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth

  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem aprovar PDI' }, { status: 403 })
  }

  const { id } = await context.params
  try {
    const result = await approvePdiPlan(adminClient, {
      organizationId: appUser.organization_id,
      managerId: appUser.id,
      planId: id,
      status: 'active',
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao aprovar PDI' }, { status: 500 })
  }
}
