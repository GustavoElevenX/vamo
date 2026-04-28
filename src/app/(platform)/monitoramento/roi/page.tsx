'use client'

import { useEffect, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  TrendingUp,
  Clock,
  BarChart3,
  Users,
  RefreshCw,
  Info,
  Sparkles,
  CheckCircle2,
  Calculator,
  Zap,
} from 'lucide-react'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'

interface RoiData {
  receita_missoes: number
  produtividade: number
  retencao_equipe: number
  investimento: number
  roi_total: number
  roi_multiplier: number
  roi_percent: number
  breakdown: {
    missions_completed: number
    bonus_por_missao: number
    revenue_multiplier: number
    total_sellers: number
    active_users: number
    engagement_rate: number
    distinct_kpi_days: number
    hours_saved_per_day: number
    manager_hourly_rate: number
    rotacoes_evitadas: number
    cost_per_hire: number
    badges_earned: number
    period_days: number
    platform_monthly_cost: number
  }
  methodology: {
    receita_missoes: string
    produtividade: string
    retencao_equipe: string
    investimento: string
    roi: string
  }
  period_label: string
  period_days: number
  generated_at: string
}

export default function ROIPage() {
  useRequiredAuth()
  const [loading, setLoading] = useState(true)
  const [roi, setRoi] = useState<RoiData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMethodology, setShowMethodology] = useState(false)

  const fetchRoi = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/roi/calculate', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Erro ao carregar dados')
      const data = await res.json()
      setRoi(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRoi() }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !roi) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">{error ?? 'Sem dados disponíveis'}</p>
        <Button size="sm" variant="outline" onClick={fetchRoi}>Tentar novamente</Button>
      </div>
    )
  }

  const pillars = [
    {
      label: 'Receita de Missões',
      value: roi.receita_missoes,
      icon: Zap,
      color: 'stat-icon-green',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/5 border-emerald-500/20',
      desc: `${roi.breakdown.missions_completed} missões completas × R$ ${roi.breakdown.bonus_por_missao} bônus`,
      formula: roi.methodology.receita_missoes,
      sign: '+',
    },
    {
      label: 'Produtividade',
      value: roi.produtividade,
      icon: Clock,
      color: 'stat-icon-blue',
      textColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/5 border-blue-500/20',
      desc: `${roi.breakdown.distinct_kpi_days} dias com KPIs × ${roi.breakdown.hours_saved_per_day}h economizadas`,
      formula: roi.methodology.produtividade,
      sign: '+',
    },
    {
      label: 'Retenção de Equipe',
      value: roi.retencao_equipe,
      icon: Users,
      color: 'stat-icon-violet',
      textColor: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-500/5 border-violet-500/20',
      desc: `${roi.breakdown.engagement_rate}% engajamento → ${roi.breakdown.rotacoes_evitadas} rotação evitada`,
      formula: roi.methodology.retencao_equipe,
      sign: '+',
    },
    {
      label: 'Investimento Plataforma',
      value: roi.investimento,
      icon: DollarSign,
      color: 'stat-icon-rose',
      textColor: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-500/5 border-rose-500/20',
      desc: `R$ ${roi.breakdown.platform_monthly_cost}/mês × ${(roi.period_days / 30).toFixed(1)} meses`,
      formula: roi.methodology.investimento,
      sign: '÷',
    },
  ]

  const updatedAt = new Date(roi.generated_at).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        label="Monitoramento"
        labelIcon={<DollarSign className="h-3 w-3" />}
        title={<>ROI da <TitleHighlight>Plataforma</TitleHighlight></>}
        description={`Baseado em dados reais · ${roi.period_label} · Atualizado ${updatedAt}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={fetchRoi}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowMethodology(v => !v)}>
              <Info className="h-3.5 w-3.5 mr-1.5" />
              {showMethodology ? 'Ocultar' : 'Como é calculado'}
            </Button>
          </>
        }
      />

      {/* Hero ROI */}
      <Card className={cn(
        'border-emerald-500/25 overflow-hidden relative',
        'bg-gradient-to-br from-emerald-500/8 via-background to-background'
      )}>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                Retorno sobre investimento · {roi.period_label}
              </p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-6xl font-black text-emerald-500 dark:text-emerald-400 tabular-nums leading-none">
                  {roi.roi_multiplier}×
                </span>
                <div>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    +{roi.roi_percent}% de retorno
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Para cada R$ 1 investido
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-1">
              <p className="text-xs text-muted-foreground">Valor total gerado</p>
              <p className="text-3xl font-black tabular-nums">
                R$ {roi.roi_total.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground">
                sobre R$ {roi.investimento.toLocaleString('pt-BR')} investidos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Missões Completas',
            value: roi.breakdown.missions_completed,
            sub: `+${roi.breakdown.badges_earned} badges no período`,
            icon: Sparkles,
            color: 'stat-icon-amber',
          },
          {
            label: 'Taxa de Engajamento',
            value: `${roi.breakdown.engagement_rate}%`,
            sub: `${roi.breakdown.active_users} de ${roi.breakdown.total_sellers} vendedores ativos`,
            icon: TrendingUp,
            color: 'stat-icon-green',
          },
          {
            label: 'Dias com KPIs',
            value: roi.breakdown.distinct_kpi_days,
            sub: `de ${roi.period_days} dias no período`,
            icon: BarChart3,
            color: 'stat-icon-blue',
          },
          {
            label: 'Custo Plataforma',
            value: `R$ ${roi.investimento.toLocaleString('pt-BR')}`,
            sub: `R$ ${roi.breakdown.platform_monthly_cost}/mês`,
            icon: DollarSign,
            color: 'stat-icon-rose',
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                    {label}
                  </p>
                  <p className="text-2xl font-black tabular-nums">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
                </div>
                <div className={cn('stat-icon h-10 w-10 shrink-0', color)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fórmula visual */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4 text-violet-500" />
            Fórmula do Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-3 flex-wrap">
            {pillars.map((p, i) => {
              const Icon = p.icon
              return (
                <div key={p.label} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className="text-xl font-bold text-muted-foreground/50">
                      {p.sign}
                    </span>
                  )}
                  <div className={cn(
                    'text-center p-3 rounded-xl border min-w-[100px]',
                    p.bgColor
                  )}>
                    <div className={cn('stat-icon h-7 w-7 mx-auto mb-1.5', p.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">{p.label}</p>
                    <p className={cn('text-base font-black tabular-nums', p.textColor)}>
                      R$ {p.value.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              )
            })}
            <span className="text-xl font-bold text-muted-foreground/50">=</span>
            <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 min-w-[100px]">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1">ROI</p>
              <p className="text-3xl font-black text-emerald-500 dark:text-emerald-400 tabular-nums">
                {roi.roi_multiplier}×
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento por pilar */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Detalhamento por Pilar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pillars.map((p) => {
            const Icon = p.icon
            const share = roi.roi_total > 0
              ? Math.round((p.value / roi.roi_total) * 100)
              : 0
            return (
              <div key={p.label} className={cn('p-4 rounded-xl border', p.bgColor)}>
                <div className="flex items-center gap-3">
                  <div className={cn('stat-icon h-9 w-9 shrink-0', p.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{p.label}</p>
                      <div className="flex items-center gap-2">
                        {p.sign !== '÷' && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {share}% do total
                          </span>
                        )}
                        <span className={cn('text-base font-black tabular-nums', p.textColor)}>
                          {p.sign === '÷' ? '÷' : '+'} R$ {p.value.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                    {p.sign !== '÷' && (
                      <div className="mt-2 h-1.5 w-full rounded-full bg-black/8 dark:bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${share}%`,
                            background: p.label === 'Receita de Missões'
                              ? 'oklch(0.55 0.18 145)'
                              : p.label === 'Produtividade'
                                ? 'oklch(0.60 0.18 215)'
                                : 'oklch(0.60 0.18 290)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Metodologia (expansível) */}
      {showMethodology && (
        <Card className="border-border/50 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              Metodologia de Cálculo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              O ROI é calculado com base em <strong>dados reais do banco</strong>. Os multiplicadores
              usam valores padrão conservadores e podem ser ajustados em{' '}
              <code className="px-1 py-0.5 rounded bg-muted text-[11px]">
                organizations.settings.roi_config
              </code>.
            </p>

            <div className="space-y-3">
              {Object.entries(roi.methodology).map(([key, formula]) => {
                const labels: Record<string, string> = {
                  receita_missoes:  'Receita de Missões',
                  produtividade:    'Produtividade',
                  retencao_equipe:  'Retenção de Equipe',
                  investimento:     'Investimento',
                  roi:              'ROI Final',
                }
                return (
                  <div key={key} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-foreground">{labels[key]}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{formula}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-3 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                <strong>Premissas padrão:</strong>{' '}
                R$ {roi.breakdown.platform_monthly_cost}/mês plataforma ·{' '}
                {roi.breakdown.hours_saved_per_day}h economizadas/dia ·{' '}
                R$ {roi.breakdown.manager_hourly_rate}/h custo operacional ·{' '}
                R$ {roi.breakdown.cost_per_hire.toLocaleString('pt-BR')} custo por contratação.
                Para usar valores reais da sua empresa, configure{' '}
                <code className="px-1 py-0.5 rounded bg-muted text-[10px]">roi_config</code> na tabela organizations.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom CTA */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Aumente o ROI
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                O maior impacto vem de <strong>missões completadas</strong>.
                Cada nova missão concluída adiciona diretamente R$ {roi.breakdown.bonus_por_missao} ao retorno.
                Com {roi.breakdown.total_sellers} vendedores, 10 missões extras por pessoa geram
                {' '}R$ {(roi.breakdown.total_sellers * 10 * roi.breakdown.bonus_por_missao).toLocaleString('pt-BR')} adicionais.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
