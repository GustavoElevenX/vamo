'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  ListChecks,
  ReceiptText,
  Trophy,
  Users,
} from 'lucide-react'
import {
  calculateCommission,
  daysUntilCutoff,
  formatCurrency,
  getCurrentPeriodReference,
  getPeriodLabel,
  normalizeConfig,
  statusLabel,
  type CommissionCalculation,
  type CommissionConfig,
  type CommissionLineItem,
  type CommissionPeriod,
} from '@/lib/commission'

interface Seller {
  id: string
  name: string
}

interface DealRow {
  owner_id: string
  value: number | string
  stage: string
  expected_close: string | null
  updated_at: string | null
}

interface GoalRow {
  individual_goals?: { user_id: string; commission_bonus?: number }[]
}

interface CalculationRow {
  id: string
  period_id: string
  organization_id: string
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
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  calculated_at: string | null
}

const statusTone: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-600',
  calculating: 'bg-sky-500/10 text-sky-600',
  pending_approval: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  paid: 'bg-green-500/10 text-green-600',
  calculated: 'bg-blue-500/10 text-blue-600',
  disputed: 'bg-red-500/10 text-red-600',
  draft: 'bg-muted text-muted-foreground',
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function getMonthRange(reference: string) {
  const [year, month] = reference.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return { start, end }
}

function withinReference(dateValue: string | null | undefined, reference: string) {
  if (!dateValue) return true
  const { start, end } = getMonthRange(reference)
  const date = new Date(dateValue)
  return date >= start && date <= end
}

