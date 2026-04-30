'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  History,
  ReceiptText,
  TrendingUp,
} from 'lucide-react'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import {
  calculateCommission,
  formatCurrency,
  getCurrentPeriodReference,
  getPeriodLabel,
  normalizeConfig,
  statusLabel,
  type CommissionCalculation,
  type CommissionLineItem,
  type CommissionPeriod,
} from '@/lib/commission'

interface CompletedMission {
  id: string
  title: string
  completed_at: string | null
}

interface DealRow {
  value: number | string
  expected_close: string | null
  updated_at: string | null
}

interface CalculationRow {
  id: string
  period_id: string
  user_id: string
  base_salary: number | string
  sales_revenue: number | string
  sales_commission: number | string
  mission_bonus: number | string
  kpi_bonus: number | string
  accelerator_mult: number | string
  total: number | string
  goal_pct: number | string
  missions_completed: number
  status: CommissionCalculation['status']
  calculated_at: string | null
  notes: string | null
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function isCurrentReference(dateValue: string | null | undefined, reference: string) {
  if (!dateValue) return true
  const [year, month] = reference.split('-').map(Number)
  const date = new Date(dateValue)
  return date.getFullYear() === year && date.getMonth() === month - 1
}

function nextPaymentDate(day: number) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), Math.min(Math.max(day, 1), 28))
  if (date <= now) date.setMonth(date.getMonth() + 1)
  return date
}

