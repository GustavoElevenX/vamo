import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { createEntityRelationship, createEventWithImpacts } from '@/lib/services/performance-os.service'
import { awardXp } from '@/lib/services/xp.service'
import { ACTIVITY_LABELS, type ActivityType } from '@/types/crm'

export const runtime = 'nodejs'

const ACTIVITY_TYPES: ActivityType[] = ['call', 'email', 'meeting', 'proposal_sent', 'whatsapp', 'note']
const ACTIVITY_NEXT_ACTION_TYPE: Record<ActivityType, string> = {
  call: 'call',
  email: 'email',
  meeting: 'meeting',
  proposal_sent: 'proposal',
  whatsapp: 'follow_up',
  note: 'other',
}
const ACTIVITY_KPI_MAP: Record<ActivityType, string[]> = {
  call: ['Ligacoes', 'Calls', 'Contatos'],
  meeting: ['Reunioes', 'Meetings', 'Visitas'],
  proposal_sent: ['Propostas', 'Proposals'],
  email: [],
  whatsapp: [],
  note: [],
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
    return NextResponse.json({ error: 'Deal nao encontrado' }, { status: 404 })
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
    .select('id, organization_id, owner_id, title, value, stage, probability')
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()
  if (!deal || (appUser.role === 'seller' && deal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'Deal nao encontrado' }, { status: 404 })
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

  const kpiNames = ACTIVITY_KPI_MAP[type]
  if (kpiNames.length > 0) {
    const { data: kpi } = await adminClient
      .from('kpi_definitions')
      .select('id, points_per_unit')
      .eq('organization_id', appUser.organization_id)
      .eq('active', true)
      .in('name', kpiNames)
      .limit(1)
      .maybeSingle()

    if (kpi) {
      const { data: kpiEntry } = await adminClient.from('kpi_entries').insert({
        organization_id: appUser.organization_id,
        user_id: appUser.id,
        kpi_id: kpi.id,
        value: 1,
        points_earned: Number(kpi.points_per_unit ?? 0),
        recorded_at: new Date().toISOString().slice(0, 10),
        source: 'api',
      }).select('id, points_earned').single()

      if (kpiEntry) {
        await createEntityRelationship(adminClient, {
          organizationId: appUser.organization_id,
          fromEntityType: 'crm_activity',
          fromEntityId: activity.id,
          toEntityType: 'kpi_entry',
          toEntityId: kpiEntry.id,
          relationshipType: 'updates_kpi',
          metadata: { activityType: type, kpiNames },
        })
      }
    }
  }

  const forecastImpact = Number(deal.value || 0) * Number(deal.probability || 0) / 100
  const { event } = await createEventWithImpacts(
    adminClient,
    {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId: deal.owner_id,
      eventType: 'crm_activity.created',
      sourceModule: 'crm',
      entityType: 'crm_activity',
      entityId: activity.id,
      title: `${title} em ${deal.title}`,
      description: outcome,
      impactScore: 60,
      priorityScore: nextActionTitle ? 55 : 45,
      riskScore: input.clear_next_action === true ? 20 : 35,
      metadata: {
        dealId: id,
        activityType: type,
        nextActionTitle: nextActionTitle || null,
        forecastImpact,
      },
    },
    [
      { impactedModule: 'crm', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: 'activity_registered' },
      { impactedModule: 'kpi', impactedEntityType: 'crm_activity', impactedEntityId: activity.id, impactType: 'kpi_candidate', impactValue: kpiNames.length ? 1 : 0 },
      { impactedModule: 'mission', impactedEntityType: 'crm_activity', impactedEntityId: activity.id, impactType: 'progress_candidate' },
      { impactedModule: 'commission', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: 'forecast_commission_recalculated', impactValue: forecastImpact },
      { impactedModule: 'forecast', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: 'forecast_updated', impactValue: forecastImpact },
      { impactedModule: 'xp', impactedEntityType: 'crm_activity', impactedEntityId: activity.id, impactType: 'eligible_with_evidence', impactValue: kpiNames.length ? 10 : 0 },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: deal.owner_id, impactType: 'seller_feedback' },
    ],
  )

  let xpFeedback = 0
  if (kpiNames.length > 0) {
    xpFeedback = 10
    await awardXp(adminClient, {
      userId: appUser.id,
      organizationId: appUser.organization_id,
      amount: xpFeedback,
      sourceType: 'crm_activity',
      sourceId: activity.id,
      performanceEventId: event.id,
      evidence: { dealId: id, activityType: type, outcome },
      impactExpected: 'Atualizar KPI, manter follow-up e proteger forecast.',
      description: `+${xpFeedback} XP por registrar ${ACTIVITY_LABELS[type].toLowerCase()} com evidencia em deal real`,
    })
  }

  if (nextActionTitle) {
    await createRecommendation(adminClient, {
      organizationId: appUser.organization_id,
      eventId: event.id,
      targetUserId: deal.owner_id,
      createdByUserId: appUser.id,
      sourceModule: 'crm',
      recommendationType: 'next_action',
      title: nextActionTitle,
      description: `Proxima melhor acao para ${deal.title}.`,
      suggestedActionLabel: 'Abrir deal',
      suggestedActionHref: `/crm/${id}`,
      priority: 'medium',
      dueAt: input.next_action_due_at || null,
      metadata: { dealId: id, activityId: activity.id },
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
        activity_id: activity.id,
        application_type: type === 'proposal_sent' ? 'proposal' : 'follow_up',
        description: outcome,
        evidence: { activityId: activity.id, dealId: id, source: 'crm_activity' },
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
    event,
    feedback: {
      goalProgressHint: kpiNames.length ? '+1 KPI relacionado' : 'Atividade registrada',
      forecastImpact,
      xp: xpFeedback,
      missionHint: 'Missao relacionada pode avancar se houver regra ativa.',
      nextBestAction: nextActionTitle || 'Defina a proxima acao para manter o deal em movimento.',
    },
  }, { status: 201 })
}
