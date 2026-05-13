import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calibrateHealthFromCheckin } from '@/lib/services/health-calibration.service'
import { generateCheckinQuestions, type CheckinQuestionContext } from '@/lib/services/checkin-question.service'

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function dailyTarget(kpi: any) {
  return num(kpi?.target_daily ?? kpi?.targets?.daily, 0)
}

function isOverdue(date: string | null | undefined) {
  return !!date && new Date(date).getTime() < Date.now()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, name, organization_id')
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

  if (checkin) {
    return NextResponse.json({
      checkin,
      shouldShow: false,
      questions: [],
      contextSummary: { reason: 'already_answered_today' },
    })
  }

  const startOfDay = `${today}T00:00:00`
  const endOfDay = `${today}T23:59:59`

  const results = await Promise.allSettled([
    adminClient
      .from('kpi_definitions')
      .select('id, name, unit, targets, target_daily, period')
      .eq('organization_id', appUser.organization_id)
      .eq('active', true)
      .or('period.eq.daily,target_daily.gt.0')
      .order('target_daily', { ascending: false })
      .limit(3),
    adminClient
      .from('kpi_entries')
      .select('value, kpi_id')
      .eq('user_id', appUser.id)
      .gte('recorded_at', startOfDay)
      .lte('recorded_at', endOfDay),
    adminClient
      .from('crm_deals')
      .select('id, title, value, stage, next_action_title, next_action_due_at, next_action_status, ai_priority_score')
      .eq('organization_id', appUser.organization_id)
      .eq('owner_id', appUser.id)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('ai_priority_score', { ascending: false })
      .limit(10),
    adminClient
      .from('ai_missions')
      .select('id, title, description')
      .eq('organization_id', appUser.organization_id)
      .eq('user_id', appUser.id)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(3),
    adminClient
      .from('pdi_gaps')
      .select('id, skill_area, severity')
      .eq('organization_id', appUser.organization_id)
      .eq('user_id', appUser.id)
      .in('status', ['open', 'in_training', 'in_pdi', 'improving'])
      .order('created_at', { ascending: false })
      .limit(3),
    adminClient
      .from('daily_checkins')
      .select('energy_level, intention, obstacle, checkin_date')
      .eq('user_id', appUser.id)
      .lt('checkin_date', today)
      .order('checkin_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('notifications')
      .select('id, title, message')
      .eq('user_id', appUser.id)
      .eq('source', 'team_nudge')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const dailyKpiDefs = results[0].status === 'fulfilled' ? results[0].value.data ?? [] : []
  const todayEntries = results[1].status === 'fulfilled' ? results[1].value.data ?? [] : []
  const deals = results[2].status === 'fulfilled' ? results[2].value.data ?? [] : []
  const missions = results[3].status === 'fulfilled' ? results[3].value.data ?? [] : []
  const pdiGaps = results[4].status === 'fulfilled' ? results[4].value.data ?? [] : []
  const lastCheckin = results[5].status === 'fulfilled' ? results[5].value.data ?? null : null
  const managerNudges = results[6].status === 'fulfilled' ? results[6].value.data ?? [] : []

  const selectedDailyKpi = dailyKpiDefs.find((kpi: any) => dailyTarget(kpi) > 0) ?? null
  const dailyKpi = selectedDailyKpi
    ? {
        id: selectedDailyKpi.id,
        name: selectedDailyKpi.name,
        current: todayEntries
          .filter((entry: { kpi_id: string }) => entry.kpi_id === selectedDailyKpi.id)
          .reduce((sum: number, entry: { value?: number }) => sum + num(entry.value, 0), 0),
        target: dailyTarget(selectedDailyKpi),
        unit: selectedDailyKpi.unit,
      }
    : null

  const overdueDeals = deals
    .filter((deal: any) => deal.next_action_status === 'open' && isOverdue(deal.next_action_due_at))
    .map((deal: any) => ({
      id: deal.id,
      title: deal.title,
      value: num(deal.value, 0),
      next_action_title: deal.next_action_title ?? null,
    }))

  const noActionDeals = deals
    .filter((deal: any) => !deal.next_action_title || deal.next_action_status !== 'open')
    .map((deal: any) => ({
      id: deal.id,
      title: deal.title,
      value: num(deal.value, 0),
    }))

  const context: CheckinQuestionContext = {
    seller: {
      id: appUser.id,
      name: appUser.name,
    },
    dailyKpi,
    overdueDeals,
    noActionDeals,
    missions: missions.map((mission: any) => ({
      id: mission.id,
      title: mission.title,
      description: mission.description ?? null,
    })),
    pdiGaps: pdiGaps.map((gap: any) => ({
      id: gap.id,
      skill_area: gap.skill_area,
      severity: gap.severity ?? null,
    })),
    lastCheckin: lastCheckin
      ? {
          energy_level: num(lastCheckin.energy_level, 0),
          intention: lastCheckin.intention ?? null,
          obstacle: lastCheckin.obstacle ?? null,
          checkin_date: lastCheckin.checkin_date,
        }
      : null,
    managerNudges: managerNudges.map((nudge: any) => ({
      id: nudge.id,
      title: nudge.title ?? null,
      message: nudge.message,
    })),
  }

  const { questions, source } = await generateCheckinQuestions(context)

  return NextResponse.json({
    checkin: null,
    shouldShow: questions.length > 0,
    questions,
    contextSummary: {
      source,
      dailyKpi: dailyKpi ? dailyKpi.name : null,
      overdueDeals: overdueDeals.length,
      noActionDeals: noActionDeals.length,
      missions: context.missions.length,
      pdiGaps: context.pdiGaps.length,
      managerNudges: context.managerNudges?.length ?? 0,
    },
  })
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
  const { energy_level, intention, obstacle, answers, question_set } = body
  const energy = num(energy_level, 0)

  if (!energy || energy < 1 || energy > 5) {
    return NextResponse.json({ error: 'energy_level deve ser entre 1 e 5' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: checkin, error } = await adminClient
    .from('daily_checkins')
    .upsert(
      {
        user_id: appUser.id,
        organization_id: appUser.organization_id,
        energy_level: energy,
        intention: intention || null,
        obstacle: obstacle || null,
        answers: answers ?? {},
        question_set: question_set ?? [],
        answered_at: new Date().toISOString(),
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

  try {
    const calibrationResult = await calibrateHealthFromCheckin(adminClient, {
      organizationId: appUser.organization_id,
      userId: appUser.id,
      actorUserId: appUser.id,
      checkinId: checkin.id,
    })

    return NextResponse.json({ checkin, ...calibrationResult })
  } catch (calibrationError) {
    console.error('Health calibration error:', calibrationError)
    return NextResponse.json({ checkin, calibration: null })
  }
}
