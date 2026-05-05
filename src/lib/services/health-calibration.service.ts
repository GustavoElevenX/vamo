import type { SupabaseClient } from '@supabase/supabase-js'
import { createRecommendation } from './action-recommendation.service'
import { createEventWithImpacts } from './performance-os.service'

interface CalibrateInput {
  organizationId: string
  userId: string
  actorUserId: string
  checkinId: string
}

function avg(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function riskFromContext(params: {
  energy: number
  lowEnergyCount: number
  overdueMissions: number
  staleDeals: number
  openDeals: number
}) {
  let score = 0
  if (params.energy <= 2) score += 35
  if (params.lowEnergyCount >= 2) score += 25
  if (params.overdueMissions > 0) score += 15
  if (params.staleDeals > 0) score += 15
  if (params.openDeals > 5 && params.energy <= 2) score += 10

  if (score >= 75) return { score, riskLevel: 'critical' as const, calibrationType: 'support' as const, modifier: 0.45 }
  if (score >= 55) return { score, riskLevel: 'high' as const, calibrationType: 'support' as const, modifier: 0.6 }
  if (score >= 30) return { score, riskLevel: 'medium' as const, calibrationType: 'focus' as const, modifier: 0.85 }
  return { score, riskLevel: 'low' as const, calibrationType: 'sustain' as const, modifier: 1 }
}

export async function calibrateHealthFromCheckin(
  supabase: SupabaseClient,
  input: CalibrateInput,
) {
  const { data: checkin } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('id', input.checkinId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (!checkin) throw new Error('Check-in nao encontrado')

  const since = new Date()
  since.setDate(since.getDate() - 7)
  const today = new Date().toISOString().slice(0, 10)

  const [recentCheckins, missions, deals, managers] = await Promise.all([
    supabase
      .from('daily_checkins')
      .select('*')
      .eq('organization_id', input.organizationId)
      .eq('user_id', input.userId)
      .gte('checkin_date', since.toISOString().slice(0, 10))
      .order('checkin_date', { ascending: false }),
    supabase
      .from('ai_missions')
      .select('*')
      .eq('organization_id', input.organizationId)
      .eq('user_id', input.userId)
      .in('status', ['pending', 'in_progress']),
    supabase
      .from('crm_deals')
      .select('id,title,stage,next_action_due_at,updated_at,ai_priority_score')
      .eq('organization_id', input.organizationId)
      .eq('owner_id', input.userId)
      .not('stage', 'in', '("closed_won","closed_lost")'),
    supabase
      .from('users')
      .select('id')
      .eq('organization_id', input.organizationId)
      .in('role', ['manager', 'admin'])
      .eq('active', true)
      .limit(1),
  ])

  const checkins = recentCheckins.data ?? []
  const energyValues = checkins.map((item: any) => Number(item.energy_level ?? 0)).filter(Boolean)
  const lowEnergyCount = energyValues.filter((value) => value <= 2).length
  const missionRows = missions.data ?? []
  const dealRows = deals.data ?? []
  const overdueMissions = missionRows.filter((mission: any) => {
    const due = mission.criteria?.due_date ?? mission.criteria?.dueAt
    return due && String(due).slice(0, 10) < today
  }).length
  const staleDeals = dealRows.filter((deal: any) => {
    const due = deal.next_action_due_at ? String(deal.next_action_due_at).slice(0, 10) : null
    const updatedAt = deal.updated_at ? new Date(deal.updated_at).getTime() : Date.now()
    const stale = Date.now() - updatedAt > 1000 * 60 * 60 * 24 * 5
    return (due && due < today) || stale
  }).length
  const energy = Number(checkin.energy_level)
  const risk = riskFromContext({
    energy,
    lowEnergyCount,
    overdueMissions,
    staleDeals,
    openDeals: dealRows.length,
  })

  const sellerFocus = risk.riskLevel === 'critical' || risk.riskLevel === 'high'
    ? 'Reduza para poucas acoes controlaveis: uma oportunidade prioritaria, um follow-up claro e uma pausa de replanejamento.'
    : risk.riskLevel === 'medium'
      ? 'Priorize deals com proximo passo claro e evite abrir novas frentes hoje.'
      : 'Mantenha ritmo normal e use energia para antecipar uma acao de alto impacto.'

  const managerAction = risk.riskLevel === 'critical'
    ? 'Fazer 1:1 de apoio hoje, suspender missoes agressivas e remover bloqueio operacional.'
    : risk.riskLevel === 'high'
      ? 'Conversar em tom de apoio, reduzir intensidade e combinar duas entregas possiveis.'
      : risk.riskLevel === 'medium'
        ? 'Ajustar foco do dia e revisar se meta em risco esta aumentando pressao desnecessaria.'
        : 'Reforcar consistencia e manter autonomia.'

  const { data: calibration, error } = await supabase
    .from('health_calibrations')
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      checkin_id: input.checkinId,
      energy_level: energy,
      risk_level: risk.riskLevel,
      calibration_type: risk.calibrationType,
      recommended_manager_action: managerAction,
      seller_focus: sellerFocus,
      mission_intensity_modifier: risk.modifier,
      one_on_one_agenda: [
        'O que esta drenando mais energia hoje?',
        'Qual resultado minimo ainda faz o dia valer?',
        'Qual missao deve ser reduzida, pausada ou trocada?',
        'Que apoio remove um bloqueio concreto nas proximas 24h?',
      ],
      metadata: {
        obstacle: checkin.obstacle,
        intention: checkin.intention,
        avgEnergy7d: avg(energyValues),
        lowEnergyCount,
        overdueMissions,
        staleDeals,
        openDeals: dealRows.length,
        riskScore: risk.score,
      },
    })
    .select('*')
    .single()

  if (error) throw error

  const aggressiveMissions = missionRows
    .filter((mission: any) => Number(mission.difficulty ?? 1) >= 2)
    .slice(0, risk.riskLevel === 'critical' || risk.riskLevel === 'high' ? 5 : 2)

  if (risk.modifier < 1 && aggressiveMissions.length) {
    for (const mission of aggressiveMissions) {
      await supabase
        .from('ai_missions')
        .update({
          difficulty: Math.max(1, Number(mission.difficulty ?? 1) - 1),
          xp_reward: Math.max(20, Math.round(Number(mission.xp_reward ?? 50) * Number(risk.modifier))),
          playbook_content: {
            ...(mission.playbook_content ?? {}),
            health_adjustment: {
              calibrationId: calibration.id,
              reason: 'Energia baixa ou pressao operacional detectada no check-in.',
              originalDifficulty: mission.difficulty,
              originalXp: mission.xp_reward,
              recommendedFocus: sellerFocus,
            },
          },
        })
        .eq('id', mission.id)
    }
  }

  const { event } = await createEventWithImpacts(
    supabase,
    {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      targetUserId: input.userId,
      eventType: risk.riskLevel === 'critical' || risk.riskLevel === 'high' ? 'health.risk_detected' : 'health.calibrated',
      sourceModule: 'health',
      entityType: 'health_calibration',
      entityId: calibration.id,
      title: risk.riskLevel === 'critical' || risk.riskLevel === 'high'
        ? 'Saude exigiu reducao de intensidade'
        : 'Saude calibrada para foco do dia',
      description: sellerFocus,
      impactScore: 50,
      priorityScore: risk.riskLevel === 'critical' ? 95 : risk.riskLevel === 'high' ? 85 : 50,
      riskScore: risk.score,
      metadata: calibration.metadata,
    },
    [
      { impactedModule: 'health', impactedEntityType: 'health_calibration', impactedEntityId: calibration.id, impactType: 'calibration_created' },
      { impactedModule: 'mission', impactedEntityType: 'user', impactedEntityId: input.userId, impactType: 'intensity_calibrated', impactValue: risk.modifier },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: input.userId, impactType: 'seller_focus_adjusted' },
      { impactedModule: 'hoje_gestor', impactedEntityType: 'user', impactedEntityId: input.userId, impactType: 'manager_attention' },
      { impactedModule: 'ai', impactedEntityType: 'health_calibration', impactedEntityId: calibration.id, impactType: 'nudge_adjusted' },
    ],
  )

  const managerId = managers.data?.[0]?.id ?? null
  await createRecommendation(supabase, {
    organizationId: input.organizationId,
    eventId: event.id,
    targetUserId: managerId ?? input.userId,
    createdByUserId: input.actorUserId,
    sourceModule: 'health',
    recommendationType: risk.riskLevel === 'low' ? 'health_focus' : 'health_1on1',
    title: risk.riskLevel === 'critical' || risk.riskLevel === 'high'
      ? 'Recalibrar missoes e fazer 1:1'
      : 'Ajustar foco do dia pela energia',
    description: managerAction,
    suggestedActionLabel: managerId ? 'Ver Hoje Gestor' : 'Ver foco de hoje',
    suggestedActionHref: managerId ? '/hoje-gestor' : '/hoje',
    priority: risk.riskLevel === 'critical' || risk.riskLevel === 'high' ? 'high' : 'medium',
    metadata: {
      calibrationId: calibration.id,
      riskLevel: risk.riskLevel,
      missionIntensityModifier: risk.modifier,
      adjustedMissionIds: aggressiveMissions.map((mission: any) => mission.id),
    },
  })

  if (risk.modifier < 1) {
    await createRecommendation(supabase, {
      organizationId: input.organizationId,
      eventId: event.id,
      targetUserId: input.userId,
      createdByUserId: input.actorUserId,
      sourceModule: 'health',
      recommendationType: 'today_focus',
      title: 'Foco reduzido para hoje',
      description: sellerFocus,
      suggestedActionLabel: 'Abrir Hoje',
      suggestedActionHref: '/hoje',
      priority: 'high',
      metadata: { calibrationId: calibration.id, missionIntensityModifier: risk.modifier },
    })
  }

  return {
    calibration,
    event,
    adjustedMissions: aggressiveMissions,
  }
}
