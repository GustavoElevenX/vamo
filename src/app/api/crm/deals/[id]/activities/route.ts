import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { createEntityRelationship } from '@/lib/services/performance-os.service'
import { registerExecutionEvent, type ExecutionEventType } from '@/lib/services/execution.service'
import { ACTIVITY_LABELS, type ActivityType } from '@/types/crm'

export const runtime = 'nodejs'

const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'proposal_sent', 'whatsapp', 'follow_up', 'note']

const ACTIVITY_NEXT_ACTION_TYPE: Record<ActivityType, string> = {
  call: 'call',
  email: 'email',
  meeting: 'meeting',
  proposal_sent: 'proposal',
  whatsapp: 'follow_up',
  follow_up: 'follow_up',
  note: 'other',
}

const ACTIVITY_EVENT_MAP: Record<ActivityType, ExecutionEventType> = {
  call: 'crm_activity_call',
  email: 'crm_activity_email',
  meeting: 'crm_activity_meeting',
  proposal_sent: 'crm_activity_proposal_sent',
  whatsapp: 'crm_activity_whatsapp',
  follow_up: 'crm_activity_follow_up',
  note: 'crm_deal_updated',
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth

  const { data: deal } = await adminClient
    .from('crm_deals')
    .select('id, owner_id')
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()

  if (!deal || (appUser.role === 'seller' && deal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'oportunidade não encontrado' }, { status: 404 })
  }

  const { data, error } = await adminClient
    .from('crm_activities')
    .select('*, user:users(id,name)')
    .eq('deal_id', id)
    .order('occurred_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities: data ?? [] })
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const input = await request.json()

  const type = ACTIVITY_TYPES.includes(input.type) ? input.type as ActivityType : 'note'
  const outcome = String(input.outcome ?? '').trim()
  const title = String(input.title || outcome || 'Atividade registrada').trim()

  if (!outcome) return NextResponse.json({ error: 'Conte o que aconteceu' }, { status: 400 })

  const { data: deal } = await adminClient
    .from('crm_deals')
    .select('id, organization_id, account_id, owner_id, title, value, stage, probability')
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()

  if (!deal || (appUser.role === 'seller' && deal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'oportunidade não encontrado' }, { status: 404 })
  }

  const { data: activity, error } = await adminClient
    .from('crm_activities')
    .insert({
      deal_id: id,
      user_id: appUser.id,
      type,
      title,
      notes: input.notes || null,
      outcome,
      occurred_at: input.occurred_at || new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const nextActionTitle = String(input.next_action_title ?? '').trim()
  if (nextActionTitle) {
    await adminClient
      .from('crm_deals')
      .update({
        next_action_title: nextActionTitle,
        next_action_type: input.next_action_type || ACTIVITY_NEXT_ACTION_TYPE[type],
        next_action_due_at: input.next_action_due_at || null,
        next_action_status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', appUser.organization_id)
  } else if (input.clear_next_action === true) {
    await adminClient
      .from('crm_deals')
      .update({
        next_action_status: 'done',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', appUser.organization_id)
  }

  const forecastImpact = Number(deal.value || 0) * Number(deal.probability || 0) / 100
  const execution = await registerExecutionEvent(adminClient, {
    organizationId: appUser.organization_id,
    userId: deal.owner_id,
    actorUserId: appUser.id,
    type: ACTIVITY_EVENT_MAP[type],
    value: 1,
    occurredAt: activity.occurred_at,
    source: 'crm',
    sourceEntityType: 'crm_activity',
    sourceEntityId: activity.id,
    metadata: {
      dealId: id,
      accountId: deal.account_id,
      dealTitle: deal.title,
      activityType: type,
      activityLabel: ACTIVITY_LABELS[type],
      title,
      outcome,
      nextActionTitle: nextActionTitle || null,
      clearNextAction: input.clear_next_action === true,
      forecastImpact,
      description: `${title} em ${deal.title}`,
    },
  })

  if (nextActionTitle) {
    await createRecommendation(adminClient, {
      organizationId: appUser.organization_id,
      eventId: execution.event.id,
      targetUserId: deal.owner_id,
      createdByUserId: appUser.id,
      sourceModule: 'crm',
      recommendationType: 'next_action',
      title: nextActionTitle,
      description: `Proxima melhor acao para ${deal.title}.`,
      suggestedActionLabel: 'Abrir oportunidade',
      suggestedActionHref: `/crm/${id}`,
      priority: 'medium',
      dueAt: input.next_action_due_at || null,
      metadata: { dealId: id, activityId: activity.id, eventType: ACTIVITY_EVENT_MAP[type] },
    })
  }

  if (typeof input.pdi_plan_id === 'string' && input.pdi_plan_id) {
    const { data: pdiApplication } = await adminClient
      .from('pdi_applications')
      .insert({
        organization_id: appUser.organization_id,
        plan_id: input.pdi_plan_id,
        user_id: appUser.id,
        deal_id: id,
        account_id: deal.account_id ?? null,
        activity_id: activity.id,
        application_type: type === 'proposal_sent' ? 'proposal' : 'follow_up',
        description: outcome,
        evidence: { activityId: activity.id, dealId: id, accountId: deal.account_id ?? null, source: 'crm_activity' },
      })
      .select('id')
      .single()

    if (pdiApplication) {
      await createEntityRelationship(adminClient, {
        organizationId: appUser.organization_id,
        fromEntityType: 'crm_activity',
        fromEntityId: activity.id,
        toEntityType: 'pdi_application',
        toEntityId: pdiApplication.id,
        relationshipType: 'applies_pdi',
      })
    }
  }

  return NextResponse.json({
    activity,
    event: execution.event,
    feedback: {
      goalProgressHint: execution.kpiEntries.length ? `+${execution.kpiEntries.length} indicador(es) atualizado(s)` : 'Atividade registrada',
      forecastImpact,
      xp: execution.actionXp ? 1 : 0,
      kpiEntries: execution.kpiEntries.length,
      missionUpdates: execution.missionUpdates,
      missionHint: execution.missionUpdates.length ? 'Missão relacionada avancou.' : 'Nenhuma missão ativa relacionada a esta ação.',
      nextBestAction: nextActionTitle || 'Defina a próxima ação para manter o oportunidade em movimento.',
    },
  }, { status: 201 })
}
