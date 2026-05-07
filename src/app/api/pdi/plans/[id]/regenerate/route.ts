import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { generatePdiTraining } from '@/lib/services/pdi.service'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth

  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestores podem regenerar PDI' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>

  const { data: plan, error } = await adminClient
    .from('pdi_plans')
    .select('id,gap_id,user_id')
    .eq('organization_id', appUser.organization_id)
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!plan?.gap_id) return NextResponse.json({ error: 'PDI sem gap vinculado' }, { status: 400 })

  try {
    const result = await generatePdiTraining(adminClient, {
      organizationId: appUser.organization_id,
      managerId: appUser.id,
      gapId: plan.gap_id,
      sellerId: plan.user_id,
      managerNotes: typeof body.manager_notes === 'string' ? body.manager_notes : null,
      createMission: Boolean(body.create_mission),
    })

    await adminClient
      .from('pdi_plans')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao regenerar PDI' }, { status: 500 })
  }
}
