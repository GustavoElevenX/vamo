'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BarChart3, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'

type Kpi = {
  id: string
  name: string
  description: string | null
  source: string
  sourceEvent: string | null
  period: 'daily' | 'weekly' | 'monthly'
  targetDaily: number
  targetWeekly: number
  targetMonthly: number
  target: number
  current: number
  unit: string
  calculationType: string
  pointsPerUnit: number
  alertTolerance: number
}

const EVENT_OPTIONS = [
  { value: 'crm_activity_call', label: 'Ligacao no CRM' },
  { value: 'crm_activity_whatsapp', label: 'WhatsApp no CRM' },
  { value: 'crm_activity_email', label: 'E-mail no CRM' },
  { value: 'crm_activity_follow_up', label: 'retorno no CRM' },
  { value: 'crm_activity_meeting', label: 'Reuniao no CRM' },
  { value: 'crm_activity_proposal_sent', label: 'Proposta enviada' },
  { value: 'crm_deal_updated', label: 'oportunidade atualizado' },
  { value: 'crm_deal_won', label: 'Venda ganha' },
  { value: 'crm_deal_lost', label: 'Venda perdida' },
  { value: 'pipeline_next_action_created', label: 'Próxima ação criada' },
  { value: 'pipeline_overdue_action_resolved', label: 'Pendencia resolvida' },
  { value: 'manual_kpi_entry', label: 'Registro manual de ação' },
]

const emptyForm = {
  name: '',
  description: '',
  source: 'crm',
  sourceEvent: 'crm_activity_follow_up',
  period: 'monthly',
  targetDaily: '0',
  targetWeekly: '0',
  targetMonthly: '0',
  unit: 'acoes',
  pointsPerUnit: '1',
  alertTolerance: '10',
  calculationType: 'sum',
}

function targetForPeriod(kpi: Kpi) {
  if (kpi.period === 'daily') return kpi.targetDaily
  if (kpi.period === 'weekly') return kpi.targetWeekly
  return kpi.targetMonthly || kpi.target
}

export default function ConfiguracaoKpisPage() {
  const { user } = useRequiredAuth()
  const router = useRouter()
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const loadKpis = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kpis', { credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar indicadores')
      setKpis(data.kpis ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar indicadores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user.role === 'seller') {
      router.replace('/performance/indicadores')
      setLoading(false)
      return
    }
    loadKpis()
  }, [loadKpis, router, user.role])

  const summary = useMemo(() => {
    const automatic = kpis.filter((kpi) => kpi.source !== 'manual').length
    const withEvent = kpis.filter((kpi) => kpi.sourceEvent).length
    return { automatic, withEvent, total: kpis.length }
  }, [kpis])

  const createKpi = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do indicador')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          source: form.source,
          sourceEvent: form.source === 'manual' ? 'manual_kpi_entry' : form.sourceEvent,
          period: form.period,
          targetDaily: form.targetDaily,
          targetWeekly: form.targetWeekly,
          targetMonthly: form.targetMonthly,
          unit: form.unit,
          pointsPerUnit: form.pointsPerUnit,
          alertTolerance: form.alertTolerance,
          calculationType: form.calculationType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar indicador')
      toast.success('Indicador criado')
      setForm(emptyForm)
      await loadKpis()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar indicador')
    } finally {
      setSaving(false)
    }
  }

  const deactivateKpi = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/kpis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, action: 'deactivate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao remover indicador')
      setKpis((prev) => prev.filter((kpi) => kpi.id !== id))
      toast.success('Indicador removido')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover indicador')
    } finally {
      setSaving(false)
    }
  }

  if (user.role === 'seller') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Indicadores de execução</h1>
            <p className="text-sm text-muted-foreground">Indicadores sao metas operacionais criadas pelo gestor para medir a execução comercial.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadKpis} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Indicadores ativos</p>
            <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Automaticos</p>
            <p className="mt-1 text-2xl font-semibold">{summary.automatic}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Com evento de origem</p>
            <p className="mt-1 text-2xl font-semibold">{summary.withEvent}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Novo indicador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="retornos realizados" />
            </div>
            <div className="space-y-2">
              <Label>Fonte</Label>
              <Select value={form.source} onValueChange={(value) => value && setForm({ ...form, source: value, sourceEvent: value === 'manual' ? 'manual_kpi_entry' : form.sourceEvent })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="crm">CRM automatico</SelectItem>
                  <SelectItem value="manual">Registro manual</SelectItem>
                  <SelectItem value="pdi">PDI</SelectItem>
                  <SelectItem value="commission">Comissionamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Evento que alimenta o KPI</Label>
              <Select value={form.sourceEvent} onValueChange={(value) => value && setForm({ ...form, sourceEvent: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((event) => (
                    <SelectItem key={event.value} value={event.value}>{event.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cálculo</Label>
              <Select value={form.calculationType} onValueChange={(value) => value && setForm({ ...form, calculationType: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sum">Soma</SelectItem>
                  <SelectItem value="count">Contagem</SelectItem>
                  <SelectItem value="average">Média</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Critério operacional do indicador" />

          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Meta dia</Label>
              <Input type="number" min="0" value={form.targetDaily} onChange={(event) => setForm({ ...form, targetDaily: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Meta semana</Label>
              <Input type="number" min="0" value={form.targetWeekly} onChange={(event) => setForm({ ...form, targetWeekly: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Meta mes</Label>
              <Input type="number" min="0" value={form.targetMonthly} onChange={(event) => setForm({ ...form, targetMonthly: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>XP por unidade</Label>
              <Input type="number" min="0" value={form.pointsPerUnit} onChange={(event) => setForm({ ...form, pointsPerUnit: event.target.value })} />
            </div>
          </div>

          <Button onClick={createKpi} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Salvando...' : 'Criar indicador'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Carregando indicadores...</CardContent></Card>
        ) : kpis.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum indicador configurado.</CardContent></Card>
        ) : (
          kpis.map((kpi) => {
            const target = targetForPeriod(kpi)
            const pct = target > 0 ? Math.min(100, Math.round((kpi.current / target) * 100)) : 0
            return (
              <Card key={kpi.id}>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{kpi.name}</h2>
                        <Badge variant="secondary">{kpi.source === 'manual' ? 'manual' : 'automatico'}</Badge>
                        {kpi.sourceEvent && <Badge variant="outline">{kpi.sourceEvent}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{kpi.description || 'Sem descricao operacional.'}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deactivateKpi(kpi.id)} disabled={saving}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Atual</p>
                      <p className="text-sm font-semibold">{kpi.current.toLocaleString('pt-BR')} {kpi.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Meta do período</p>
                      <p className="text-sm font-semibold">{target.toLocaleString('pt-BR')} {kpi.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Período</p>
                      <p className="text-sm font-semibold">{kpi.period}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Recompensa</p>
                      <p className="text-sm font-semibold">{kpi.pointsPerUnit} XP/{kpi.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={pct} className="h-2" />
                    <span className="w-12 text-right text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
