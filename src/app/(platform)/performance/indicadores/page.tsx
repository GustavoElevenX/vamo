'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import {
  ArrowRight,
  Brain,
  DollarSign,
  Minus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

type Trend = 'up' | 'down' | 'stable'

interface Indicator {
  id: string
  name: string
  unit: string
  current: number
  target: number
  previous: number
  delta: number
  pct: number
  trend: Trend
  status: string
  targetBonus: number
  projectedBonus: number
  source: string
}

interface IndicatorResponse {
  period: { label: string }
  indicators: Indicator[]
  focus: Indicator | null
}

function formatValue(value: number, unit: string) {
  if (unit === 'R$') return `R$ ${value.toLocaleString('pt-BR')}`
  return `${value.toLocaleString('pt-BR')}${unit && unit !== 'unid.' ? ` ${unit}` : ''}`
}

export default function IndicadoresPage() {
  const { user } = useRequiredAuth()
  const [data, setData] = useState<IndicatorResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    fetch('/api/performance/indicators', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao carregar indicadores')
        return res.json() as Promise<IndicatorResponse>
      })
      .then(setData)
      .catch(() => setData({ period: { label: 'ciclo atual' }, indicators: [], focus: null }))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const indicators = data?.indicators ?? []
  const focus = data?.focus ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        label="Desempenho"
        labelIcon={<Target className="h-3 w-3" />}
        title={<>Meus <TitleHighlight>Indicadores</TitleHighlight></>}
        description="Indicadores sao metas operacionais configuradas pelo gestor para medir sua execucao comercial."
        actions={<span className="pill-glow">{data?.period.label ?? 'Ciclo atual'}</span>}
      />

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Indicador mede.</strong> Aqui aparecem metas diarias, semanais ou mensais configuradas pelo gestor. Desempenho e a leitura geral da Vamo sobre resultado, execução, funil e risco comercial.
        </CardContent>
      </Card>

      {indicators.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center">
            <Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Nenhum indicador ativo configurado pelo gestor.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Assim que houver indicadores ativos, você vera meta, executado, restante e fonte do indicador.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {indicators.map((kpi) => {
            const pct = Math.min(100, kpi.pct)
            const statusColor =
              kpi.pct >= 100 ? 'text-emerald-500' : kpi.pct >= 70 ? 'text-blue-500' : kpi.pct >= 40 ? 'text-amber-500' : 'text-red-500'
            const progressColor =
              kpi.pct >= 100 ? '[&>div]:bg-emerald-500' : kpi.pct >= 70 ? '[&>div]:bg-blue-500' : kpi.pct >= 40 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'

            return (
              <Card key={kpi.id} className="border-border/50">
                <CardContent className="space-y-3 pt-4 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                        <Target className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{kpi.name}</p>
                        <p className="text-[10px] text-muted-foreground">Fonte do indicador: {kpi.source} | Configurado pelo gestor</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {kpi.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                      {kpi.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                      {kpi.trend === 'stable' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                        {kpi.pct}%
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Executado: {formatValue(kpi.current, kpi.unit)} / Meta: {formatValue(kpi.target, kpi.unit)}
                      </span>
                      <span className={`text-[10px] font-medium ${statusColor}`}>{kpi.status}</span>
                    </div>
                    <Progress value={pct} className={`h-2 ${progressColor}`} />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Restante: {formatValue(Math.max(0, kpi.target - kpi.current), kpi.unit)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>Ciclo anterior: {formatValue(kpi.previous, kpi.unit)}</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                    <span>Atual: {formatValue(kpi.current, kpi.unit)}</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                    <span className={kpi.delta >= 0 ? 'font-medium text-emerald-500' : 'font-medium text-red-500'}>
                      {kpi.delta >= 0 ? '+' : ''}{formatValue(kpi.delta, kpi.unit)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-accent/20 px-3 py-2">
                    <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <p className="text-[11px] text-muted-foreground">
                      Meta batida libera até <span className="font-medium text-emerald-500">R$ {kpi.targetBonus.toLocaleString('pt-BR')}</span> no modelo atual de ganhos.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {focus && (
        <Card className="border-l-4 border-l-blue-500 border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Brain className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Foco recomendado para hoje</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Priorize <strong className="text-foreground">{focus.name}</strong>: e o indicador com melhor relacao entre meta restante e potencial de recompensa neste ciclo.
                </p>
                <Button size="sm" variant="outline" className="mt-2 h-7 gap-1.5 text-xs" render={<Link href="/performance/missoes" />}>
                  <Sparkles className="h-3 w-3" />
                  Ver missões relacionadas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
