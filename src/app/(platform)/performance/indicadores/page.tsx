'use client'

import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  DollarSign,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

const MY_KPIS = [
  { name: 'Taxa de Fechamento', current: 22, target: 35, unit: '%', trend: 'up' as const, bonus: 400, startValue: 15, daysElapsed: 18 },
  { name: 'Ligacoes / Semana', current: 27, target: 40, unit: '', trend: 'up' as const, bonus: 200, startValue: 18, daysElapsed: 18 },
  { name: 'Ticket Medio', current: 7200, target: 9500, unit: 'R$', trend: 'stable' as const, bonus: 600, startValue: 6800, daysElapsed: 18 },
  { name: '% CRM Atualizado', current: 68, target: 95, unit: '%', trend: 'down' as const, bonus: 150, startValue: 72, daysElapsed: 18 },
]

export default function IndicadoresPage() {
  const { user } = useAuth()

  if (!user) return null

  // Find best KPI to focus on (highest bonus / easiest gap)
  const bestFocusKpi = MY_KPIS.reduce((best, kpi) => {
    const gapPct = 1 - (kpi.current / kpi.target)
    const score = kpi.bonus * (1 - gapPct)
    const bestScore = best.bonus * (1 - (1 - best.current / best.target))
    return score > bestScore ? kpi : best
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Meus Indicadores</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Acompanhe seus KPIs e metas</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">Marco 2026</Badge>
      </div>

      {/* KPI Cards */}
      <div className="space-y-4">
        {MY_KPIS.map((kpi) => {
          const pct = Math.min(100, Math.round((kpi.current / kpi.target) * 100))
          const isOnTrack = pct >= 70
          const isAtRisk = pct >= 40 && pct < 70
          const color = isOnTrack
            ? 'text-emerald-500 [&>div]:bg-emerald-500'
            : isAtRisk
            ? 'text-amber-500 [&>div]:bg-amber-500'
            : 'text-red-500 [&>div]:bg-red-500'
          const status = isOnTrack ? 'Meta em andamento' : isAtRisk ? 'Atencao' : 'Abaixo da meta'
          const statusColor = isOnTrack ? 'text-emerald-500' : isAtRisk ? 'text-amber-500' : 'text-red-500'

          // Temporal comparison
          const delta = kpi.current - kpi.startValue
          const deltaSign = delta >= 0 ? '+' : ''
          const deltaUnit = kpi.unit === 'R$' ? `R$ ${Math.abs(delta).toLocaleString('pt-BR')}` : `${Math.abs(delta)}${kpi.unit ? kpi.unit : ''}`
          const formatValue = (v: number) => kpi.unit === 'R$' ? `R$ ${v.toLocaleString('pt-BR')}` : `${v}${kpi.unit}`

          return (
            <Card key={kpi.name} className="border-border/50">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Target className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium">{kpi.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {kpi.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                    {kpi.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                    {kpi.trend === 'stable' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                    <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                      {pct}%
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">
                      {formatValue(kpi.current)} / {formatValue(kpi.target)}
                    </span>
                    <span className={`text-[10px] font-medium ${statusColor}`}>{status}</span>
                  </div>
                  <Progress value={pct} className={`h-2 ${color}`} />
                </div>

                {/* Temporal comparison */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>Inicio do ciclo: {formatValue(kpi.startValue)}</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                  <span>Hoje: {formatValue(kpi.current)}</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                  <span className={delta >= 0 ? 'text-emerald-500 font-medium' : 'text-red-500 font-medium'}>
                    {deltaSign}{deltaUnit} em {kpi.daysElapsed} dias
                  </span>
                </div>

                {/* Commission link */}
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-accent/20 px-3 py-2">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Se eu atingir {formatValue(kpi.target)} → <span className="text-emerald-500 font-medium">+R$ {kpi.bonus.toLocaleString('pt-BR')} de bonus este mes</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* AI Insight - more prominent */}
      <Card className="border-l-4 border-l-blue-500 border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Insight da IA — Foco de Hoje</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Para maximizar seus ganhos hoje, foque em <strong className="text-foreground">{bestFocusKpi.name}</strong>.
                Atingir a meta gera <strong className="text-emerald-500">+R$ {bestFocusKpi.bonus.toLocaleString('pt-BR')}</strong> em bonus.
                {' '}Manter o CRM atualizado acima de 90% desbloqueia o bonus de consistencia.
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs mt-2 gap-1.5" render={<Link href="/performance/missoes" />}>
                <Sparkles className="h-3 w-3" />
                Ver missoes relacionadas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
