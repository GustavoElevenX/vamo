import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronSecret } from '@/lib/cron-auth'
import { calculateCommission, normalizeConfig, type CommissionConfig } from '@/lib/commission'

export const runtime = 'nodejs'

interface CommissionConfigRow extends Record<string, unknown> {
  organization_id: string
}

interface SellerRow {
  id: string
  name: string
}

interface MissionRow {
  user_id: string
}

interface DealRow {
  owner_id: string
  value: number | string
  expected_close: string | null
  updated_at: string | null
}

interface ProgramGoalsRow {
  individual_goals?: { user_id: string; commission_bonus?: number }[]
}

function previousMonthReference(date = new Date()) {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  const month = String(previous.getMonth() + 1).padStart(2, '0')
  return `${previous.getFullYear()}-${month}`
}

function periodBounds(reference: string) {
  const [year, month] = reference.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

function periodLabel(reference: string) {
  const [year, month] = reference.split('-').map(Number)
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function inPeriod(value: string | null | undefined, reference: string) {
  if (!value) return true
  const { start, end } = periodBounds(reference)
  const date = new Date(value)
  return date >= start && date <= end
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

async function closeOrganizationPeriod(admin: ReturnType<typeof createAdminClient>, config: CommissionConfig, organizationId: string, reference: string) {
  const { startIso, endIso } = periodBounds(reference)

  const [{ data: sellers }, { data: missions }, { data: deals }, { data: goals }] = await Promise.all([
    admin
      .from('users')
      .select('id, name')
      .eq('organization_id', organizationId)
      .eq('role', 'seller')
      .eq('active', true),
    admin
      .from('ai_missions')
      .select('user_id')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .gte('completed_at', startIso)
      .lte('completed_at', endIso),
    admin
      .from('crm_deals')
      .select('owner_id, value, expected_close, updated_at')
      .eq('organization_id', organizationId)
      .eq('stage', 'closed_won'),
    admin
      .from('program_goals')
      .select('individual_goals')
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ])

  const sellerRows = (sellers ?? []) as SellerRow[]
  const missionsByUser = new Map<string, number>()
  for (const mission of (missions ?? []) as MissionRow[]) {
    missionsByUser.set(mission.user_id, (missionsByUser.get(mission.user_id) ?? 0) + 1)
  }

  const revenueByUser = new Map<string, number>()
  for (const deal of (deals ?? []) as DealRow[]) {
    if (!inPeriod(deal.expected_close ?? deal.updated_at, reference)) continue
    revenueByUser.set(deal.owner_id, (revenueByUser.get(deal.owner_id) ?? 0) + toNumber(deal.value))
  }

  const targetByUser = new Map<string, number>()
  for (const goal of ((goals as ProgramGoalsRow | null)?.individual_goals ?? [])) {
    if (goal.commission_bonus && goal.commission_bonus > 0) targetByUser.set(goal.user_id, goal.commission_bonus)
  }

  const calculations = sellerRows.map((seller) => {
    const salesRevenue = revenueByUser.get(seller.id) ?? 0
    return calculateCommission({
      user_id: seller.id,
      name: seller.name,
      sales_revenue: salesRevenue,
      goal_target: targetByUser.get(seller.id) ?? Math.max(50000, salesRevenue || 0),
      missions_completed: missionsByUser.get(seller.id) ?? 0,
      config,
    })
  })

  const totalPayroll = calculations.reduce((sum, item) => sum + item.total, 0)
  const totalBonus = calculations.reduce((sum, item) => sum + item.sales_commission + item.mission_bonus + item.kpi_bonus, 0)

  const { data: period, error: periodError } = await admin
    .from('commission_periods')
    .upsert({
      organization_id: organizationId,
      reference,
      label: periodLabel(reference),
      status: 'pending_approval',
      opened_at: startIso,
      closed_at: new Date().toISOString(),
      total_payroll: totalPayroll,
      total_bonus: totalBonus,
      notes: 'Fechado automaticamente pelo job de comissionamento.',
    }, { onConflict: 'organization_id,reference' })
    .select('id')
    .single()

  if (periodError) throw new Error(periodError.message)

  const calculationPayload = calculations.map((item) => ({
    period_id: period.id,
    organization_id: organizationId,
    user_id: item.user_id,
    base_salary: item.base_salary,
    sales_revenue: item.sales_revenue,
    sales_commission: item.sales_commission,
    mission_bonus: item.mission_bonus,
    kpi_bonus: item.kpi_bonus,
    accelerator_mult: item.accelerator_mult,
    total: item.total,
    goal_pct: item.goal_pct,
    missions_completed: item.missions_completed,
    status: 'pending_approval',
    calculated_at: new Date().toISOString(),
  }))

  const { data: savedCalculations, error: calculationError } = await admin
    .from('commission_calculations')
    .upsert(calculationPayload, { onConflict: 'period_id,user_id' })
    .select('id, user_id')

  if (calculationError) throw new Error(calculationError.message)

  const savedByUser = new Map((savedCalculations ?? []).map((item: { id: string; user_id: string }) => [item.user_id, item.id]))
  const calculationIds = [...savedByUser.values()]
  if (calculationIds.length) {
    await admin.from('commission_line_items').delete().in('calculation_id', calculationIds)
  }

  const lineItems = calculations.flatMap((calculation) => {
    const calculationId = savedByUser.get(calculation.user_id)
    if (!calculationId) return []
    return calculation.line_items.map((item) => ({
      calculation_id: calculationId,
      user_id: calculation.user_id,
      tipo: item.tipo,
      descricao: item.descricao,
      valor: item.valor,
      data_referencia: item.data_referencia,
      referencia_id: item.referencia_id,
    }))
  })

  if (lineItems.length) {
    const { error: lineItemsError } = await admin.from('commission_line_items').insert(lineItems)
    if (lineItemsError) throw new Error(lineItemsError.message)
  }

  await admin.from('commission_audit_logs').insert({
    organization_id: organizationId,
    period_id: period.id,
    actor_id: null,
    action: 'period_auto_closed',
    details: { reference, calculations: calculations.length },
  })

  return { organization_id: organizationId, reference, calculations: calculations.length, total_payroll: totalPayroll }
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return new Response('Unauthorized', { status: 401 })

  const admin = createAdminClient()
  const today = new Date()
  const reference = previousMonthReference(today)

  const { data: configRows, error } = await admin
    .from('commission_configs')
    .select('*')
    .eq('fechamento_automatico', true)
    .eq('dia_corte', today.getDate())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = []
  const failures = []

  for (const row of (configRows ?? []) as CommissionConfigRow[]) {
    try {
      results.push(await closeOrganizationPeriod(admin, normalizeConfig(row), row.organization_id, reference))
    } catch (error) {
      failures.push({
        organization_id: row.organization_id,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    reference,
    processed: results.length,
    results,
    failures,
  }, { status: failures.length > 0 ? 207 : 200 })
}
