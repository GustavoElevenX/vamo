import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

const MAX_KPIS = 12
const SOURCES = ['manual', 'crm', 'CRM', 'pdi', 'commission', 'system']
const PERIODS = ['daily', 'weekly', 'monthly']
const CALCULATION_TYPES = ['sum', 'count', 'average', 'max', 'min']

function makeSlug(name: string) {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  return `${normalized || 'kpi'}_${Date.now()}`
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sourceValue(value: unknown) {
  const source = String(value || 'manual')
  if (source === 'CRM') return 'crm'
  return SOURCES.includes(source) ? source : 'manual'
}

function mapKpi(row: any, current: number) {
  const targets = row.targets ?? {}
  const targetDaily = num(row.target_daily ?? targets.daily, 0)
  const targetWeekly = num(row.target_weekly ?? targets.weekly, 0)
  const targetMonthly = num(row.target_monthly ?? targets.monthly, 0)
  const source = sourceValue(row.source ?? targets.source)
  const sourceEvent = row.source_event ?? targets.source_event ?? null

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    source,
    sourceEvent,
    period: row.period ?? 'monthly',
    targetDaily,
    targetWeekly,
    targetMonthly,
    target: targetMonthly || targetWeekly || targetDaily,
    current,
    unit: row.unit,
    calculationType: row.calculation_type ?? 'sum',
    pointsPerUnit: num(row.points_per_unit, 0),
    alertTolerance: num(row.alert_tolerance ?? targets.alert_tolerance, 10),
    active: row.active,
  }
}

