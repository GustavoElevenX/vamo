'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  ArrowRight,
  BarChart3,
} from 'lucide-react'

interface FunnelStage {
  name: string
  beforeVolume: number
  currentVolume: number
  beforeConversion: number
  currentConversion: number
  isBottleneck: boolean
}

const FUNNEL_STAGES: FunnelStage[] = [
  { name: 'Leads', beforeVolume: 280, currentVolume: 347, beforeConversion: 100, currentConversion: 100, isBottleneck: false },
  { name: 'Qualificados', beforeVolume: 140, currentVolume: 198, beforeConversion: 50, currentConversion: 57, isBottleneck: false },
  { name: 'Propostas', beforeVolume: 63, currentVolume: 89, beforeConversion: 45, currentConversion: 45, isBottleneck: true },
  { name: 'Negociação', beforeVolume: 38, currentVolume: 52, beforeConversion: 60, currentConversion: 58, isBottleneck: false },
  { name: 'Fechamento', beforeVolume: 21, currentVolume: 31, beforeConversion: 55, currentConversion: 60, isBottleneck: false },
]

const VELOCITY_METRICS = [
  { label: 'Ciclo médio de venda', before: '32 dias', now: '24 dias', improved: true },
  { label: 'Proposta → Resposta', before: '5.2 dias', now: '3.1 dias', improved: true },
  { label: 'Lead → Qualificação', before: '8 dias', now: '6 dias', improved: true },
  { label: 'Negociação → Fechamento', before: '12 dias', now: '9 dias', improved: true },
]

export default function FunilPage() {
  const { user } = useAuth()

  if (!user) return null

  const maxVolume = Math.max(...FUNNEL_STAGES.map((s) => s.currentVolume))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Funil em Tempo Real</h2>
          <Badge className="text-[10px] h-5 px-2 bg-violet-500/10 text-violet-600 border-0">
            Etapa 4
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visualize cada estágio do funil e compare com o diagnóstico inicial
        </p>
      </div>

      {/* Visual Funnel */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Estágios do Funil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {FUNNEL_STAGES.map((stage, idx) => {
            const widthPct = (stage.currentVolume / maxVolume) * 100
            const volumeChange = stage.currentVolume - stage.beforeVolume
            const convChange = stage.currentConversion - stage.beforeConversion
            return (
              <div
                key={stage.name}
                className={`rounded-lg border p-4 transition-all ${
                  stage.isBottleneck
                    ? 'border-orange-400/60 bg-orange-500/5'
                    : 'border-border/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{stage.name}</span>
                    {stage.isBottleneck && (
                      <Badge className="text-[9px] h-4 px-1.5 bg-orange-500/10 text-orange-600 border-0">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                        Gargalo
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{stage.currentVolume}</span>
                    <div className={`flex items-center gap-0.5 text-xs font-medium ${volumeChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {volumeChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {volumeChange >= 0 ? '+' : ''}{volumeChange}
                    </div>
                  </div>
                </div>

                {/* Funnel bar */}
                <div className="w-full bg-muted/40 rounded-full h-3 mb-2">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      stage.isBottleneck ? 'bg-orange-500' : 'bg-primary/70'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                {/* Before vs Now */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span>Diagnóstico: <strong>{stage.beforeVolume}</strong></span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Atual: <strong>{stage.currentVolume}</strong></span>
                  {stage.name !== 'Leads' && (
                    <>
                      <Separator orientation="vertical" className="h-3" />
                      <span>Conversão: {stage.beforeConversion}% → {stage.currentConversion}%</span>
                      <span className={`font-medium ${convChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ({convChange >= 0 ? '▲' : '▼'} {Math.abs(convChange)}pp)
                      </span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Comparison Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Na época do diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Leads totais</span>
              <span className="font-semibold">280</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Fechamentos</span>
              <span className="font-semibold">21</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Taxa Lead→Fechamento</span>
              <span className="font-semibold">7.5%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Ciclo médio</span>
              <span className="font-semibold">32 dias</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">
              Dados Atuais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Leads totais</span>
              <span className="font-semibold">347 <span className="text-emerald-600 text-xs">(+24%)</span></span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Fechamentos</span>
              <span className="font-semibold">31 <span className="text-emerald-600 text-xs">(+48%)</span></span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Taxa Lead→Fechamento</span>
              <span className="font-semibold">8.9% <span className="text-emerald-600 text-xs">(+1.4pp)</span></span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Ciclo médio</span>
              <span className="font-semibold">24 dias <span className="text-emerald-600 text-xs">(-25%)</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Velocity */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Velocidade do Funil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {VELOCITY_METRICS.map((metric) => (
              <div key={metric.label} className="flex items-center justify-between rounded-lg border border-border/40 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground line-through">{metric.before}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-semibold">{metric.now}</span>
                  </div>
                </div>
                {metric.improved && (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
