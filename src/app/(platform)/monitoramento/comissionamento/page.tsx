'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileClock,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  formatCurrency,
  getCurrentPeriodReference,
  getPeriodLabel,
  statusLabel,
  type CommissionCalculation,
  type CommissionPeriod,
} from '@/lib/commission'

interface Seller {
  id: string
  name: string
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
  total: number | string
  goal_pct: number | string
  missions_completed: number
  status: CommissionCalculation['status']
  calculated_at: string | null
  commission_periods?: { label?: string; reference?: string }
}

interface AuditLog {
  id: string
  action: string
  details: Record<string, unknown>
  created_at: string
  actor_id: string | null
  calculation_id: string | null
}

const statusTone: Record<string, string> = {
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

export default function MonitoramentoComissionamentoPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [period, setPeriod] = useState<CommissionPeriod>({
    reference: getCurrentPeriodReference(),
    label: getPeriodLabel(),
    status: 'open',
    total_bonus: 0,
    total_payroll: 0,
  })
  const [calculations, setCalculations] = useState<CommissionCalculation[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const sellersRes = await fetch('/api/team/sellers', { credentials: 'same-origin' })
      const sellersJson = sellersRes.ok ? await sellersRes.json() : { sellers: [] }
      const sellers = (sellersJson.sellers ?? []) as Seller[]
      const sellerName = new Map(sellers.map((seller) => [seller.id, seller.name]))

      const { data: activePeriod } = await supabase
        .from('commission_periods')
        .select('*')
        .eq('organization_id', user.organization_id)
        .eq('reference', getCurrentPeriodReference())
        .maybeSingle()

      if (activePeriod) {
        setPeriod(activePeriod as CommissionPeriod)
      }

      const periodId = (activePeriod as CommissionPeriod | null)?.id
      const [{ data: calcRows }, { data: auditRows }] = await Promise.all([
        periodId
          ? supabase
              .from('commission_calculations')
              .select('*')
              .eq('period_id', periodId)
              .order('total', { ascending: false })
          : supabase
              .from('commission_calculations')
              .select('*, commission_periods!inner(label, reference)')
              .eq('organization_id', user.organization_id)
              .order('calculated_at', { ascending: false })
              .limit(20),
        supabase
          .from('commission_audit_logs')
          .select('*')
          .eq('organization_id', user.organization_id)
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      setCalculations(((calcRows ?? []) as CalculationRow[]).map((row) => ({
        id: row.id,
        period_id: row.period_id,
        user_id: row.user_id,
        name: sellerName.get(row.user_id) ?? row.commission_periods?.label ?? 'Vendedor',
        base_salary: toNumber(row.base_salary),
        sales_revenue: toNumber(row.sales_revenue),
        sales_commission: toNumber(row.sales_commission),
        mission_bonus: toNumber(row.mission_bonus),
        kpi_bonus: toNumber(row.kpi_bonus),
        accelerator_mult: 1,
        total: toNumber(row.total),
        goal_pct: toNumber(row.goal_pct),
        missions_completed: row.missions_completed,
        status: row.status,
        calculated_at: row.calculated_at,
        line_items: [],
      })))

      setLogs((auditRows ?? []) as AuditLog[])
    } catch {
      toast.error('Nao foi possivel carregar a auditoria')
    } finally {
      setLoading(false)
    }
  }, [supabase, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const summary = useMemo(() => {
    const approvalQueue = calculations.filter((item) => item.status === 'pending_approval' || item.status === 'calculated')
    const disputed = calculations.filter((item) => item.status === 'disputed')
    const belowEligibility = calculations.filter((item) => item.goal_pct < 80)
    return { approvalQueue, disputed, belowEligibility }
  }, [calculations])

  const handleStatus = async (id: string, status: 'approved' | 'paid' | 'disputed') => {
    if (!user) return
    setApproving(id)
    try {
      const payload: Record<string, string> = { status }
      if (status === 'approved') {
        payload.approved_by = user.id
        payload.approved_at = new Date().toISOString()
      }

      const { error } = await supabase.from('commission_calculations').update(payload).eq('id', id)
      if (error) throw error

      await supabase.from('commission_audit_logs').insert({
        organization_id: user.organization_id,
        period_id: period.id,
        calculation_id: id,
        actor_id: user.id,
        action: `calculation_${status}`,
      })

      toast.success('Status atualizado')
      fetchData()
    } catch {
      toast.error('Erro ao atualizar status')
    } finally {
      setApproving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Monitoramento de Comissionamento</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Auditoria e aprovacoes · {period.label} · {statusLabel(period.status)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Summary icon={ShieldCheck} label="Aguardando" value={String(summary.approvalQueue.length)} tone="text-amber-600 bg-amber-500/10" />
        <Summary icon={Users} label="Vendedores" value={String(calculations.length)} tone="text-violet-600 bg-violet-500/10" />
        <Summary icon={TrendingUp} label="Folha" value={formatCurrency(calculations.reduce((sum, item) => sum + item.total, 0))} tone="text-emerald-600 bg-emerald-500/10" />
        <Summary icon={AlertTriangle} label="Alertas" value={String(summary.disputed.length + summary.belowEligibility.length)} tone="text-red-600 bg-red-500/10" />
      </div>

      <Tabs defaultValue="aprovacoes" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="aprovacoes">Aprovacoes</TabsTrigger>
          <TabsTrigger value="logs">Log completo</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="aprovacoes">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Fila de calculos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.approvalQueue.length === 0 ? (
                <Empty text="Nada pendente de aprovacao." />
              ) : (
                summary.approvalQueue.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-border/40 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        <Badge className={`border-0 text-[10px] ${statusTone[item.status]}`}>{statusLabel(item.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total {formatCurrency(item.total)} · vendas {formatCurrency(item.sales_revenue)} · {item.goal_pct}% da meta
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => item.id && handleStatus(item.id, 'approved')} disabled={!item.id || approving === item.id}>
                        Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => item.id && handleStatus(item.id, 'disputed')} disabled={!item.id || approving === item.id}>
                        Contestar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <FileClock className="h-4 w-4 text-primary" />
                Log de auditoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.length === 0 ? (
                <Empty text="Nenhum evento registrado." />
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3">
                    <div>
                      <p className="text-sm font-medium">{log.action.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparativo">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Mes a mes por vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              {calculations.length === 0 ? (
                <Empty text="Sem calculos para comparar." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground">Vendedor</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase text-muted-foreground">Vendas</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase text-muted-foreground">Bonus</th>
                        <th className="px-3 py-2 text-right text-[11px] uppercase text-muted-foreground">Total</th>
                        <th className="px-3 py-2 text-center text-[11px] uppercase text-muted-foreground">Meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculations.map((item) => (
                        <tr key={item.id ?? item.user_id} className="border-b border-border/30 last:border-0">
                          <td className="px-3 py-3 font-medium">{item.name}</td>
                          <td className="px-3 py-3 text-right">{formatCurrency(item.sales_revenue)}</td>
                          <td className="px-3 py-3 text-right">{formatCurrency(item.sales_commission + item.mission_bonus + item.kpi_bonus)}</td>
                          <td className="px-3 py-3 text-right font-semibold">{formatCurrency(item.total)}</td>
                          <td className="px-3 py-3 text-center">{item.goal_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Alertas de auditoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.disputed.length === 0 && summary.belowEligibility.length === 0 ? (
                <Empty text="Nenhum alerta no periodo." />
              ) : (
                <>
                  {summary.disputed.map((item) => (
                    <AlertRow key={`disputed-${item.id}`} title={`${item.name} contestou o calculo`} detail={`${formatCurrency(item.total)} em analise`} />
                  ))}
                  {summary.belowEligibility.map((item) => (
                    <AlertRow key={`eligibility-${item.id}`} title={`${item.name} abaixo da elegibilidade`} detail={`${item.goal_pct}% da meta no periodo`} />
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Summary({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck
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

function Empty({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>
  )
}

function AlertRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
      <div>
        <p className="text-sm font-medium text-red-700">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <AlertTriangle className="h-4 w-4 text-red-600" />
    </div>
  )
}
