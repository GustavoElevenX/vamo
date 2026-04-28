import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const MAX_KPIS = 5

async function getAppUser() {
  const supabase = await createClient()
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  }

  const adminClient = createAdminClient()
  const { data: appUser, error } = await adminClient
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (error || !appUser?.organization_id) {
    return { error: NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 }) }
  }

  return { adminClient, appUser }
}

function makeSlug(name: string) {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  return `${normalized || 'kpi'}_${Date.now()}`
}

export async function GET() {
  try {
    const auth = await getAppUser()
    if (auth.error) return auth.error

    const { adminClient, appUser } = auth
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    const startStr = startOfMonth.toISOString().split('T')[0]

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
        .gte('recorded_at', startStr),
    ])

    if (defsError) return NextResponse.json({ error: defsError.message }, { status: 500 })
    if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 })

    const currentByKpi: Record<string, number> = {}
    for (const entry of entries ?? []) {
      currentByKpi[entry.kpi_id] = (currentByKpi[entry.kpi_id] ?? 0) + Number(entry.value)
    }

    const kpis = (defs ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      source: (row.targets?.source ?? 'manual') as 'CRM' | 'manual',
      target: Number(row.targets?.monthly ?? row.targets?.daily ?? 0),
      current: currentByKpi[row.id] ?? 0,
      unit: row.unit,
      alertTolerance: Number(row.targets?.alert_tolerance ?? 10),
      active: row.active,
    }))

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
    const input = await request.json()
    const name = String(input.name ?? '').trim()
    const source = input.source === 'CRM' ? 'CRM' : 'manual'
    const target = Number(input.target ?? 0)
    const unit = String(input.unit ?? 'unid.').trim() || 'unid.'

    if (!name || !target) {
      return NextResponse.json({ error: 'Nome e meta do KPI são obrigatórios' }, { status: 400 })
    }

    const { count } = await adminClient
      .from('kpi_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', appUser.organization_id)
      .eq('active', true)

    if ((count ?? 0) >= MAX_KPIS) {
      return NextResponse.json({ error: 'Limite de KPIs ativos atingido' }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('kpi_definitions')
      .insert({
        organization_id: appUser.organization_id,
        name,
        slug: makeSlug(name),
        unit,
        points_per_unit: 10,
        targets: {
          monthly: target,
          alert_tolerance: 10,
          source,
        },
        active: true,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: data.id })
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
    const input = await request.json()
    const id = String(input.id ?? '')

    if (!id) return NextResponse.json({ error: 'KPI obrigatório' }, { status: 400 })

    if (input.action === 'deactivate') {
      const { error } = await adminClient
        .from('kpi_definitions')
        .update({ active: false })
        .eq('id', id)
        .eq('organization_id', appUser.organization_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    const { data: existing, error: existingError } = await adminClient
      .from('kpi_definitions')
      .select('targets')
      .eq('id', id)
      .eq('organization_id', appUser.organization_id)
      .single()

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

    const targets = {
      ...(existing?.targets ?? {}),
      monthly: Number(input.target ?? (existing?.targets as any)?.monthly ?? 0),
      alert_tolerance: Number(input.alertTolerance ?? (existing?.targets as any)?.alert_tolerance ?? 10),
      source: input.source === 'CRM' ? 'CRM' : (existing?.targets as any)?.source ?? 'manual',
    }

    const { error } = await adminClient
      .from('kpi_definitions')
      .update({ targets })
      .eq('id', id)
      .eq('organization_id', appUser.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('API /kpis PATCH error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar KPI' }, { status: 500 })
  }
}
