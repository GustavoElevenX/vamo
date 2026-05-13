'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Brain,
  ChevronRight,
  Filter,
  Users,
  HeartPulse,
  PieChart,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Swords,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface OverviewData {
  missoes_ativas: number
  missoes_concluidas_mes: number
  total_vendedores: number
  vendedores_ativos: number
  engagement_rate: number
  roi_multiplier: number
  total_xp_org: number
  receita_vendida_mes: number
  forecast_provavel: number
  pipeline_em_risco: number
  meta_pct: number
  kpi_entries_hoje: number
  kpi_entries_semana: number[]   // últimos 7 dias (valor por dia)
  dias_com_kpi_semana: number
}

const QUICK_LINKS = [
  { label: 'Funil em Tempo Real',      href: '/monitoramento/funil',         icon: Filter },
  { label: 'Desempenho da Equipe',    href: '/monitoramento/equipe',        icon: Users },
  { label: 'Missões da Equipe',        href: '/monitoramento/missoes',       icon: Swords },
  { label: 'Alertas da VAMO IA',       href: '/monitoramento/alertas',       icon: AlertTriangle },
  { label: 'Saúde da Equipe',          href: '/monitoramento/saude-equipe',  icon: HeartPulse },
  { label: 'Comissionamento',          href: '/monitoramento/comissionamento',icon: DollarSign },
  { label: 'ROI da Plataforma',        href: '/monitoramento/roi',           icon: PieChart },
]