export default function ComissaoPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<CommissionPeriod | null>(null)
  const [calculation, setCalculation] = useState<CommissionCalculation | null>(null)
  const [history, setHistory] = useState<CommissionCalculation[]>([])
  const [cutoffDay, setCutoffDay] = useState(5)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const reference = getCurrentPeriodReference()
      const [{ data: configRow }, { data: currentPeriod }] = await Promise.all([
        supabase.from('commission_configs').select('*').eq('organization_id', user.organization_id).maybeSingle(),
        supabase
          .from('commission_periods')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('reference', reference)
          .maybeSingle(),
      ])

      const config = normalizeConfig(configRow as Record<string, unknown> | null)
      setCutoffDay(config.dia_corte)

      if (currentPeriod) {
        const activePeriod = currentPeriod as CommissionPeriod
        setPeriod(activePeriod)
        const { data: row } = await supabase
          .from('commission_calculations')
          .select('*')
          .eq('period_id', activePeriod.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (row) {
          const calcRow = row as CalculationRow
          const { data: lineItems } = await supabase
            .from('commission_line_items')
            .select('*')
            .eq('calculation_id', calcRow.id)

          setCalculation({
            id: calcRow.id,
            period_id: calcRow.period_id,
            user_id: calcRow.user_id,
            name: user.name,
            base_salary: toNumber(calcRow.base_salary),
            sales_revenue: toNumber(calcRow.sales_revenue),
            sales_commission: toNumber(calcRow.sales_commission),
            mission_bonus: toNumber(calcRow.mission_bonus),
            kpi_bonus: toNumber(calcRow.kpi_bonus),
            accelerator_mult: toNumber(calcRow.accelerator_mult),
            total: toNumber(calcRow.total),
            goal_pct: toNumber(calcRow.goal_pct),
            missions_completed: calcRow.missions_completed,
            status: calcRow.status,
            calculated_at: calcRow.calculated_at,
            notes: calcRow.notes,
            line_items: (lineItems ?? []) as CommissionLineItem[],
          })
        }
      } else {
        setPeriod({
          reference,
          label: getPeriodLabel(reference),
          status: 'open',
          total_bonus: 0,
          total_payroll: 0,
        })

        const [{ data: missions }, { data: deals }] = await Promise.all([
          supabase
            .from('ai_missions')
            .select('id, title, completed_at')
            .eq('user_id', user.id)
            .eq('status', 'completed'),
          supabase
            .from('crm_deals')
            .select('value, expected_close, updated_at')
            .eq('organization_id', user.organization_id)
            .eq('owner_id', user.id)
            .eq('stage', 'closed_won'),
        ])

        const currentMissions = ((missions ?? []) as CompletedMission[])
          .filter((mission) => isCurrentReference(mission.completed_at, reference))
        const salesRevenue = ((deals ?? []) as DealRow[])
          .filter((deal) => isCurrentReference(deal.expected_close ?? deal.updated_at, reference))
          .reduce((sum, deal) => sum + toNumber(deal.value), 0)

        setCalculation(calculateCommission({
          user_id: user.id,
          name: user.name,
          sales_revenue: salesRevenue,
          goal_target: Math.max(50000, salesRevenue || 0),
          missions_completed: currentMissions.length,
          config,
        }))
      }

      const { data: historyRows } = await supabase
        .from('commission_calculations')
        .select('*, commission_periods!inner(reference, label, status)')
        .eq('organization_id', user.organization_id)
        .eq('user_id', user.id)
        .order('calculated_at', { ascending: false })
        .limit(6)

      setHistory(((historyRows ?? []) as (CalculationRow & { commission_periods?: { label?: string } })[]).map((row) => ({
        id: row.id,
        period_id: row.period_id,
        user_id: row.user_id,
        name: row.commission_periods?.label ?? 'Periodo',
        base_salary: toNumber(row.base_salary),
        sales_revenue: toNumber(row.sales_revenue),
        sales_commission: toNumber(row.sales_commission),
        mission_bonus: toNumber(row.mission_bonus),
        kpi_bonus: toNumber(row.kpi_bonus),
        accelerator_mult: toNumber(row.accelerator_mult),
        total: toNumber(row.total),
        goal_pct: toNumber(row.goal_pct),
        missions_completed: row.missions_completed,
        status: row.status,
        calculated_at: row.calculated_at,
        notes: row.notes,
        line_items: [],
      })))
    } finally {
      setLoading(false)
    }
  }, [supabase, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const paymentDate = useMemo(() => nextPaymentDate(cutoffDay), [cutoffDay])
  const daysToPay = Math.max(0, Math.ceil((paymentDate.getTime() - Date.now()) / 86400000))

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  if (!calculation || !period) {
    return (
      <div className="space-y-6">
        <PageHeader
          label="Ganhos"
          title={<>Minha <TitleHighlight>Comissao</TitleHighlight></>}
          description="Detalhamento de ganhos e bonus do periodo"
        />
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Ainda nao ha comissionamento para este periodo.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const variableTotal = calculation.sales_commission + calculation.mission_bonus + calculation.kpi_bonus
  const nextTierRevenue = calculation.goal_pct >= 110 ? 0 : Math.max(0, Math.ceil((110 - calculation.goal_pct) / 100 * Math.max(calculation.sales_revenue, 50000)))

  return (
    <div className="space-y-6">
      <PageHeader
        label="Ganhos"
        title={<>Minha <TitleHighlight>Comissao</TitleHighlight></>}
        description="Holerite digital com composicao rastreavel"
        actions={<Badge className="border-0 bg-primary/10 text-primary">{period.label}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total previsto</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(calculation.total)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Base: {formatCurrency(calculation.base_salary)}
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="h-3 w-3" />
                Variavel: {formatCurrency(variableTotal)}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle className="h-3 w-3" />
                {statusLabel(calculation.status)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Proximo pagamento</p>
                <p className="text-xl font-bold text-blue-600">
                  {paymentDate.toLocaleDateString('pt-BR')}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Faltam {daysToPay} dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-primary" />
            Meta do mes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{formatCurrency(calculation.sales_revenue)} em vendas</span>
            <span className="font-medium">{calculation.goal_pct}%</span>
          </div>
          <Progress value={Math.min(calculation.goal_pct, 100)} />
          <p className="text-xs text-muted-foreground">
            {nextTierRevenue > 0
              ? `Se fechar mais ${formatCurrency(nextTierRevenue)}, voce entra na faixa acelerada.`
              : 'Voce ja esta na faixa acelerada deste periodo.'}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ReceiptText className="h-4 w-4 text-primary" />
            Extrato rastreavel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {calculation.line_items.map((item, index) => (
            <div key={`${item.tipo}-${index}`} className="flex items-start justify-between gap-3 border-b border-border/30 py-2 last:border-0">
              <div>
                <p className="text-sm font-medium capitalize">{item.tipo}</p>
                <p className="text-xs text-muted-foreground">{item.descricao}</p>
              </div>
              <span className="text-sm font-semibold">{formatCurrency(item.valor)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border/40 pt-3 text-sm font-bold">
            <span>Total</span>
            <span>{formatCurrency(calculation.total)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-primary" />
            Historico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Sem periodos anteriores fechados.</p>
          ) : (
            history.map((item) => (
              <div key={item.id ?? item.name} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Vendas {formatCurrency(item.sales_revenue)} · {item.goal_pct}% da meta
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(item.total)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
