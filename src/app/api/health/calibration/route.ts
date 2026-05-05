import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'
import { createEventWithImpacts } from '@/lib/services/performance-os.service'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { generateHealthCalibration } from '@/lib/services/contextual-ai.service'

export const runtime = 'nodejs'

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export async function GET(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const userId = new URL(request.url).searchParams.get('userId')
  let query = adminClient
    .from('health_calibrations')
    .select('*, user:users(id,name)')
    .eq('organization_id', appUser.organization_id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (appUser.role === 'seller') query = query.eq('user_id', appUser.id)
  else if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ calibrations: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await getAppUser()
  if (auth.error) return auth.error
  const { adminClient, appUser } = auth
  const body = await request.json() as Record<string, unknown>
  const checkinId = asString(body.checkinId)
  if (!checkinId) return NextResponse.json({ error: 'checkinId obrigatorio' }, { status: 400 })

  const { data: checkin } = await adminClient
    .from('daily_checkins')
    .select('*')
    .eq('id', checkinId)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()

  if (!checkin) return NextResponse.json({ error: 'Check-in nao encontrado' }, { status: 404 })
  if (appUser.role === 'seller' && checkin.user_id !== appUser.id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const energy = Number(checkin.energy_level)
  const riskLevel = energy <= 2 ? 'high' : energy === 3 ? 'medium' : 'low'
  const calibrationType = energy <= 2 ? 'support' : energy === 3 ? 'focus' : 'sprint'
  const sellerFocus = energy <= 2
    ? 'Escolha duas acoes controlaveis e evite acumular pressao.'
    : energy === 3
      ? 'Priorize deals provaveis e um proximo passo claro.'
      : 'Use a energia para acelerar uma oportunidade critica.'

  const { data: calibration, error } = await adminClient
    .from('health_calibrations')
    .insert({
      organization_id: appUser.organization_id,
      user_id: checkin.user_id,
      checkin_id: checkinId,
      energy_level: energy,
      risk_level: riskLevel,
      calibration_type: calibrationType,
      recommended_manager_action: energy <= 2
        ? 'Conversa de apoio, tom humano e reducao de agressividade da missao.'
        : 'Alinhar foco do dia e remover bloqueios.',
      seller_focus: sellerFocus,
      mission_intensity_modifier: energy <= 2 ? 0.6 : energy === 3 ? 0.85 : 1.15,
      one_on_one_agenda: [
        'Como esta sua energia hoje?',
        'Qual acao controlavel destrava resultado?',
        'Que apoio voce precisa do gestor?',
      ],
      metadata: { obstacle: checkin.obstacle, intention: checkin.intention },
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { event } = await createEventWithImpacts(
    adminClient,
    {
      organizationId: appUser.organization_id,
      actorUserId: checkin.user_id,
      targetUserId: checkin.user_id,
      eventType: riskLevel === 'high' ? 'health.risk_detected' : 'checkin.created',
      sourceModule: 'health',
      entityType: 'health_calibration',
      entityId: calibration.id,
      title: riskLevel === 'high' ? 'Energia baixa recorrente ou critica' : 'Check-in calibrado',
      description: sellerFocus,
      impactScore: 45,
      priorityScore: riskLevel === 'high' ? 90 : 45,
      riskScore: riskLevel === 'high' ? 80 : 25,
      metadata: { checkinId, energy, riskLevel },
    },
    [
      { impactedModule: 'health', impactedEntityType: 'health_calibration', impactedEntityId: calibration.id, impactType: 'calibration_created' },
      { impactedModule: 'mission', impactedEntityType: 'user', impactedEntityId: checkin.user_id, impactType: 'intensity_calibrated', impactValue: energy <= 2 ? 0.6 : 1 },
      { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: checkin.user_id, impactType: 'seller_focus_adjusted' },
      { impactedModule: 'hoje_gestor', impactedEntityType: 'user', impactedEntityId: checkin.user_id, impactType: 'manager_attention' },
    ],
  )

  if (riskLevel === 'high') {
    await createRecommendation(adminClient, {
      organizationId: appUser.organization_id,
      eventId: event.id,
      targetUserId: appUser.role === 'manager' ? appUser.id : null,
      createdByUserId: checkin.user_id,
      sourceModule: 'health',
      recommendationType: 'health_1on1',
      title: 'Conversa de apoio recomendada',
      description: 'Energia baixa pede foco em acoes controlaveis e apoio humano, nao punicao por produtividade.',
      suggestedActionLabel: 'Abrir saude da equipe',
      suggestedActionHref: '/monitoramento/saude-equipe',
      priority: 'high',
      metadata: { calibrationId: calibration.id, checkinId },
    })
  }

  const ai = await generateHealthCalibration(adminClient, checkinId)
  return NextResponse.json({ calibration, event, ai }, { status: 201 })
}
