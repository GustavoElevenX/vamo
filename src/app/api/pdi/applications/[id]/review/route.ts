import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { validatePdiApplication } from '@/lib/services/pdi.service'

export const runtime = 'nodejs'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth

  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem validar aplicacoes' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const status = typeof body.status === 'string' ? body.status : ''
  if (!['approved', 'validated', 'needs_revision', 'needs_adjustment', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status invalido' }, { status: 400 })
  }

  try {
    const result = await validatePdiApplication(adminClient, {
      organizationId: appUser.organization_id,
      managerId: appUser.id,
      applicationId: id,
      status: status as any,
      reviewNotes: typeof body.manager_feedback === 'string'
        ? body.manager_feedback
        : typeof body.reviewNotes === 'string'
          ? body.reviewNotes
          : null,
      currentValue: typeof body.currentValue === 'number' ? body.currentValue : null,
      kpiEntryValue: typeof body.kpiEntryValue === 'number' ? body.kpiEntryValue : null,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao revisar aplicacao' }, { status: 500 })
  }
}
