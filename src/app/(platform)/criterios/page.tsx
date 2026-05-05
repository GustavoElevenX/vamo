'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Activity, BarChart3, Bell, DollarSign, Heart, Plus, Save, ShieldCheck, Trash2, Trophy } from 'lucide-react'

type Tab = 'kpis' | 'comissionamento' | 'avaliacoes' | 'alertas' | 'bemestar' | 'gamificacao'

interface KpiRow {
  id?: string
  name: string
  unit: string
  source: 'manual' | 'CRM'
  target: string
  alertTolerance: string
  pointsPerUnit: string
}

interface AlertRow {
  id: string
  label: string
  enabled: boolean
  value: string
  value2?: string
  unit: string
  unit2?: string
}

interface CriteriaState {
  evaluationMode: 'automatic' | 'mixed' | 'manual'
  alerts: AlertRow[]
  wellbeing: {
    pulseFrequency: 'semanal' | 'quinzenal'
    criticalIndex: string
    absenceDays: string
  }
}

interface CommissionState {
  aliquota_base: number
  acelerador_threshold: number
  acelerador_rate: number
  bonus_missao: number
  bonus_kpi: number
  salario_base: number
  periodo: 'mensal' | 'quinzenal' | 'semanal'
  elegibilidade: number
}

interface GamificationState {
  ranking_publico: boolean
  badges_no_feed: boolean
  level_titles: string[]
}