export default function ComissionamentoPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [config, setConfig] = useState<CommissionConfig>(normalizeConfig(null))
  const [period, setPeriod] = useState<CommissionPeriod>({
    reference: getCurrentPeriodReference(),
    label: getPeriodLabel(),
    status: 'open',
    total_bonus: 0,
    total_payroll: 0,
  })
  const [calculations, setCalculations] = useState<CommissionCalculation[]>([])
  const [history, setHistory] = useState<CommissionPeriod[]>([])

  const buildPreview = useCallback(async (activeConfig: CommissionConfig, sellers: Seller[], reference: string) => {
    const memberIds = sellers.map((seller) => seller.id)
    const [{ data: missionRows }, { data: dealRows }, { data: goalsRow }] = await Promise.all([
      memberIds.length
        ? supabase.from('ai_missions').select('user_id').in('user_id', memberIds).eq('status', 'completed')
        : Promise.resolve({ data: [] }),
      supabase
        .from('crm_deals')
        .select('owner_id, value, stage, expected_close, updated_at')
        .eq('organization_id', user?.organization_id)
        .eq('stage', 'closed_won'),
      supabase
        .from('program_goals')
        .select('individual_goals')
        .eq('organization_id', user?.organization_id)
        .maybeSingle(),
    ])

    const missionsByUser = new Map<string, number>()
    for (const row of missionRows ?? []) {
      const userId = (row as { user_id: string }).user_id
      missionsByUser.set(userId, (missionsByUser.get(userId) ?? 0) + 1)
    }

    const revenueByUser = new Map<string, number>()
    for (const deal of (dealRows ?? []) as DealRow[]) {
      const referenceDate = deal.expected_close ?? deal.updated_at
      if (!withinReference(referenceDate, reference)) continue
      revenueByUser.set(deal.owner_id, (revenueByUser.get(deal.owner_id) ?? 0) + toNumber(deal.value))
    }

    const goals = (goalsRow as GoalRow | null)?.individual_goals ?? []
    const targetByUser = new Map<string, number>()
    for (const goal of goals) {
      if (goal.commission_bonus && goal.commission_bonus > 0) targetByUser.set(goal.user_id, goal.commission_bonus)
    }

    return sellers.map((seller) => {
      const salesRevenue = revenueByUser.get(seller.id) ?? 0
      return calculateCommission({
        user_id: seller.id,
        name: seller.name,
        sales_revenue: salesRevenue,
        goal_target: targetByUser.get(seller.id) ?? Math.max(50000, salesRevenue || 0),
        missions_completed: missionsByUser.get(seller.id) ?? 0,
        config: activeConfig,
      })
    }).sort((a, b) => b.total - a.total)
  }, [supabase, user?.organization_id])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const reference = getCurrentPeriodReference()
      const sellersRes = await fetch('/api/team/sellers', { credentials: 'same-origin' })
      const sellersJson = sellersRes.ok ? await sellersRes.json() : { sellers: [] }
      const sellers = (sellersJson.sellers ?? []) as Seller[]
      const sellerName = new Map(sellers.map((seller) => [seller.id, seller.name]))

      const [{ data: configRow }, { data: currentPeriod }, { data: periodRows }] = await Promise.all([
        supabase.from('commission_configs').select('*').eq('organization_id', user.organization_id).maybeSingle(),
        supabase
          .from('commission_periods')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('reference', reference)
          .maybeSingle(),
        supabase
          .from('commission_periods')
          .select('*')
          .eq('organization_id', user.organization_id)
          .order('reference', { ascending: false })
          .limit(6),
      ])

      const activeConfig = normalizeConfig(configRow as Record<string, unknown> | null)
      setConfig(activeConfig)

      if (currentPeriod) {
        const activePeriod = currentPeriod as CommissionPeriod
        const { data: calculationRows } = await supabase
          .from('commission_calculations')
          .select('*')
          .eq('period_id', activePeriod.id)
          .order('total', { ascending: false })

        const rows = (calculationRows ?? []) as CalculationRow[]
        const ids = rows.map((row) => row.id)
        const { data: itemRows } = ids.length
          ? await supabase.from('commission_line_items').select('*').in('calculation_id', ids)
          : { data: [] }

        const itemsByCalc = new Map<string, CommissionLineItem[]>()
        for (const item of (itemRows ?? []) as (CommissionLineItem & { calculation_id: string })[]) {
          itemsByCalc.set(item.calculation_id, [...(itemsByCalc.get(item.calculation_id) ?? []), item])
        }

        setPeriod(activePeriod)
        setCalculations(rows.map((row) => ({
          id: row.id,
          period_id: row.period_id,
          organization_id: row.organization_id,
          user_id: row.user_id,
          name: sellerName.get(row.user_id) ?? 'Vendedor',
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
          approved_by: row.approved_by,
          approved_at: row.approved_at,
          notes: row.notes,
          calculated_at: row.calculated_at,
          line_items: itemsByCalc.get(row.id) ?? [],
        })))
      } else {
        const preview = await buildPreview(activeConfig, sellers, reference)
        setCalculations(preview)
        setPeriod({
          reference,
          label: getPeriodLabel(reference),
          status: 'open',
          total_payroll: preview.reduce((sum, item) => sum + item.total, 0),
          total_bonus: preview.reduce((sum, item) => sum + item.sales_commission + item.mission_bonus + item.kpi_bonus, 0),
        })
      }

      setHistory(((periodRows ?? []) as CommissionPeriod[]).filter((item) => item.reference !== reference))
    } catch {
      toast.error('Nao foi possivel carregar o comissionamento')
    } finally {
      setLoading(false)
    }
  }, [buildPreview, supabase, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summary = useMemo(() => {
    const totalPayroll = calculations.reduce((sum, item) => sum + item.total, 0)
    const totalBonus = calculations.reduce((sum, item) => sum + item.sales_commission + item.mission_bonus + item.kpi_bonus, 0)
    const pending = calculations.filter((item) => item.status === 'pending_approval' || item.status === 'calculated').length
    return { totalPayroll, totalBonus, pending }
  }, [calculations])

  const handleClosePeriod = async () => {
    if (!user || calculations.length === 0) return
    setClosing(true)
    try {
      const periodPayload = {
        id: period.id,
        organization_id: user.organization_id,
        reference: period.reference,
        label: period.label,
        status: 'pending_approval',
        closed_at: new Date().toISOString(),
        total_payroll: summary.totalPayroll,
        total_bonus: summary.totalBonus,
      }

      const { data: savedPeriod, error: periodError } = await supabase
        .from('commission_periods')
        .upsert(periodPayload, { onConflict: 'organization_id,reference' })
        .select('*')
        .single()

      if (periodError) throw periodError

      const calculationPayload = calculations.map((item) => ({
        id: item.id,
        period_id: savedPeriod.id,
        organization_id: user.organization_id,
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

      const { data: savedCalculations, error: calculationError } = await supabase
        .from('commission_calculations')
        .upsert(calculationPayload, { onConflict: 'period_id,user_id' })
        .select('id, user_id')

      if (calculationError) throw calculationError

      const savedByUser = new Map((savedCalculations ?? []).map((item: { id: string; user_id: string }) => [item.user_id, item.id]))
      const calculationIds = [...savedByUser.values()]
      if (calculationIds.length) {
        await supabase.from('commission_line_items').delete().in('calculation_id', calculationIds)
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
        const { error: lineItemsError } = await supabase.from('commission_line_items').insert(lineItems)
        if (lineItemsError) throw lineItemsError
      }

      await supabase.from('commission_audit_logs').insert({
        organization_id: user.organization_id,
        period_id: savedPeriod.id,
        actor_id: user.id,
        action: 'period_closed',
        details: { reference: period.reference, calculations: calculations.length },
      })

      toast.success('Periodo fechado e enviado para aprovacao')
      fetchData()
    } catch {
      toast.error('Erro ao fechar periodo')
    } finally {
      setClosing(false)
    }
  }

  const handleApprove = async (calculationId: string) => {
    if (!user) return
    setApproving(calculationId)
    try {
      const { error } = await supabase
        .from('commission_calculations')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', calculationId)

      if (error) throw error

      await supabase.from('commission_audit_logs').insert({
        organization_id: user.organization_id,
        period_id: period.id,
        calculation_id: calculationId,
        actor_id: user.id,
        action: 'calculation_approved',
      })

      toast.success('Comissao aprovada')
      fetchData()
    } catch {
      toast.error('Erro ao aprovar calculo')
    } finally {
      setApproving(null)
    }
  }

  const exportCsv = () => {
    const header = ['Nome', 'Base', 'Comissao vendas', 'Bonus missao', 'Bonus KPI', 'Total', 'Meta %', 'Status']
    const rows = calculations.map((item) => [
      item.name,
      item.base_salary,
      item.sales_commission,
      item.mission_bonus,
      item.kpi_bonus,
      item.total,
      item.goal_pct,
      statusLabel(item.status),
    ])
    const csv = [header, ...rows].map((row) => row.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `comissionamento-${period.reference}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const daysLeft = daysUntilCutoff(config.dia_corte)
  const periodProgress = Math.min(100, Math.max(8, ((31 - daysLeft) / 31) * 100))
  const topSellers = [...calculations].sort((a, b) => b.total - a.total).slice(0, 3)
  const approvalQueue = calculations.filter((item) => ['calculated', 'pending_approval'].includes(item.status))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Comissionamento</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {period.label} · {statusLabel(period.status)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button size="sm" onClick={handleClosePeriod} disabled={closing || period.status !== 'open'}>
            <CalendarCheck className="mr-1 h-3.5 w-3.5" />
            {closing ? 'Fechando...' : 'Fechar periodo'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="geral">Visao geral</TabsTrigger>
          <TabsTrigger value="vendedores">Por vendedor</TabsTrigger>
          <TabsTrigger value="aprovacoes">Aprovacoes</TabsTrigger>
          <TabsTrigger value="historico">Historico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <SummaryCard icon={ReceiptText} label="Folha total" value={formatCurrency(summary.totalPayroll)} tone="text-emerald-600 bg-emerald-500/10" />
            <SummaryCard icon={Trophy} label="Bonus gerados" value={formatCurrency(summary.totalBonus)} tone="text-amber-600 bg-amber-500/10" />
            <SummaryCard icon={Users} label="Vendedores" value={String(calculations.length)} tone="text-violet-600 bg-violet-500/10" />
            <SummaryCard icon={Clock} label="Status" value={statusLabel(period.status)} tone="text-blue-600 bg-blue-500/10" />
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Progresso do periodo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dia de corte {config.dia_corte}</span>
                <span className="font-medium">{daysLeft} dias restantes</span>
              </div>
              <Progress value={periodProgress} />
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top vendedores do mes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topSellers.map((seller, index) => (
                <div key={seller.user_id} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{seller.name}</p>
                      <p className="text-xs text-muted-foreground">{seller.goal_pct}% da meta</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(seller.total)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendedores">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Detalhamento por vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              <CommissionTable calculations={calculations} onApprove={handleApprove} approving={approving} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aprovacoes">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ListChecks className="h-4 w-4 text-amber-600" />
                Fila de aprovacao
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {approvalQueue.length === 0 ? (
                <Empty icon={CheckCircle2} text="Nenhum calculo aguardando aprovacao." />
              ) : (
                approvalQueue.map((item) => (
                  <div key={item.user_id} className="flex flex-col gap-3 rounded-lg border border-border/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.total)} · vendas {formatCurrency(item.sales_revenue)} · {item.goal_pct}% da meta
                      </p>
                    </div>
                    <Button size="sm" onClick={() => item.id && handleApprove(item.id)} disabled={!item.id || approving === item.id}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Aprovar
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Periodos anteriores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <Empty icon={FileText} text="Nenhum periodo fechado ainda." />
              ) : (
                history.map((item) => (
                  <div key={item.reference} className="grid gap-2 rounded-lg border border-border/40 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{statusLabel(item.status)}</p>
                    </div>
                    <span className="text-sm">{formatCurrency(item.total_bonus)} em bonus</span>
                    <span className="text-sm font-semibold">{formatCurrency(item.total_payroll)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ReceiptText
  label: string
  value: string
  tone: string
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CommissionTable({
  calculations,
  onApprove,
  approving,
}: {
  calculations: CommissionCalculation[]
  onApprove: (id: string) => void
  approving: string | null
}) {
  if (calculations.length === 0) return <Empty icon={Users} text="Nenhum vendedor na equipe." />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {['Nome', 'Base', 'Comissao vendas', 'Bonus missao', 'Bonus KPI', 'Total', 'Meta%', 'Status', ''].map((head) => (
              <th key={head} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calculations.map((item) => (
            <tr key={item.user_id} className="border-b border-border/30 align-top last:border-0">
              <td className="px-3 py-3">
                <p className="font-medium">{item.name}</p>
                <details className="mt-2">
                  <summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    Ver extrato
                  </summary>
                  <div className="mt-2 space-y-1 rounded-md bg-muted/30 p-2">
                    {item.line_items.map((line, index) => (
                      <div key={`${line.tipo}-${index}`} className="flex justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">{line.descricao}</span>
                        <span className="font-medium">{formatCurrency(line.valor)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </td>
              <td className="px-3 py-3 text-right">{formatCurrency(item.base_salary)}</td>
              <td className="px-3 py-3 text-right">{formatCurrency(item.sales_commission)}</td>
              <td className="px-3 py-3 text-right">{formatCurrency(item.mission_bonus)}</td>
              <td className="px-3 py-3 text-right">{formatCurrency(item.kpi_bonus)}</td>
              <td className="px-3 py-3 text-right font-bold">{formatCurrency(item.total)}</td>
              <td className="px-3 py-3 text-center">{item.goal_pct}%</td>
              <td className="px-3 py-3 text-center">
                <Badge className={`border-0 text-[10px] ${statusTone[item.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {statusLabel(item.status)}
                </Badge>
              </td>
              <td className="px-3 py-3 text-right">
                <Button size="sm" variant="outline" disabled={!item.id || item.status === 'approved' || approving === item.id} onClick={() => item.id && onApprove(item.id)}>
                  Aprovar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: typeof AlertCircle; text: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <Icon className="mb-2 h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
