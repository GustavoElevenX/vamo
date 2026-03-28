'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  TrendingUp,
  DollarSign,
  Target,
  Zap,
  BarChart3,
  Brain,
  ChevronRight,
  Filter,
  Users,
  HeartPulse,
  PieChart,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'

const KPI_DATA = [
  {
    label: 'Receita do Mês',
    value: 'R$ 156.800',
    target: 'R$ 178.000',
    pct: 88,
    icon: DollarSign,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
  },
  {
    label: 'Taxa de Conversão',
    value: '48%',
    target: '55%',
    pct: 87,
    icon: Target,
    color: 'text-blue-600',
    bg: 'bg-blue-500/10',
  },
  {
    label: 'Engajamento Missões',
    value: '76%',
    target: '80%',
    pct: 95,
    icon: Zap,
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
  },
  {
    label: 'ROI da Plataforma',
    value: '3.2x',
    target: '4.0x',
    pct: 80,
    icon: TrendingUp,
    color: 'text-violet-600',
    bg: 'bg-violet-500/10',
  },
]

const WEEKLY_REVENUE = [
  { label: 'Sem 1', value: 32000, max: 50000 },
  { label: 'Sem 2', value: 41500, max: 50000 },
  { label: 'Sem 3', value: 38200, max: 50000 },
  { label: 'Sem 4', value: 45100, max: 50000 },
]

const QUICK_LINKS = [
  { label: 'Funil em Tempo Real', href: '/monitoramento/funil', icon: Filter },
  { label: 'Performance da Equipe', href: '/monitoramento/equipe', icon: Users },
  { label: 'Alertas da VAMO IA', href: '/monitoramento/alertas', icon: AlertTriangle },
  { label: 'Saúde da Equipe', href: '/monitoramento/saude-equipe', icon: HeartPulse },
  { label: 'Comissionamento', href: '/monitoramento/comissionamento', icon: DollarSign },
  { label: 'ROI da Plataforma', href: '/monitoramento/roi', icon: PieChart },
]

export default function MonitoramentoPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Visão Geral</h2>
            <Badge className="text-[10px] h-5 px-2 bg-violet-500/10 text-violet-600 border-0">
              Etapa 4
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe a performance comercial e o impacto da plataforma
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_DATA.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label} className="border-border/50">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {kpi.pct}% da meta
                  </Badge>
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                </div>
                <div className="space-y-1">
                  <Progress value={kpi.pct} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">Meta: {kpi.target}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Weekly Revenue Trend */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Receita Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-40">
            {WEEKLY_REVENUE.map((week) => {
              const heightPct = (week.value / week.max) * 100
              return (
                <div key={week.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    R$ {(week.value / 1000).toFixed(1)}k
                  </span>
                  <div className="w-full bg-muted/40 rounded-t-md relative" style={{ height: '120px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-primary/80 rounded-t-md transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{week.label}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mission Impact + AI Prediction */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/50 border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Impacto das Missões</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Equipes com {'>'} 80% de participação em missões tiveram{' '}
                  <span className="text-blue-600 font-semibold">+15% de conversão</span> comparado
                  ao período pré-plataforma.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 border-l-4 border-l-violet-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                <Brain className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Predição da VAMO IA</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  No ritmo atual, a meta de{' '}
                  <span className="text-violet-600 font-semibold">R$ 178k</span> será atingida em
                  aproximadamente <span className="text-violet-600 font-semibold">~72 dias</span>.
                  Aumento de 12% na velocidade do funil pode reduzir para 58 dias.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Acesso Rápido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <Link key={link.href} href={link.href}>
                  <div className="flex items-center gap-3 rounded-lg border border-border/40 p-3 hover:bg-accent/50 transition-colors cursor-pointer">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium flex-1">{link.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
