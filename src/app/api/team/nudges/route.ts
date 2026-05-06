import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { createEventWithImpacts } from '@/lib/services/performance-os.service'

export const runtime = 'nodejs'

const NUDGE_TYPES = ['focus', 'risk', 'recognition', 'execution', 'coaching'] as const
const MODES = ['message', 'mission', 'one_on_one'] as const

type NudgeType = typeof NUDGE_TYPES[number]
type NudgeMode = typeof MODES[number]

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function todayAt18h() {
  const date = new Date()
  date.setHours(18, 0, 0, 0)
  if (date.getTime() < Date.now()) date.setDate(date.getDate() + 1)
  return date.toISOString()
}

function buildMissionForNudge(type: NudgeType, message: string, context: Record<string, unknown>) {
  if (type === 'risk' || type === 'focus') {
    const target = Math.max(1, Math.min(10, num(context.deals_without_next_action ?? context.overdue_followups, 3)))
    return {
      title: `Atualizar ${target} oportunidade(s) com proxima acao`,
      description: message,
      type: 'pipeline_cleanup',
      target_value: target,
      verification_type: 'automatic',
      xp_reward: 80,
      criteria: {
        type: 'pipeline_cleanup',
        target_value: target,
        source_event: 'pipeline_next_action_created',
        value_at_risk: num(context.value_at_risk),
      },
    }
  }

  if (type === 'execution') {
    return {
      title: 'Registrar 3 follow-ups comerciais',
      description: message,
      type: 'kpi_target',
      target_value: 3,
      verification_type: 'automatic',
      xp_reward: 60,
      criteria: {
        type: 'kpi_target',
        target_value: 3,
        source_event: 'crm_activity_follow_up',
      },
    }
  }

  if (type === 'coaching') {
    return {
      title: 'Avancar uma oportunidade em proposta',
      description: message,
      type: 'kpi_target',
      target_value: 1,
      verification_type: 'hybrid',
      xp_reward: 90,
      criteria: {
        type: 'kpi_target',
        target_value: 1,
        source_event: 'crm_activity_proposal_sent',
      },
    }
  }

  return {
    title: 'Compartilhar boa pratica comercial',
    description: message,
    type: 'manual_validation',
    target_value: 1,
    verification_type: 'manual',
    xp_reward: 50,
    criteria: {
      type: 'manual_validation',
      target_value: 1,
      reason: 'recognition',
    },
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestor pode enviar nudge' }, { status: 403 })
    }

    const input = await request.json()
    const sellerId = String(input.seller_id || input.sellerId || '')
    const type = NUDGE_TYPES.includes(input.type) ? input.type as NudgeType : 'focus'
    const mode = MODES.includes(input.mode) ? input.mode as NudgeMode : 'message'
    const message = String(input.message || '').trim()
    const context = typeof input.context === 'object' && input.context ? input.context as Record<string, unknown> : {}

    if (!sellerId || !message) {
      return NextResponse.json({ error: 'seller_id e message sao obrigatorios' }, { status: 400 })
    }

    const { data: seller, error: sellerError } = await adminClient
      .from('users')
      .select('id,name,organization_id,role')
      .eq('id', sellerId)
      .eq('organization_id', appUser.organization_id)
      .eq('role', 'seller')
      .maybeSingle()

    if (sellerError) return NextResponse.json({ error: sellerError.message }, { status: 500 })
    if (!seller) return NextResponse.json({ error: 'Vendedor nao encontrado' }, { status: 404 })

    const { event } = await createEventWithImpacts(
      adminClient,
      {
        organizationId: appUser.organization_id,
        actorUserId: appUser.id,
        targetUserId: sellerId,
        eventType: 'team_nudge.sent',
        sourceModule: 'team',
        entityType: 'user',
        entityId: sellerId,
        title: `Nudge enviado para ${seller.name}`,
        description: message,
        impactScore: type === 'risk' ? 75 : type === 'recognition' ? 55 : 65,
        priorityScore: type === 'risk' || type === 'execution' ? 75 : 55,
        riskScore: type === 'risk' ? 80 : type === 'execution' ? 60 : 20,
        metadata: { type, mode, context },
      },
      [
        { impactedModule: 'notification', impactedEntityType: 'user', impactedEntityId: sellerId, impactType: 'nudge_delivered' },
        { impactedModule: 'mission', impactedEntityType: 'user', impactedEntityId: sellerId, impactType: mode === 'mission' ? 'mission_created_from_nudge' : 'mission_candidate' },
        { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: sellerId, impactType: 'manager_message' },
        { impactedModule: 'team_performance', impactedEntityType: 'user', impactedEntityId: sellerId, impactType: 'manager_intervention_logged' },
      ],
    )

    let mission = null
    if (mode === 'mission') {
      const missionInput = buildMissionForNudge(type, message, context)
      const { data, error } = await adminClient
        .from('ai_missions')
        .insert({
          organization_id: appUser.organization_id,
          user_id: sellerId,
          created_by: appUser.id,
          title: missionInput.title,
          description: missionInput.description,
          area: 'sales_process',
          difficulty: type === 'risk' ? 3 : 2,
          xp_reward: missionInput.xp_reward,
          status: 'pending',
          type: missionInput.type,
          target_value: missionInput.target_value,
          current_value: 0,
          deadline: todayAt18h(),
          verification_type: missionInput.verification_type,
          criteria: missionInput.criteria,
        })
        .select('id,title,status,xp_reward,deadline')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      mission = data
    }

    const { data: notification, error: notificationError } = await adminClient
      .from('notifications')
      .insert({
        organization_id: appUser.organization_id,
        user_id: sellerId,
        sender_id: appUser.id,
        title: type === 'recognition' ? 'Reconhecimento do gestor' : 'Mensagem do gestor',
        message,
        type,
        source: 'team_nudge',
        context: { ...context, mode, nudge_type: type },
        action_href: mode === 'mission' ? '/performance/missoes' : '/hoje',
        related_mission_id: mission?.id ?? null,
        performance_event_id: event.id,
      })
      .select('*')
      .single()

    if (notificationError) return NextResponse.json({ error: notificationError.message }, { status: 500 })

    const recommendation = await createRecommendation(adminClient, {
      organizationId: appUser.organization_id,
      eventId: event.id,
      targetUserId: sellerId,
      createdByUserId: appUser.id,
      sourceModule: 'team',
      recommendationType: mode === 'one_on_one' ? 'one_on_one' : mode === 'mission' ? 'mission' : 'nudge',
      title: mode === 'one_on_one' ? `Pauta 1:1 com ${seller.name}` : notification.title ?? 'Nudge do gestor',
      description: mode === 'one_on_one'
        ? `Use este contexto para uma conversa objetiva: ${message}`
        : message,
      suggestedActionLabel: mode === 'mission' ? 'Ver missao' : mode === 'one_on_one' ? 'Abrir VAMO IA' : 'Abrir Hoje',
      suggestedActionHref: mode === 'mission' ? '/performance/missoes' : mode === 'one_on_one' ? `/chat-ia?prompt=${encodeURIComponent(`Gere uma pauta de 1:1 para ${seller.name}. Contexto: ${message}`)}` : '/hoje',
      priority: type === 'risk' || type === 'execution' || type === 'coaching' ? 'high' : 'medium',
      metadata: { nudgeType: type, mode, context, missionId: mission?.id ?? null, notificationId: notification.id },
    })

    return NextResponse.json({
      ok: true,
      notification,
      event,
      mission,
      recommendation,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/team/nudges', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao enviar nudge' },
      { status: 500 },
    )
  }
}