export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [{ data: defs, error: defsError }, { data: entries, error: entriesError }] = await Promise.all([
      adminClient
        .from('kpi_definitions')
        .select('*')
        .eq('organization_id', appUser.organization_id)
        .eq('active', true)
        .order('created_at'),
      adminClient
        .from('kpi_entries')
        .select('kpi_id, value')
        .eq('organization_id', appUser.organization_id)
        .gte('recorded_at', startOfMonth.toISOString()),
    ])

    if (defsError) return NextResponse.json({ error: defsError.message }, { status: 500 })
    if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 })

    const currentByKpi: Record<string, number> = {}
    for (const entry of entries ?? []) {
      currentByKpi[entry.kpi_id] = (currentByKpi[entry.kpi_id] ?? 0) + Number(entry.value)
    }

    const kpis = (defs ?? []).map((row: any) => mapKpi(row, currentByKpi[row.id] ?? 0))
    return NextResponse.json({ kpis })
  } catch (error) {
    console.error('API /kpis GET error:', error)
    return NextResponse.json({ error: 'Erro ao carregar KPIs' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestor pode configurar indicadores' }, { status: 403 })
    }

    const input = await request.json()
    const name = String(input.name ?? '').trim()
    const source = sourceValue(input.source)
    const sourceEvent = String(input.sourceEvent || input.source_event || '').trim() || null
    const period = PERIODS.includes(input.period) ? String(input.period) : 'monthly'
    const calculationType = CALCULATION_TYPES.includes(input.calculationType || input.calculation_type)
      ? String(input.calculationType || input.calculation_type)
      : 'sum'
    const unit = String(input.unit ?? 'unid.').trim() || 'unid.'
    const targetDaily = num(input.targetDaily ?? input.target_daily, 0)
    const targetWeekly = num(input.targetWeekly ?? input.target_weekly, 0)
    const targetMonthly = num(input.targetMonthly ?? input.target_monthly ?? input.target, 0)

    if (!name) {
      return NextResponse.json({ error: 'Nome do indicador e obrigatorio' }, { status: 400 })
    }
    if (source !== 'manual' && !sourceEvent) {
      return NextResponse.json({ error: 'Indicador automatico precisa de evento de origem' }, { status: 400 })
    }
    if (targetDaily <= 0 && targetWeekly <= 0 && targetMonthly <= 0) {
      return NextResponse.json({ error: 'Defina pelo menos uma meta' }, { status: 400 })
    }

    const { count } = await adminClient
      .from('kpi_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', appUser.organization_id)
      .eq('active', true)

    if ((count ?? 0) >= MAX_KPIS) {
      return NextResponse.json({ error: 'Limite de indicadores ativos atingido' }, { status: 400 })
    }

    const targets = {
      daily: targetDaily,
      weekly: targetWeekly,
      monthly: targetMonthly,
      source,
      source_event: sourceEvent,
      alert_tolerance: num(input.alertTolerance ?? input.alert_tolerance, 10),
    }

    const { data, error } = await adminClient
      .from('kpi_definitions')
      .insert({
        organization_id: appUser.organization_id,
        created_by: appUser.id,
        name,
        slug: makeSlug(name),
        description: input.description || null,
        unit,
        points_per_unit: num(input.pointsPerUnit ?? input.points_per_unit, 1),
        targets,
        source,
        source_event: sourceEvent,
        period,
        target_daily: targetDaily,
        target_weekly: targetWeekly,
        target_monthly: targetMonthly,
        calculation_type: calculationType,
        alert_tolerance: targets.alert_tolerance,
        active: true,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ kpi: mapKpi(data, 0), id: data.id }, { status: 201 })
  } catch (error) {
    console.error('API /kpis POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar KPI' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error
    const { adminClient, appUser } = auth

    if (!['manager', 'admin', 'developer'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestor pode editar indicadores' }, { status: 403 })
    }

    const input = await request.json()
    const id = String(input.id ?? '')
    if (!id) return NextResponse.json({ error: 'Indicador obrigatorio' }, { status: 400 })

    if (input.action === 'deactivate') {
      const { error } = await adminClient
        .from('kpi_definitions')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', appUser.organization_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    const { data: existing, error: existingError } = await adminClient
      .from('kpi_definitions')
      .select('*')
      .eq('id', id)
      .eq('organization_id', appUser.organization_id)
      .single()

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

    const source = 'source' in input ? sourceValue(input.source) : sourceValue(existing.source ?? existing.targets?.source)
    const sourceEvent = 'sourceEvent' in input || 'source_event' in input
      ? String(input.sourceEvent || input.source_event || '').trim() || null
      : existing.source_event ?? existing.targets?.source_event ?? null
    const targetDaily = num(input.targetDaily ?? input.target_daily ?? existing.target_daily ?? existing.targets?.daily, 0)
    const targetWeekly = num(input.targetWeekly ?? input.target_weekly ?? existing.target_weekly ?? existing.targets?.weekly, 0)
    const targetMonthly = num(input.targetMonthly ?? input.target_monthly ?? input.target ?? existing.target_monthly ?? existing.targets?.monthly, 0)
    const alertTolerance = num(input.alertTolerance ?? input.alert_tolerance ?? existing.alert_tolerance ?? existing.targets?.alert_tolerance, 10)

    const targets = {
      ...(existing.targets ?? {}),
      daily: targetDaily,
      weekly: targetWeekly,
      monthly: targetMonthly,
      source,
      source_event: sourceEvent,
      alert_tolerance: alertTolerance,
    }

    const patch: Record<string, unknown> = {
      targets,
      source,
      source_event: sourceEvent,
      target_daily: targetDaily,
      target_weekly: targetWeekly,
      target_monthly: targetMonthly,
      alert_tolerance: alertTolerance,
      updated_at: new Date().toISOString(),
    }
    if ('name' in input) patch.name = String(input.name || existing.name).trim()
    if ('description' in input) patch.description = input.description || null
    if ('unit' in input) patch.unit = String(input.unit || existing.unit || 'unid.')
    if ('period' in input && PERIODS.includes(input.period)) patch.period = input.period
    if ('pointsPerUnit' in input || 'points_per_unit' in input) patch.points_per_unit = num(input.pointsPerUnit ?? input.points_per_unit, existing.points_per_unit)
    if ('calculationType' in input || 'calculation_type' in input) {
      const calc = input.calculationType || input.calculation_type
      if (CALCULATION_TYPES.includes(calc)) patch.calculation_type = calc
    }

    const { error } = await adminClient
      .from('kpi_definitions')
      .update(patch)
      .eq('id', id)
      .eq('organization_id', appUser.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('API /kpis PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar KPI' }, { status: 500 })
  }
}
