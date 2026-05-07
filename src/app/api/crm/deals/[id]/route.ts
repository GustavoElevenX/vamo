import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { createEventWithImpacts } from '@/lib/services/performance-os.service'
import { registerExecutionEvent, type ExecutionEventType } from '@/lib/services/execution.service'
import { detectGap } from '@/lib/services/pdi.service'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { DealStage } from '@/types/crm'

export const runtime = 'nodejs'

const STAGES: DealStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const NEXT_ACTION_TYPES = ['follow_up', 'call', 'email', 'proposal', 'meeting', 'review', 'other']
const NEXT_ACTION_STATUSES = ['open', 'done', 'snoozed']
const FORECAST_CATEGORIES = ['pipeline', 'best_case', 'commit', 'closed']

type Params = { params: Promise<{ id: string }> }

function parseMoney(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const normalized = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

async function loadDeal(adminClient: ReturnType<typeof createAdminClient>, orgId: string, userId: string, role: string, id: string) {
  let query = adminClient
    .from('crm_deals')
    .select('*, account:crm_accounts(id,name,segment,website), owner:users!crm_deals_owner_id_fkey(id,name,avatar_url), activities:crm_activities(*, user:users(id,name))')
    .eq('id', id)
    .eq('organization_id', orgId)

  if (role === 'seller') query = query.eq('owner_id', userId)
  return query.single()
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { data, error } = await loadDeal(auth.adminClient, auth.appUser.organization_id, auth.appUser.id, auth.appUser.role, id)
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ deal: data })
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const input = await request.json()

  const { data: previousDeal } = await adminClient
    .from('crm_deals')
    .select('id,title,account_id,owner_id,stage,value,probability,next_action_title,next_action_due_at,next_action_status,forecast_category')
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()

  if (!previousDeal || (appUser.role === 'seller' && previousDeal.owner_id !== appUser.id)) {
    return NextResponse.json({ error: 'Deal nao encontrado' }, { status: 404 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['title', 'account_id', 'expected_close', 'lost_reason', 'notes'] as const) {
    if (key in input) patch[key] = input[key] || null
  }
  for (const key of ['product_id', 'product_name', 'category_id', 'category_name', 'commercial_table_id', 'commercial_table_name', 'received_at'] as const) {
    if (key in input) patch[key] = input[key] || null
  }
  for (const key of ['next_action_title', 'next_action_due_at'] as const) {
    if (key in input) patch[key] = input[key] || null
  }
  if ('value' in input) patch.value = parseMoney(input.value)
  if ('received_amount' in input) patch.received_amount = parseMoney(input.received_amount)
  if ('probability' in input) patch.probability = Number(input.probability || 0)
  if (STAGES.includes(input.stage)) patch.stage = input.stage
  if (NEXT_ACTION_TYPES.includes(input.next_action_type)) patch.next_action_type = input.next_action_type
  if (NEXT_ACTION_STATUSES.includes(input.next_action_status)) {
    patch.next_action_status = input.next_action_status
    if (input.next_action_status === 'done') patch.last_activity_at = new Date().toISOString()
  }
  if (FORECAST_CATEGORIES.includes(input.forecast_category)) patch.forecast_category = input.forecast_category
  if ('ai_priority_score' in input) {
    const score = Number(input.ai_priority_score || 0)
    patch.ai_priority_score = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
  }
  if (input.owner_id && appUser.role !== 'seller') patch.owner_id = input.owner_id

  if (patch.stage === 'closed_won' && !(patch.account_id || previousDeal.account_id)) {
    return NextResponse.json(
      {
        error: 'Antes de marcar como ganho, vincule essa oportunidade a um cliente/conta.',
        code: 'ACCOUNT_REQUIRED',
      },
      { status: 400 },
    )
  }

  let query = adminClient
    .from('crm_deals')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)

  if (appUser.role === 'seller') query = query.eq('owner_id', appUser.id)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stageChanged = typeof patch.stage === 'string' && patch.stage !== previousDeal.stage
  const nextActionCreated = typeof patch.next_action_title === 'string' && patch.next_action_title.trim() && patch.next_action_title !== previousDeal.next_action_title
  const overdueActionResolved = patch.next_action_status === 'done' && previousDeal.next_action_status === 'open' && previousDeal.next_action_due_at && new Date(previousDeal.next_action_due_at).getTime() < Date.now()
  if (stageChanged) {
    const nextValue = 'value' in patch ? Number(patch.value || 0) : Number(previousDeal.value || 0)
    const nextProbability = 'probability' in patch ? Number(patch.probability || 0) : Number(previousDeal.probability || 0)
    const forecastImpact = nextValue * nextProbability / 100
    const isWon = patch.stage === 'closed_won'
    const isLost = patch.stage === 'closed_lost'

    const { event } = await createEventWithImpacts(
      adminClient,
      {
        organizationId: appUser.organization_id,
        actorUserId: appUser.id,
        targetUserId: previousDeal.owner_id,
        eventType: 'crm_deal.stage_changed',
        sourceModule: 'crm',
        entityType: 'crm_deal',
        entityId: id,
        title: `Deal movido: ${previousDeal.title}`,
        description: `${previousDeal.stage} -> ${patch.stage}`,
        impactScore: isWon ? 90 : isLost ? 40 : 65,
        priorityScore: isLost ? 70 : 60,
        riskScore: isLost ? 90 : 30,
        metadata: {
          fromStage: previousDeal.stage,
          toStage: patch.stage,
          value: nextValue,
          probability: nextProbability,
          forecastImpact,
        },
      },
      [
        { impactedModule: 'crm', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: 'stage_changed' },
        { impactedModule: 'forecast', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: 'forecast_recalculated', impactValue: forecastImpact },
        { impactedModule: 'commission', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: 'commission_projection_recalculated', impactValue: forecastImpact },
        { impactedModule: 'mission', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: isWon ? 'completion_candidate' : 'progress_candidate' },
        { impactedModule: 'xp', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: isWon ? 'win_evidence' : 'stage_progress_evidence' },
        { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: previousDeal.owner_id, impactType: 'seller_priority_updated' },
        { impactedModule: 'hoje_gestor', impactedEntityType: 'crm_deal', impactedEntityId: id, impactType: isLost ? 'loss_review' : 'pipeline_update' },
      ],
    )

    await createRecommendation(adminClient, {
      organizationId: appUser.organization_id,
      eventId: event.id,
      targetUserId: previousDeal.owner_id,
      createdByUserId: appUser.id,
      sourceModule: 'crm',
      recommendationType: isLost ? 'pdi_plan' : isWon ? 'recognition' : 'next_action',
      title: isLost
        ? 'Revisar perda e detectar gap recorrente'
        : isWon
          ? 'Registrar recebimento e reconhecer comportamento'
          : 'Definir proxima acao da nova etapa',
      description: isLost
        ? 'Use a perda como evidencia para PDI se houver padrao recorrente.'
        : isWon
          ? 'Fechamento precisa conectar com comissao, feed e reconhecimento.'
          : 'A mudanca de etapa precisa virar proximo passo, forecast e ganho previsto.',
      suggestedActionLabel: 'Abrir deal',
      suggestedActionHref: `/crm/${id}`,
      priority: isLost ? 'high' : 'medium',
      metadata: { dealId: id, eventType: 'crm_deal.stage_changed' },
    })

    if (isLost) {
      const lostReason = String(input.lost_reason ?? patch.lost_reason ?? 'perda_sem_motivo')
      const skillArea = lostReason.toLowerCase().includes('valor')
        ? 'construcao_de_valor'
        : lostReason.toLowerCase().includes('pre')
          ? 'objecoes'
          : lostReason.toLowerCase().includes('concorrente')
            ? 'negociacao'
            : 'fechamento'

      await detectGap(adminClient, {
        organizationId: appUser.organization_id,
        actorUserId: appUser.id,
        targetUserId: previousDeal.owner_id,
        skillArea,
        title: `Perda comercial: ${lostReason}`,
        description: 'Esse deal perdido pode indicar um padrao de desenvolvimento se a causa se repetir.',
        detectedFrom: 'lost_deal',
        sourceEntityType: 'crm_deal',
        sourceEntityId: id,
        severity: nextValue >= 10000 ? 'high' : 'medium',
        confidenceScore: 0.7,
        impactValue: nextValue,
        evidence: {
          dealId: id,
          title: previousDeal.title,
          lostReason,
          value: nextValue,
          recommendation: 'Criar gap, gerar PDI ou abrir treinamento recomendado se o padrao se repetir.',
        },
      })
    }

    const executionType: ExecutionEventType = isWon ? 'crm_deal_won' : isLost ? 'crm_deal_lost' : 'crm_deal_updated'
    await registerExecutionEvent(adminClient, {
      organizationId: appUser.organization_id,
      userId: previousDeal.owner_id,
      actorUserId: appUser.id,
      type: executionType,
      value: isWon ? nextValue : 1,
      source: 'crm',
      sourceEntityType: 'crm_deal',
      sourceEntityId: id,
      metadata: {
        dealId: id,
        title: previousDeal.title,
        fromStage: previousDeal.stage,
        toStage: patch.stage,
        revenue: nextValue,
        value: nextValue,
        probability: nextProbability,
        forecastImpact,
        description: `${previousDeal.title}: ${previousDeal.stage} -> ${patch.stage}`,
      },
    })
  }

  if (nextActionCreated || overdueActionResolved) {
    await registerExecutionEvent(adminClient, {
      organizationId: appUser.organization_id,
      userId: previousDeal.owner_id,
      actorUserId: appUser.id,
      type: overdueActionResolved ? 'pipeline_overdue_action_resolved' : 'pipeline_next_action_created',
      value: 1,
      source: 'crm',
      sourceEntityType: 'crm_deal',
      sourceEntityId: id,
      metadata: {
        dealId: id,
        title: previousDeal.title,
        nextActionTitle: patch.next_action_title ?? previousDeal.next_action_title,
        nextActionDueAt: patch.next_action_due_at ?? previousDeal.next_action_due_at,
        value: 'value' in patch ? Number(patch.value || 0) : Number(previousDeal.value || 0),
        description: overdueActionResolved
          ? `Pendencia atrasada resolvida em ${previousDeal.title}`
          : `Proxima acao criada em ${previousDeal.title}`,
      },
    })
  }

  return NextResponse.json({
    ok: true,
    feedback: stageChanged
      ? {
          forecastImpact: ('value' in patch ? Number(patch.value || 0) : Number(previousDeal.value || 0)) * ('probability' in patch ? Number(patch.probability || 0) : Number(previousDeal.probability || 0)) / 100,
          nextBestAction: 'Revise proxima acao, forecast e comissao prevista para esta etapa.',
        }
      : null,
  })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  if (!['manager', 'admin'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Apenas gestor pode excluir deals' }, { status: 403 })
  }

  const { error } = await adminClient
    .from('crm_deals')
    .delete()
    .eq('id', id)
    .eq('organization_id', appUser.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