export default function MonitoramentoPage() {
  const { user } = useRequiredAuth()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<OverviewData | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

        // Janela dos últimos 7 dias (computada antes para usar no batch)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (6 - i))
          return d.toISOString().split('T')[0]
        })

        // ── Coleta em paralelo ──────────────────────────────────────────
        const [
          missionsActiveRes,
          missionsMonthRes,
          perfRes,
          kpiTodayRes,
          roiRes,
          kpiWeekRes,
        ] = await Promise.allSettled([
          // Missões ativas
          supabase
            .from('ai_missions')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', user.organization_id)
            .in('status', ['pending', 'in_progress']),

          // Missões concluídas no mês
          supabase
            .from('ai_missions')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', user.organization_id)
            .eq('status', 'completed')
            .gte('created_at', monthStart),

          // Performance comercial da equipe
          fetch('/api/team/commercial-performance?period=month', { credentials: 'same-origin' }),

          // KPI entries de hoje
          supabase
            .from('kpi_entries')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', user.organization_id)
            .gte('recorded_at', `${todayStr}T00:00:00`)
            .lte('recorded_at', `${todayStr}T23:59:59`),

          // ROI resumido
          fetch('/api/roi/calculate', { credentials: 'same-origin' }),

          // KPI entries dos últimos 7 dias (movido para o batch para paralelizar)
          supabase
            .from('kpi_entries')
            .select('recorded_at')
            .eq('organization_id', user.organization_id)
            .gte('recorded_at', `${last7Days[0]}T00:00:00`)
            .lte('recorded_at', `${last7Days[6]}T23:59:59`),
        ])

        const missionsAtivas   = missionsActiveRes.status === 'fulfilled' ? (missionsActiveRes.value.count ?? 0) : 0
        const missoesMes       = missionsMonthRes.status  === 'fulfilled' ? (missionsMonthRes.value.count ?? 0) : 0
        const kpiHoje          = kpiTodayRes.status       === 'fulfilled' ? (kpiTodayRes.value.count ?? 0) : 0

        let totalVendedores = 0
        let vendedoresAtivos = 0
        let totalXp = 0
        let receitaVendidaMes = 0
        let forecastProvavel = 0
        let pipelineEmRisco = 0
        let metaPct = 0

        if (perfRes.status === 'fulfilled' && perfRes.value.ok) {
          const commercial = await perfRes.value.json()
          const list: { xp: number; streak: number; activities_count: number; revenue_won: number; forecast_weighted: number }[] = commercial.sellers ?? []
          totalVendedores = list.length
          vendedoresAtivos = list.filter(m =>
            m.activities_count > 0 || m.revenue_won > 0 || m.forecast_weighted > 0 || m.streak > 0
          ).length
          totalXp = list.reduce((sum, m) => sum + m.xp, 0)
          receitaVendidaMes = commercial.summary?.revenue_won ?? 0
          forecastProvavel = commercial.summary?.forecast_weighted ?? 0
          pipelineEmRisco = commercial.summary?.pipeline_at_risk ?? 0
          metaPct = commercial.summary?.monthly_goal ? Math.round((receitaVendidaMes / commercial.summary.monthly_goal) * 100) : 0
        }

        const engagementRate = totalVendedores > 0
          ? Math.round((vendedoresAtivos / totalVendedores) * 100)
          : 0

        let roiMultiplier = 0
        if (roiRes.status === 'fulfilled' && roiRes.value.ok) {
          const roiJson = await roiRes.value.json()
          roiMultiplier = roiJson.roi_multiplier ?? 0
        }

        // Entradas KPI nos últimos 7 dias (contagem por dia)
        const kpiWeek = kpiWeekRes.status === 'fulfilled' ? (kpiWeekRes.value.data ?? []) : []

        const kpiPerDay = last7Days.map(day => {
          return kpiWeek.filter((e: { recorded_at: string }) => e.recorded_at.startsWith(day)).length
        })

        const diasComKpi = kpiPerDay.filter(v => v > 0).length

        setData({
          missoes_ativas:           missionsAtivas,
          missoes_concluidas_mes:   missoesMes,
          total_vendedores:         totalVendedores,
          vendedores_ativos:        vendedoresAtivos,
          engagement_rate:          engagementRate,
          roi_multiplier:           roiMultiplier,
          total_xp_org:             totalXp,
          receita_vendida_mes:       receitaVendidaMes,
          forecast_provavel:         forecastProvavel,
          pipeline_em_risco:         pipelineEmRisco,
          meta_pct:                  metaPct,
          kpi_entries_hoje:         kpiHoje,
          kpi_entries_semana:       kpiPerDay,
          dias_com_kpi_semana:      diasComKpi,
        })
      } catch (err) {
        console.error('[MonitoramentoPage]', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const d = data ?? {
    missoes_ativas: 0, missoes_concluidas_mes: 0,
    total_vendedores: 0, vendedores_ativos: 0,
    engagement_rate: 0, roi_multiplier: 0,
    total_xp_org: 0, kpi_entries_hoje: 0,
    receita_vendida_mes: 0, forecast_provavel: 0, pipeline_em_risco: 0, meta_pct: 0,
    kpi_entries_semana: Array(7).fill(0),
    dias_com_kpi_semana: 0,
  }

  const last7Labels = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return date.toLocaleDateString('pt-BR', { weekday: 'short' })
      .replace('.', '').slice(0, 3)
  })

  const maxBar = Math.max(...d.kpi_entries_semana, 1)

  const kpiCards = [
    {
      label: 'Vendido no mes',
      value: d.receita_vendida_mes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
      sub: `${d.meta_pct}% da meta comercial`,
      icon: DollarSign,
      color: 'stat-icon-green',
      trend: d.receita_vendida_mes > 0 ? 'Venda real' : 'Sem venda no período',
      trendUp: d.receita_vendida_mes > 0,
    },
    {
      label: 'Funil em risco',
      value: d.pipeline_em_risco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
      sub: `${d.forecast_provavel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} forecast provavel`,
      icon: TrendingUp,
      color: d.pipeline_em_risco > 0 ? 'stat-icon-amber' : 'stat-icon-green',
      trend: d.pipeline_em_risco > 0 ? 'Intervencao' : 'Controlado',
      trendUp: d.pipeline_em_risco === 0,
    },
    {
      label: 'Ações comerciais hoje',
      value: d.kpi_entries_hoje,
      sub: `${d.dias_com_kpi_semana} dias com registro esta semana`,
      icon: Target,
      color: 'stat-icon-blue',
      trend: d.kpi_entries_hoje > 0 ? 'Equipe ativa' : 'Sem registros hoje',
      trendUp: d.kpi_entries_hoje > 0,
    },
    {
      label: 'ROI da Plataforma',
      value: `${d.roi_multiplier}x`,
      sub: `${d.total_vendedores} vendedores | ${d.total_xp_org.toLocaleString()} XP suporte`,
      icon: BarChart3,
      color: d.roi_multiplier >= 2 ? 'stat-icon-green' : d.roi_multiplier >= 1 ? 'stat-icon-blue' : 'stat-icon-violet',
      trend: d.roi_multiplier >= 1 ? 'Retorno positivo' : 'Calculando...',
      trendUp: d.roi_multiplier >= 1,
      href: '/monitoramento/roi',
    },
  ].slice(0, 4)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Visão Geral</h2>
            <Badge className="text-[10px] h-5 px-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-0">
              Monitoramento
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dados em tempo real da desempenho comercial e da plataforma
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Atualizar
        </Button>
      </div>

      {/* Placar comercial */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          const card = (
            <Card key={kpi.label} className={cn('border-border/50 transition-all', kpi.href && 'hover:border-primary/20 cursor-pointer')}>
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('stat-icon h-10 w-10', kpi.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {kpi.trend && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] h-5 px-1.5',
                        kpi.trendUp
                          ? 'text-emerald-600 border-emerald-500/25 dark:text-emerald-400'
                          : 'text-amber-600 border-amber-500/25 dark:text-amber-400'
                      )}
                    >
                      {kpi.trend}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-black tabular-nums">{kpi.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
                </div>
                <p className="text-[11px] text-muted-foreground/70">{kpi.sub}</p>
              </CardContent>
            </Card>
          )
          return kpi.href
            ? <Link key={kpi.label} href={kpi.href}>{card}</Link>
            : <div key={kpi.label}>{card}</div>
        })}
      </div>

      {/* Acoes comerciais nos ultimos 7 dias */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Ações comerciais ? últimos 7 dias
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {d.dias_com_kpi_semana}/7 dias ativos
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {d.kpi_entries_semana.every(v => v === 0) ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="stat-icon stat-icon-blue h-10 w-10 mx-auto mb-3">
                <Target className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma ação comercial registrada nos últimos 7 dias</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Os vendedores precisam registrar ações comerciais reais no CRM
              </p>
            </div>
          ) : (
            <div className="flex items-end gap-2 h-36">
              {d.kpi_entries_semana.map((val, i) => {
                const heightPct = (val / maxBar) * 100
                const isToday = i === 6
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    {val > 0 && (
                      <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                        {val}
                      </span>
                    )}
                    <div className="w-full relative rounded-t-md bg-muted/40" style={{ height: '100px' }}>
                      <div
                        className={cn(
                          'absolute bottom-0 w-full rounded-t-md transition-all duration-500',
                          isToday ? 'bg-primary' : 'bg-primary/50'
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium',
                      isToday ? 'text-primary font-bold' : 'text-muted-foreground'
                    )}>
                      {last7Labels[i]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/50 border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="stat-icon stat-icon-blue h-9 w-9 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Impacto das Missões</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {d.missoes_concluidas_mes > 0
                    ? <>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          {d.missoes_concluidas_mes} missões concluídas
                        </span>{' '}
                        este mês. Cada missão entregue gera valor direto no funil de vendas.
                      </>
                    : 'Nenhuma missão concluída este mês ainda. Incentive a equipe a completar as missões pendentes.'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 border-l-4 border-l-violet-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="stat-icon stat-icon-violet h-9 w-9 shrink-0">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Análise de Atividade comercial</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {d.engagement_rate >= 70
                    ? <>
                        Equipe com{' '}
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {d.engagement_rate}% de atividade comercial
                        </span>{' '}
                        — acima do benchmark de 70%. Rotatividade sob controle.
                      </>
                    : d.engagement_rate >= 40
                      ? <>
                          Atividade comercial em{' '}
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            {d.engagement_rate}%
                          </span>{' '}
                          — abaixo do ideal. Verifique os alertas proativos e a saúde da equipe.
                        </>
                      : <>
                          Atividade comercial crítico em{' '}
                          <span className="text-destructive font-semibold">{d.engagement_rate}%</span>
                          . Ação imediata recomendada — acesse os alertas da VAMO IA.
                        </>
                  }
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
                  <div className="flex items-center gap-3 rounded-xl border border-border/40 p-3 hover:bg-accent/50 hover:border-primary/20 transition-all cursor-pointer">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium flex-1">{link.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
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