interface CriteriaResponse {
  kpis: KpiRow[]
  commission: CommissionState
  criteria: CriteriaState
  gamification: GamificationState
}

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'kpis', label: 'KPIs', icon: BarChart3 },
  { key: 'comissionamento', label: 'Comissao', icon: DollarSign },
  { key: 'avaliacoes', label: 'Avaliacoes', icon: ShieldCheck },
  { key: 'alertas', label: 'Alertas', icon: Bell },
  { key: 'bemestar', label: 'Bem-estar', icon: Heart },
  { key: 'gamificacao', label: 'Gamificacao', icon: Trophy },
]

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`} />
    </button>
  )
}

export default function CriteriosPage() {
  const { user } = useRequiredAuth()
  const [activeTab, setActiveTab] = useState<Tab>('kpis')
  const [kpis, setKpis] = useState<KpiRow[]>([])
  const [removedKpiIds, setRemovedKpiIds] = useState<string[]>([])
  const [commission, setCommission] = useState<CommissionState | null>(null)
  const [criteria, setCriteria] = useState<CriteriaState | null>(null)
  const [gamification, setGamification] = useState<GamificationState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/platform/criteria', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Erro ao carregar criterios')
      const data = await res.json() as CriteriaResponse
      setKpis(data.kpis)
      setCommission(data.commission)
      setCriteria(data.criteria)
      setGamification(data.gamification)
      setRemovedKpiIds([])
    } catch {
      toast.error('Nao foi possivel carregar criterios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  const patchKpi = (index: number, patch: Partial<KpiRow>) => {
    setKpis((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  const removeKpi = (index: number) => {
    setKpis((prev) => {
      const item = prev[index]
      if (item?.id) setRemovedKpiIds((ids) => [...ids, item.id as string])
      return prev.filter((_, i) => i !== index)
    })
  }

  const addKpi = () => {
    if (kpis.length >= 5) {
      toast.warning('Limite de 5 KPIs ativos atingido.')
      return
    }
    setKpis((prev) => [...prev, { name: '', unit: 'unid.', source: 'manual', target: '', alertTolerance: '10', pointsPerUnit: '1' }])
  }

  const save = async () => {
    if (!commission || !criteria || !gamification) return
    setSaving(true)
    try {
      const res = await fetch('/api/platform/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpis, removedKpiIds, commission, criteria, gamification }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao salvar')
      }
      toast.success('Criterios salvos e conectados a plataforma.')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar.')
    } finally {
      setSaving(false)
    }
  }

  const kpisValid = useMemo(() => kpis.filter((kpi) => kpi.name.trim() && Number(kpi.target) > 0).length, [kpis])
  const enabledAlerts = criteria?.alerts.filter((alert) => alert.enabled).length ?? 0

  if (loading || !commission || !criteria || !gamification) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-2 text-[10px]">Configuracao operacional</Badge>
          <h2 className="text-xl font-semibold tracking-tight">Criterios da Plataforma</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Define como metas, XP, comissao, alertas e saude da equipe conversam entre si.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar tudo'}
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{kpisValid}/5</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">KPIs validos</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{commission.aliquota_base}%</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissao base</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{enabledAlerts}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Alertas ativos</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="mt-1 text-sm font-bold capitalize text-emerald-500">{criteria.evaluationMode}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avaliacao</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex w-full gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'kpis' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">KPIs ativos alimentam indicadores, ranking, alertas e missoes.</p>
            <Button size="sm" variant="outline" onClick={addKpi}>
              <Plus className="h-3.5 w-3.5" />
              Adicionar KPI
            </Button>
          </div>
          <div className="space-y-3">
            {kpis.length === 0 && (
              <Card className="border-border/50">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum KPI ativo configurado.</CardContent>
              </Card>
            )}
            {kpis.map((kpi, index) => (
              <Card key={kpi.id ?? index} className="border-border/50">
                <CardContent className="grid gap-3 py-4 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_auto]">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome</Label>
                    <Input value={kpi.name} onChange={(event) => patchKpi(index, { name: event.target.value })} placeholder="Ex: Receita mensal" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meta mensal</Label>
                    <Input value={kpi.target} onChange={(event) => patchKpi(index, { target: event.target.value })} inputMode="decimal" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unidade</Label>
                    <Input value={kpi.unit} onChange={(event) => patchKpi(index, { unit: event.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fonte</Label>
                    <select value={kpi.source} onChange={(event) => patchKpi(index, { source: event.target.value as 'manual' | 'CRM' })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                      <option value="manual">Manual</option>
                      <option value="CRM">CRM</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="icon-sm" onClick={() => removeKpi(index)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'comissionamento' && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['Aliquota base (%)', 'aliquota_base'],
            ['Acelerador a partir de (%)', 'acelerador_threshold'],
            ['Aliquota acelerada (%)', 'acelerador_rate'],
            ['Bonus por missao (R$)', 'bonus_missao'],
            ['Bonus por KPI batido (R$)', 'bonus_kpi'],
            ['Elegibilidade minima (%)', 'elegibilidade'],
          ].map(([label, key]) => (
            <Card key={key} className="border-border/50">
              <CardContent className="space-y-1.5 py-4">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  value={String(commission[key as keyof CommissionState])}
                  onChange={(event) => setCommission((prev) => prev ? { ...prev, [key]: Number(event.target.value) } : prev)}
                />
              </CardContent>
            </Card>
          ))}
          <Card className="border-border/50 md:col-span-2">
            <CardContent className="space-y-1.5 py-4">
              <Label className="text-xs">Periodo de apuracao</Label>
              <div className="flex gap-2">
                {(['mensal', 'quinzenal', 'semanal'] as const).map((periodo) => (
                  <Button key={periodo} variant={commission.periodo === periodo ? 'default' : 'outline'} onClick={() => setCommission({ ...commission, periodo })}>
                    {periodo}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'avaliacoes' && (
        <div className="grid gap-3">
          {[
            { id: 'automatic', title: 'Automatica', desc: 'Eventos comprovados concluem missoes sem validacao manual.' },
            { id: 'mixed', title: 'Mista', desc: 'Evento cria evidencia e gestor valida qualidade quando necessario.' },
            { id: 'manual', title: 'Manual', desc: 'Gestor confirma conclusao e qualidade diretamente.' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setCriteria({ ...criteria, evaluationMode: mode.id as CriteriaState['evaluationMode'] })}
              className={`rounded-lg border p-4 text-left transition-colors ${
                criteria.evaluationMode === mode.id ? 'border-primary/40 bg-primary/5' : 'border-border/50 hover:bg-accent/20'
              }`}
            >
              <p className="text-sm font-semibold">{mode.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{mode.desc}</p>
            </button>
          ))}
        </div>
      )}

      {activeTab === 'alertas' && (
        <div className="space-y-3">
          {criteria.alerts.map((alert, index) => (
            <Card key={alert.id} className={`border-border/50 ${!alert.enabled ? 'opacity-60' : ''}`}>
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                <Toggle
                  enabled={alert.enabled}
                  onChange={(enabled) => setCriteria({
                    ...criteria,
                    alerts: criteria.alerts.map((item, i) => i === index ? { ...item, enabled } : item),
                  })}
                />
                <Input
                  className="w-20"
                  value={alert.value}
                  onChange={(event) => setCriteria({
                    ...criteria,
                    alerts: criteria.alerts.map((item, i) => i === index ? { ...item, value: event.target.value } : item),
                  })}
                />
                <span className="text-xs text-muted-foreground">{alert.unit}</span>
                {alert.value2 !== undefined && (
                  <>
                    <Input
                      className="w-20"
                      value={alert.value2}
                      onChange={(event) => setCriteria({
                        ...criteria,
                        alerts: criteria.alerts.map((item, i) => i === index ? { ...item, value2: event.target.value } : item),
                      })}
                    />
                    <span className="text-xs text-muted-foreground">{alert.unit2}</span>
                  </>
                )}
                <span className="text-sm">{alert.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'bemestar' && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50">
            <CardContent className="space-y-1.5 py-4">
              <Label className="text-xs">Pesquisa de pulso</Label>
              <select
                value={criteria.wellbeing.pulseFrequency}
                onChange={(event) => setCriteria({ ...criteria, wellbeing: { ...criteria.wellbeing, pulseFrequency: event.target.value as 'semanal' | 'quinzenal' } })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
              </select>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="space-y-1.5 py-4">
              <Label className="text-xs">Indice critico</Label>
              <Input value={criteria.wellbeing.criticalIndex} onChange={(event) => setCriteria({ ...criteria, wellbeing: { ...criteria.wellbeing, criticalIndex: event.target.value } })} />
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="space-y-1.5 py-4">
              <Label className="text-xs">Dias sem login para alerta</Label>
              <Input value={criteria.wellbeing.absenceDays} onChange={(event) => setCriteria({ ...criteria, wellbeing: { ...criteria.wellbeing, absenceDays: event.target.value } })} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'gamificacao' && (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardContent className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Ranking publico</p>
                  <p className="text-xs text-muted-foreground">Controla visibilidade do ranking para a equipe.</p>
                </div>
                <Toggle enabled={gamification.ranking_publico} onChange={(value) => setGamification({ ...gamification, ranking_publico: value })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Badges no feed</p>
                  <p className="text-xs text-muted-foreground">Publica conquistas no feed real da equipe.</p>
                </div>
                <Toggle enabled={gamification.badges_no_feed} onChange={(value) => setGamification({ ...gamification, badges_no_feed: value })} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Titulos dos niveis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              {gamification.level_titles.map((title, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</div>
                  <Input
                    value={title}
                    onChange={(event) => setGamification({
                      ...gamification,
                      level_titles: gamification.level_titles.map((item, i) => i === index ? event.target.value : item),
                    })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border/50 bg-muted/30">
        <CardContent className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Essas configuracoes sao usadas por Hoje, Indicadores, Missoes, Comissionamento, PDI e Logs.
        </CardContent>
      </Card>
    </div>
  )
}
