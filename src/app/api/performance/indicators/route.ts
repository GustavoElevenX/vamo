import { NextResponse } from 'next/server'
import { getAppUser } from '@/lib/server/auth'

export const runtime = 'nodejs'

function monthRange(offset = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

function sumByKpi(entries: any[] = []) {
  return entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.kpi_id] = (acc[entry.kpi_id] ?? 0) + Number(entry.value ?? 0)
    return acc
  }, {})
}

export async function GET() {
  const auth = await getAppUser()
  if (auth.error) return auth.error

  const { adminClient, appUser } = auth
  const current = monthRange(0)
  const previous = monthRange(-1)

  const [defsResult, currentEntriesResult, previousEntriesResult, commissionResult] = await Promise.all([
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
      .eq('user_id', appUser.id)
      .gte('recorded_at', current.start)
      .lte('recorded_at', current.end),
    adminClient
      .from('kpi_entries')
      .select('kpi_id, value')
      .eq('organization_id', appUser.organization_id)
      .eq('user_id', appUser.id)
      .gte('recorded_at', previous.start)
      .lte('recorded_at', previous.end),
    adminClient
      .from('commission_configs')
      .select('bonus_kpi, bonus_missao')
      .eq('organization_id', appUser.organization_id)
      .maybeSingle(),
  ])

  if (defsResult.error) return NextResponse.json({ error: defsResult.error.message }, { status: 500 })
  if (currentEntriesResult.error) return NextResponse.json({ error: currentEntriesResult.error.message }, { status: 500 })
  if (previousEntriesResult.error) return NextResponse.json({ error: previousEntriesResult.error.message }, { status: 500 })

  const currentByKpi = sumByKpi(currentEntriesResult.data ?? [])
  const previousByKpi = sumByKpi(previousEntriesResult.data ?? [])
  const baseBonus = Number(commissionResult.data?.bonus_kpi || commissionResult.data?.bonus_missao || 100)

  const indicators = (defsResult.data ?? []).map((kpi: any) => {
    const target = Number(kpi.targets?.monthly ?? kpi.targets?.daily ?? 0)
    const value = currentByKpi[kpi.id] ?? 0
    const previousValue = previousByKpi[kpi.id] ?? 0
    const pct = target > 0 ? Math.min(999, Math.round((value / target) * 100)) : 0
    const delta = value - previousValue
    const targetBonus = Number(kpi.targets?.commission_bonus ?? baseBonus)
    const projectedBonus = pct >= 100 ? targetBonus : 0

    return {
      id: kpi.id,
      name: kpi.name,
      unit: kpi.unit,
      current: value,
      target,
      previous: previousValue,
      delta,
      pct,
      trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
      status: pct >= 100 ? 'Meta batida' : pct >= 70 ? 'Em andamento' : pct >= 40 ? 'Atencao' : 'Abaixo da meta',
      targetBonus,
      projectedBonus,
      source: kpi.targets?.source ?? 'manual',
    }
  })

  const focus = indicators
    .filter((item) => item.target > 0 && item.pct < 100)
    .sort((a, b) => {
      const aGap = Math.max(0, a.target - a.current)
      const bGap = Math.max(0, b.target - b.current)
      const aScore = a.targetBonus / Math.max(1, aGap)
      const bScore = b.targetBonus / Math.max(1, bGap)
      return bScore - aScore
    })[0] ?? indicators[0] ?? null

  return NextResponse.json({
    period: {
      label: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      start: current.start,
      end: current.end,
    },
    indicators,
    focus,
  })
}
