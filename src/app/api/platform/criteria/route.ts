import { NextRequest, NextResponse } from 'next/server'
import { getAppUser, requireRole } from '@/lib/server/auth'

export const runtime = 'nodejs'

const MAX_KPIS = 5

const defaultCriteria = {
  evaluationMode: 'mixed',
  alerts: [
    { id: 'crm_inactivity', label: 'dias sem atividade no CRM', enabled: true, value: '3', unit: 'dias' },
    { id: 'conversion_drop', label: 'queda de conversao em janela movel', enabled: true, value: '20', value2: '14', unit: '%', unit2: 'dias' },
    { id: 'mission_expiring', label: 'aviso antes do vencimento de missao', enabled: true, value: '2', unit: 'dias' },
    { id: 'low_wellbeing', label: 'bem-estar abaixo do limite', enabled: true, value: '2', unit: '/5' },
  ],
  wellbeing: {
    pulseFrequency: 'semanal',
    criticalIndex: '2',
    absenceDays: '5',
  },
}

const defaultGamification = {
  ranking_publico: true,
  badges_no_feed: true,
  level_titles: ['Recruta', 'Prospector', 'Negociador', 'Hunter', 'Closer', 'Elite', 'Campeao', 'Lenda'],
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')

  return `${base || 'kpi'}_${Date.now()}`
}

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth

  const [kpisResult, commissionResult, orgResult] = await Promise.all([
    adminClient
      .from('kpi_definitions')
      .select('*')
      .eq('organization_id', appUser.organization_id)
      .eq('active', true)
      .order('created_at'),
    adminClient
      .from('commission_configs')
      .select('*')
      .eq('organization_id', appUser.organization_id)
      .maybeSingle(),
    adminClient
      .from('organizations')
      .select('settings')
      .eq('id', appUser.organization_id)
      .single(),
  ])

  if (kpisResult.error) return NextResponse.json({ error: kpisResult.error.message }, { status: 500 })
  if (commissionResult.error) return NextResponse.json({ error: commissionResult.error.message }, { status: 500 })
  if (orgResult.error) return NextResponse.json({ error: orgResult.error.message }, { status: 500 })

  const settings = (orgResult.data?.settings ?? {}) as Record<string, any>

  const kpis = (kpisResult.data ?? []).map((kpi: any) => ({
    id: kpi.id,
    name: kpi.name,
    unit: kpi.unit,
    source: kpi.targets?.source ?? 'manual',
    target: String(kpi.targets?.monthly ?? ''),
    alertTolerance: String(kpi.targets?.alert_tolerance ?? 10),
    pointsPerUnit: String(kpi.points_per_unit ?? 1),
  }))

  return NextResponse.json({
    kpis,
    commission: commissionResult.data ?? {
      aliquota_base: 4,
      acelerador_threshold: 110,
      acelerador_rate: 6,
      bonus_missao: 75,
      bonus_kpi: 0,
      salario_base: 2500,
      periodo: 'mensal',
      elegibilidade: 80,
    },
    criteria: {
      ...defaultCriteria,
      ...(settings.criteria ?? {}),
      wellbeing: {
        ...defaultCriteria.wellbeing,
        ...(settings.criteria?.wellbeing ?? {}),
      },
    },
    gamification: {
      ...defaultGamification,
      ...(settings.gamification ?? {}),
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth
  const forbidden = requireRole(appUser.role, ['admin', 'manager'])
  if (forbidden) return forbidden

  const input = await req.json()
  const kpis = Array.isArray(input.kpis) ? input.kpis.slice(0, MAX_KPIS) : []
  const removedKpiIds = Array.isArray(input.removedKpiIds) ? input.removedKpiIds : []

  for (const id of removedKpiIds) {
    await adminClient
      .from('kpi_definitions')
      .update({ active: false })
      .eq('id', id)
      .eq('organization_id', appUser.organization_id)
  }

  for (const kpi of kpis) {
    const name = String(kpi.name ?? '').trim()
    const target = Number(kpi.target ?? 0)
    if (!name || target <= 0) continue

    const payload = {
      organization_id: appUser.organization_id,
      name,
      unit: String(kpi.unit ?? 'unid.').trim() || 'unid.',
      points_per_unit: Number(kpi.pointsPerUnit ?? 1) || 1,
      targets: {
        monthly: target,
        alert_tolerance: Number(kpi.alertTolerance ?? 10) || 10,
        source: kpi.source === 'CRM' ? 'CRM' : 'manual',
      },
      active: true,
    }

    if (kpi.id) {
      await adminClient
        .from('kpi_definitions')
        .update(payload)
        .eq('id', kpi.id)
        .eq('organization_id', appUser.organization_id)
    } else {
      await adminClient
        .from('kpi_definitions')
        .insert({ ...payload, slug: slugify(name) })
    }
  }

  if (input.commission) {
    const commission = input.commission
    const { error: commissionError } = await adminClient
      .from('commission_configs')
      .upsert({
        organization_id: appUser.organization_id,
        aliquota_base: Number(commission.aliquota_base ?? 4),
        acelerador_threshold: Number(commission.acelerador_threshold ?? 110),
        acelerador_rate: Number(commission.acelerador_rate ?? 6),
        bonus_missao: Number(commission.bonus_missao ?? 75),
        bonus_kpi: Number(commission.bonus_kpi ?? 0),
        salario_base: Number(commission.salario_base ?? 2500),
        periodo: ['mensal', 'quinzenal', 'semanal'].includes(commission.periodo) ? commission.periodo : 'mensal',
        elegibilidade: Number(commission.elegibilidade ?? 80),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' })

    if (commissionError) return NextResponse.json({ error: commissionError.message }, { status: 500 })
  }

  const { data: org } = await adminClient
    .from('organizations')
    .select('settings')
    .eq('id', appUser.organization_id)
    .single()

  const currentSettings = (org?.settings ?? {}) as Record<string, unknown>
  const settings = {
    ...currentSettings,
    criteria: {
      ...defaultCriteria,
      ...(input.criteria ?? {}),
      wellbeing: {
        ...defaultCriteria.wellbeing,
        ...(input.criteria?.wellbeing ?? {}),
      },
    },
    gamification: {
      ...defaultGamification,
      ...(input.gamification ?? {}),
    },
  }

  const { error: settingsError } = await adminClient
    .from('organizations')
    .update({ settings })
    .eq('id', appUser.organization_id)

  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

  await adminClient.from('system_logs').insert({
    organization_id: appUser.organization_id,
    level: 'info',
    source: 'criteria',
    message: 'Criterios comerciais, gamificacao e comissionamento atualizados',
    metadata: { user_id: appUser.id, kpis: kpis.length },
  })

  return NextResponse.json({ ok: true })
}
