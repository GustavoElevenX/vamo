import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { registerExecutionEvent, type ExecutionEventType } from '@/lib/services/execution.service'

export const runtime = 'nodejs'

const EVENT_TYPES: ExecutionEventType[] = [
  'crm_activity_call',
  'crm_activity_whatsapp',
  'crm_activity_email',
  'crm_activity_follow_up',
  'crm_activity_meeting',
  'crm_activity_proposal_sent',
  'crm_deal_updated',
  'crm_deal_won',
  'crm_deal_lost',
  'pipeline_next_action_created',
  'pipeline_overdue_action_resolved',
  'manual_kpi_entry',
  'mission_manual_validation_requested',
]

function parseValue(value: unknown) {
  const parsed = Number(value ?? 1)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export async function POST(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth
    const input = await request.json()

    const type = String(input.type ?? '') as ExecutionEventType
    if (!EVENT_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipo de evento invalido' }, { status: 400 })
    }

    const targetUserId = String(input.userId || appUser.id)
    if (targetUserId !== appUser.id && !['manager', 'admin', 'developer'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestor pode registrar por outro vendedor' }, { status: 403 })
    }

    const result = await registerExecutionEvent(adminClient, {
      organizationId: appUser.organization_id,
      userId: targetUserId,
      actorUserId: appUser.id,
      type,
      value: parseValue(input.value),
      occurredAt: input.occurredAt || input.occurred_at || undefined,
      source: String(input.source || 'manual'),
      sourceEntityType: input.sourceEntityType || input.source_entity_type || null,
      sourceEntityId: input.sourceEntityId || input.source_entity_id || null,
      missionId: input.missionId || input.mission_id || null,
      metadata: typeof input.metadata === 'object' && input.metadata ? input.metadata : {},
    })

    return NextResponse.json({
      ok: true,
      event: result.event,
      kpiEntries: result.kpiEntries,
      missionUpdates: result.missionUpdates,
      completedMissions: result.completedMissions,
      xp: result.actionXp,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/execution/events', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao registrar execução' },
      { status: 500 },
    )
  }
}
