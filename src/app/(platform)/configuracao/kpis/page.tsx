'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { clearCache, getCached, setCache } from '@/lib/cache'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  BarChart3,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  Trash2,
} from 'lucide-react'
import type { PerformanceInsight } from '@/lib/services/performance-insights.service'

interface KPI {
  id: string
  name: string
  source: 'CRM' | 'manual'
  target: number
  current: number
  unit: string
  alertTolerance: number
  active: boolean
}

const MAX_KPIS = 5
const INSIGHT_CACHE_TTL = 60 * 1000

function getKpiStatus(kpi: KPI): 'verde' | 'amarelo' | 'vermelho' {
  if (kpi.target === 0) return 'amarelo'
  const ratio = kpi.current / kpi.target
  if (ratio >= 1) return 'verde'
  if (ratio >= 1 - kpi.alertTolerance / 100) return 'amarelo'
  return 'vermelho'
}

function StatusDot({ status }: { status: 'verde' | 'amarelo' | 'vermelho' }) {
  const colors = {
    verde: 'bg-emerald-500',
    amarelo: 'bg-amber-500',
    vermelho: 'bg-red-500',
  }
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status]}`} />
}

function StatusBadge({ status }: { status: 'verde' | 'amarelo' | 'vermelho' }) {
  const variants = {
    verde: 'bg-emerald-500/10 text-emerald-600 border-0',
    amarelo: 'bg-amber-500/10 text-amber-600 border-0',
    vermelho: 'bg-red-500/10 text-red-600 border-0',
  }
  const labels = { verde: 'No alvo', amarelo: 'Atenção', vermelho: 'Abaixo' }
  return (
    <Badge className={`text-[10px] h-5 px-2 ${variants[status]}`}>
      {labels[status]}
    </Badge>
  )
}

export default function KpisPage() {
  const { user } = useRequiredAuth()
  const [kpis, setKpis] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiAccepted, setAiAccepted] = useState(false)
  const [aiInsight, setAiInsight] = useState<PerformanceInsight | null>(null)
  const [aiInsightLoading, setAiInsightLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newKpi, setNewKpi] = useState({
    name: '',
    source: 'manual' as 'CRM' | 'manual',
    target: '',
    unit: '',
  })

  const activeCount = kpis.filter((k) => k.active).length

  const fetchKpis = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch('/api/kpis', { credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar KPIs')
      setKpis(data.kpis ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar KPIs')
      setKpis([])
    } finally {
      setLoading(false)
    }
  }, [user])

  const fetchAiInsight = useCallback(async (force = false) => {
    if (!user) return
    const cacheKey = `performance-insight:${user.organization_id}`
    if (!force) {
      const cached = getCached<PerformanceInsight>(cacheKey)
      if (cached) {
        setAiInsight(cached)
        setAiInsightLoading(false)
        return
      }
    }

    setAiInsightLoading(true)
    try {
      const res = await fetch('/api/ai/performance-insights', { credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar sugestão')
      setAiInsight(data.insight)
      setCache(cacheKey, data.insight, INSIGHT_CACHE_TTL)
    } catch {
      setAiInsight({
        status: 'needs_diagnostic',
        title: 'Sugestão indisponível',
        message:
          'Não foi possível validar dados reais agora. Faça ou revise o diagnóstico antes de aceitar qualquer sugestão de KPI.',
        confidence: 'baixa',
        source: { activeKpis: activeCount, activeMissions: 0, recentKpiEntries: 0 },
      })
    } finally {
      setAiInsightLoading(false)
    }
  }, [user, activeCount])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  useEffect(() => {
    fetchAiInsight()
  }, [fetchAiInsight])

  const addKpi = async (input: typeof newKpi, successMessage = 'KPI adicionado com sucesso') => {
    if (!user || !input.name || !input.target || activeCount >= MAX_KPIS) return
    setSaving(true)
    try {
      const res = await fetch('/api/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: input.name,
          source: input.source,
          target: input.target,
          unit: input.unit || 'unid.',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar KPI')
      setNewKpi({ name: '', source: 'manual', target: '', unit: '' })
      setDialogOpen(false)
      toast.success(successMessage)
      clearCache(`performance-insight:${user.organization_id}`)
      await fetchKpis()
      await fetchAiInsight(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar KPI')
    } finally {
      setSaving(false)
    }
  }

  const handleAddKpi = async () => {
    await addKpi(newKpi)
  }

  const handleAcceptAiSuggestion = async () => {
    const recommendation = aiInsight?.kpiRecommendation
    if (!recommendation) return
    if (activeCount >= MAX_KPIS) {
      toast.error('Limite de KPIs ativos atingido')
      return
    }

    await addKpi(
      {
        name: recommendation.name,
        source: recommendation.source,
        target: String(recommendation.monthlyTarget),
        unit: recommendation.unit,
      },
      'KPI sugerido pela IA adicionado'
    )
    setAiAccepted(true)
  }

  const handleRemoveKpi = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/kpis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, action: 'deactivate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao remover KPI')
      setKpis((prev) => prev.filter((k) => k.id !== id))
      toast.success('KPI removido')
      clearCache(`performance-insight:${user.organization_id}`)
      await fetchAiInsight(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover KPI')
    } finally {
      setSaving(false)
    }
  }

  const handleToleranceChange = (id: string, value: string) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0))
    setKpis((prev) => prev.map((k) => (k.id === id ? { ...k, alertTolerance: num } : k)))
  }

  const handleSaveTolerances = async () => {
    if (!user) return
    setSaving(true)
    try {
      await Promise.all(
        kpis.map((kpi) =>
          fetch('/api/kpis', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              id: kpi.id,
              target: kpi.target,
              alertTolerance: kpi.alertTolerance,
              source: kpi.source,
            })
          }).then(async (res) => {
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
          })
        )
      )
      toast.success('Configurações salvas')
      clearCache(`performance-insight:${user.organization_id}`)
      await fetchAiInsight(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">KPIs</h2>
              <Badge variant="outline" className="text-[10px] h-5 px-2">
                Etapa 3
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Indicadores que serão acompanhados ao longo do ciclo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/50 px-3 py-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">
              {activeCount}/{MAX_KPIS} KPIs ativos
            </span>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button size="sm" className="h-8 text-xs" disabled={activeCount >= MAX_KPIS}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Adicionar KPI
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo KPI</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="kpi-name">Nome do indicador</Label>
                  <Input
                    id="kpi-name"
                    placeholder="Ex: Taxa de conversão"
                    value={newKpi.name}
                    onChange={(e) => setNewKpi({ ...newKpi, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fonte de dados</Label>
                  <Select
                    value={newKpi.source}
                    onValueChange={(v) => setNewKpi({ ...newKpi, source: v as 'CRM' | 'manual' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CRM">CRM (automático)</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="kpi-target">Meta mensal</Label>
                    <Input
                      id="kpi-target"
                      type="number"
                      placeholder="100"
                      value={newKpi.target}
                      onChange={(e) => setNewKpi({ ...newKpi, target: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kpi-unit">Unidade</Label>
                    <Input
                      id="kpi-unit"
                      placeholder="%, R$, unid."
                      value={newKpi.unit}
                      onChange={(e) => setNewKpi({ ...newKpi, unit: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddKpi} className="w-full" disabled={saving}>
                  {saving ? 'Adicionando...' : 'Adicionar KPI'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* AI Suggestion */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{aiInsight?.title ?? 'Insight de performance'}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {aiInsightLoading
                  ? 'Analisando diagnóstico, KPIs e missões para sugerir somente com base em dados reais...'
                  : aiInsight?.message}
              </p>

              {aiInsight?.source?.diagnosticId && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[10px] border-0">
                    Fonte: diagnóstico {aiInsight.source.diagnosticDate ? new Date(aiInsight.source.diagnosticDate).toLocaleDateString('pt-BR') : ''}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] border-0">
                    Gargalo: {aiInsight.source.weakestArea} ({aiInsight.source.weakestAreaPct}%)
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] border-0">
                    Score geral: {aiInsight.source.healthPct}%
                  </Badge>
                </div>
              )}

              {!aiInsightLoading && aiInsight?.status === 'needs_diagnostic' && (
                <Button
                  size="sm"
                  className="h-7 text-xs mt-3"
                  render={<Link href="/diagnostico/novo" />}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                  Fazer diagnóstico
                </Button>
              )}

              {!aiInsightLoading && aiInsight?.status === 'ready' && aiInsight.kpiRecommendation && !aiAccepted && (
                <Button
                  size="sm"
                  className="h-7 text-xs mt-3"
                  onClick={handleAcceptAiSuggestion}
                  disabled={saving || activeCount >= MAX_KPIS}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Adicionar KPI sugerido
                </Button>
              )}

              {!aiInsightLoading && aiInsight?.status === 'ready' && !aiInsight.kpiRecommendation && (
                <div className="flex items-center gap-1.5 mt-3 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">KPI principal já configurado</span>
                </div>
              )}

              {aiAccepted && (
                <div className="flex items-center gap-1.5 mt-3 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Sugestão aplicada com base no diagnóstico</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="space-y-3">
        {kpis.map((kpi) => {
          const status = getKpiStatus(kpi)
          const ratio = kpi.target > 0 ? Math.min(100, Math.round((kpi.current / kpi.target) * 100)) : 0

          return (
            <Card key={kpi.id} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StatusDot status={status} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{kpi.name}</p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Fonte: {kpi.source} · Meta: {kpi.target.toLocaleString('pt-BR')} {kpi.unit}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {kpi.current.toLocaleString('pt-BR')}
                        <span className="text-xs font-normal text-muted-foreground ml-1">{kpi.unit}</span>
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {status === 'verde' ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className="text-[11px] text-muted-foreground">{ratio}% da meta</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Separator orientation="vertical" className="h-8 hidden sm:block" />
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">Alerta se cair</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          className="h-7 w-14 text-xs text-center"
                          value={kpi.alertTolerance}
                          onChange={(e) => handleToleranceChange(kpi.id, e.target.value)}
                          min={0}
                          max={100}
                        />
                        <Percent className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">abaixo da meta</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() => handleRemoveKpi(kpi.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty state */}
      {kpis.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum KPI configurado. Adicione indicadores para acompanhar o desempenho.
          </p>
        </div>
      )}

      {/* Save button */}
      {kpis.length > 0 && (
        <Button onClick={handleSaveTolerances} className="w-full" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      )}
    </div>
  )
}
