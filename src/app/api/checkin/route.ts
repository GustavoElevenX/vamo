import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { createEventWithImpacts } from '@/lib/services/performance-os.service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: checkin } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('user_id', appUser.id)
    .eq('checkin_date', today)
    .maybeSingle()

  return NextResponse.json({ checkin })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const { energy_level, intention, obstacle } = body

  if (!energy_level || energy_level < 1 || energy_level > 5) {
    return NextResponse.json({ error: 'energy_level deve ser entre 1 e 5' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: checkin, error } = await adminClient
    .from('daily_checkins')
    .upsert(
      {
        user_id: appUser.id,
        organization_id: appUser.organization_id,
        energy_level,
        intention: intention || null,
        obstacle: obstacle || null,
        checkin_date: today,
      },
      { onConflict: 'user_id,checkin_date' }
    )
    .select()
    .single()

  if (error) {
    console.error('Checkin save error:', error)
    return NextResponse.json({ error: 'Erro ao salvar check-in' }, { status: 500 })
  }

  const energy = Number(energy_level)
  const isLowEnergy = energy <= 2
  const { event } = await createEventWithImpacts(
    adminClient,
    {
      organizationId: appUser.organization_id,
      actorUserId: appUser.id,
      targetUserId: appUser.id,
      eventType: isLowEnergy ? 'health.risk_detected' : 'checkin.created',
      sourceModule: 'health',
      entityType: 'daily_checkin',
      entityId: checkin.id,
      title: isLowEnergy ? 'Check-in com energia baixa' : 'Check-in diario registrado',
      description: isLowEnergy
        ? 'Saude deve calibrar missao, nudge e postura do gestor.'
        : 'Check-in alimenta prioridades do dia e calibragem de rotina.',
      impactScore: 35,
      priorityScore: isLowEnergy ? 85 : 35,
      riskScore: isLowEnergy ? 80 : 15,
      metadata: { energy_level: energy, intention, obstacle },
    },
    [
      { impactedModule: 'health', impactedEntityType: 'daily_checkin', impactedEntityId: checkin.id, impactType: 'checkin_recorded' },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: appUser.id, impactType: 'seller_focus_calibrated' },
      { impactedModule: 'mission', impactedEntityType: 'user', impactedEntityId: appUser.id, impactType: isLowEnergy ? 'reduce_intensity' : 'maintain_intensity' },
      { impactedModule: 'ai', impactedEntityType: 'daily_checkin', impactedEntityId: checkin.id, impactType: 'health_calibration_context' },
      { impactedModule: 'hoje_gestor', impactedEntityType: 'user', impactedEntityId: appUser.id, impactType: isLowEnergy ? 'human_attention' : 'health_signal' },
    ],
  )

  let calibration = null
  if (isLowEnergy) {
    const { data } = await adminClient
      .from('health_calibrations')
      .insert({
        organization_id: appUser.organization_id,
        user_id: appUser.id,
        checkin_id: checkin.id,
        energy_level: energy,
        risk_level: 'high',
        calibration_type: 'support',
        recommended_manager_action: 'Conversa de apoio, foco em poucas acoes controlaveis e tom nao punitivo.',
        seller_focus: 'Escolha duas acoes controlaveis para hoje e peca apoio se houver bloqueio.',
        mission_intensity_modifier: 0.6,
        one_on_one_agenda: [
          'Como esta sua energia hoje?',
          'Qual pequena acao voce consegue concluir com seguranca?',
          'Que apoio do gestor removeria atrito agora?',
        ],
        metadata: { eventId: event.id, obstacle, intention },
      })
      .select('*')
      .single()

    calibration = data
    const { data: manager } = await adminClient
      .from('users')
      .select('id')
      .eq('organization_id', appUser.organization_id)
      .in('role', ['manager', 'admin'])
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    await createRecommendation(adminClient, {
      organizationId: appUser.organization_id,
      eventId: event.id,
      targetUserId: manager?.id ?? appUser.id,
      createdByUserId: appUser.id,
      sourceModule: 'health',
      recommendationType: 'health_1on1',
      title: 'Foco leve e controlavel hoje',
      description: 'Energia baixa recorrente deve reduzir a intensidade da missao e priorizar apoio humano.',
      suggestedActionLabel: 'Ver foco de hoje',
      suggestedActionHref: '/hoje',
      priority: 'high',
      metadata: { calibrationId: data?.id ?? null },
    })
  }

  return NextResponse.json({ checkin, event, calibration })
}
