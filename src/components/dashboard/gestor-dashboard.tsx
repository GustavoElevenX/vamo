'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  AlertTriangle,
  ArrowRight,
  Brain,
  Sparkles,
  Activity,
  BarChart3,
  MessageCircle,
  Star,
  HeartPulse,
  Calculator,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { CoachWidget } from '@/components/ai/coach-widget'
import type { User } from '@/types'

interface GestorDashboardProps {
  user: User
}

interface TeamMember {
  user_id: string
  name: string
  total_xp: number
  current_level: number
  current_streak: number
  last_activity_date: string | null
  missions_completed: number
}

interface FunnelStage {
  name: string
  before: number
  current: number
  benchmarkConv: number
  currentConv: number
  bottleneck: boolean
}

interface RoiData {
  receitaRecuperada: number
  economiaAdmin: number
  reducaoTurnover: number
  investimentoTotal: number
}

interface KpiOverview {
  receita_mes: number
  receita_variacao: number
  conversao_geral: number
  conversao_variacao: number
}

interface Nudge {
  type: 'burnout' | 'recognize' | 'followup'
  title: string
  label: string
  labelColor: string
  message: string
  borderColor: string
  bgColor: string
}

export function GestorDashboard({ user }: GestorDashboardProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamSize, setTeamSize] = useState(0)
  const [activeMissions, setActiveMissions] = useState(0)
  const [diagnosticCount, setDiagnosticCount] = useState(0)
  const [recentAlerts, setRecentAlerts] = useState<string[]>([])
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([])
  const [roi, setRoi] = useState<RoiData | null>(null)
  const [kpiOverview, setKpiOverview] = useState<KpiOverview | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        const [perfRes, missionsRes, diagnosticsRes, orgRes] = await Promise.allSettled([
          fetch('/api/team/performance', { credentials: 'same-origin' }),
          supabase
            .from('ai_missions')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', user.organization_id)
            .in('status', ['pending', 'in_progress']),
          supabase
            .from('diagnostic_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', user.organization_id),
          supabase
            .from('organizations')
            .select('settings')
            .eq('id', user.organization_id)
            .single(),
        ])

        const missions = missionsRes.status === 'fulfilled' ? missionsRes.value.count : 0
        const diagnostics = diagnosticsRes.status === 'fulfilled' ? diagnosticsRes.value.count : 0

        setActiveMissions(missions ?? 0)
        setDiagnosticCount(diagnostics ?? 0)

        if (orgRes.status === 'fulfilled' && orgRes.value.data) {
          const settings = orgRes.value.data.settings as Record<string, unknown>
          if (settings.funnel) setFunnelStages((settings.funnel as { stages: FunnelStage[] }).stages ?? [])
          if (settings.roi) setRoi(settings.roi as RoiData)
          if (settings.kpi_overview) setKpiOverview(settings.kpi_overview as KpiOverview)
        }

        if (perfRes.status === 'fulfilled' && perfRes.value.ok) {
          const { members } = await perfRes.value.json()
          const list: TeamMember[] = (members ?? []).map((m: any) => ({
            user_id: m.user_id,
            name: m.name,
            total_xp: m.total_xp,
            current_level: m.current_level,
            current_streak: m.current_streak,
            last_activity_date: m.last_activity_date ?? null,
            missions_completed: m.missions_completed ?? 0,
          }))
          setTeamMembers(list)
          setTeamSize(list.length)

          const alerts: string[] = []
          const lowStreak = list.filter((m) => m.current_streak === 0)
          if (lowStreak.length > 0) {
            alerts.push(`${lowStreak.length} vendedor(es) sem atividade recente`)
          }
          if ((missions ?? 0) > 10) {
            alerts.push('Muitas missões pendentes — verifique a carga da equipe')
          }
          setRecentAlerts(alerts)

          // Compute dynamic nudges from real team data
          const computedNudges: Nudge[] = []

          // Burnout risk: streak 0 + last activity > 5 days ago
          const today = new Date()
          const burnoutRisk = list.find((m) => {
            if (m.current_streak !== 0) return false
            if (!m.last_activity_date) return true
            const lastActive = new Date(m.last_activity_date)
            return (today.getTime() - lastActive.getTime()) / 86400000 > 5
          })
          if (burnoutRisk) {
            const daysInactive = burnoutRisk.last_activity_date
              ? Math.floor((today.getTime() - new Date(burnoutRisk.last_activity_date).getTime()) / 86400000)
              : null
            computedNudges.push({
              type: 'burnout',
              title: `Agende 1:1 com ${burnoutRisk.name.split(' ')[0]}`,
              label: 'burnout',
              labelColor: 'text-red-500 border-red-500/30',
              message: `${burnoutRisk.name.split(' ')[0]} está sem atividade${daysInactive ? ` há ${daysInactive} dias` : ''}. Não lance novas missões antes de conversar — gamificação sobre burnout piora o problema.`,
              borderColor: 'border-red-500/20',
              bgColor: 'bg-red-500/5',
            })
          }

          // Top performer: most missions completed
          const topPerformer = [...list].sort((a, b) => b.missions_completed - a.missions_completed)[0]
          if (topPerformer && topPerformer.missions_completed > 0) {
            computedNudges.push({
              type: 'recognize',
              title: `Reconheça ${topPerformer.name.split(' ')[0]} publicamente`,
              label: 'alto impacto',
              labelColor: 'text-emerald-500 border-emerald-500/30',
              message: `${topPerformer.name.split(' ')[0]} completou ${topPerformer.missions_completed} missão(ões) e está em Nível ${topPerformer.current_level}. Reconhecimento público agora aumenta a motivação de toda a equipe.`,
              borderColor: 'border-emerald-500/20',
              bgColor: 'bg-emerald-500/5',
            })
          }

          // Engagement alert: sellers with low streak but not burnout
          const lowEngagement = list.filter((m) => m.current_streak > 0 && m.current_streak < 3)
          if (lowEngagement.length > 0) {
            computedNudges.push({
              type: 'followup',
              title: `Engajamento baixo — ${lowEngagement.length} vendedor(es)`,
              label: 'atenção',
              labelColor: 'text-amber-500 border-amber-500/30',
              message: `${lowEngagement.map(m => m.name.split(' ')[0]).join(', ')} com streak abaixo de 3 dias. Uma mensagem de incentivo pode ajudar a manter o ritmo.`,
              borderColor: 'border-amber-500/20',
              bgColor: 'bg-amber-500/5',
            })
          }

          setNudges(computedNudges)
        }
      } catch (err) {
        console.error('[GestorDashboard] Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const maxFunnel = funnelStages.length > 0 ? Math.max(...funnelStages.map(s => s.current)) : 1

  const roiTotal = roi ? roi.receitaRecuperada + roi.economiaAdmin + roi.reducaoTurnover : 0
  const roiMultiplier = roi ? (roiTotal / roi.investimentoTotal).toFixed(2) : '0'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Dashboard & ROI</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão geral da performance comercial
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Receita Mês</p>
                <p className="text-2xl font-bold mt-1">
                  {kpiOverview ? `R$ ${kpiOverview.receita_mes.toLocaleString('pt-BR')}` : '—'}
                </p>
                {kpiOverview && (
                  <div className="flex items-center gap-1 mt-1">
                    {kpiOverview.receita_variacao >= 0
                      ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                      : <TrendingDown className="h-3 w-3 text-red-500" />}
                    <span className={`text-xs font-medium ${kpiOverview.receita_variacao >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {kpiOverview.receita_variacao > 0 ? '+' : ''}{kpiOverview.receita_variacao}%
                    </span>
                  </div>
                )}
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Conversão Geral</p>
                <p className="text-2xl font-bold mt-1">
                  {kpiOverview ? `${kpiOverview.conversao_geral}%` : '—'}
                </p>
                {kpiOverview && (
                  <div className="flex items-center gap-1 mt-1">
                    {kpiOverview.conversao_variacao >= 0
                      ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                      : <TrendingDown className="h-3 w-3 text-red-500" />}
                    <span className={`text-xs font-medium ${kpiOverview.conversao_variacao >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {kpiOverview.conversao_variacao > 0 ? '+' : ''}{kpiOverview.conversao_variacao}%
                    </span>
                  </div>
                )}
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Equipe Ativa</p>
                <p className="text-2xl font-bold mt-1">{teamSize}</p>
                <p className="text-xs text-muted-foreground mt-1">{activeMissions} missões ativas</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Diagnósticos</p>
                <p className="text-2xl font-bold mt-1">{diagnosticCount}</p>
                <p className="text-xs text-muted-foreground mt-1">realizados</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Funnel Visual — Before/After */}
        <Card className="border-border/50 lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Funil de Vendas · Antes vs Agora</CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-muted-foreground/40" />
                  Diagnóstico
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
                  Atual
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {funnelStages.length === 0 ? (
              <div className="py-8 text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm text-muted-foreground">Dados do funil ainda não configurados.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Configure via Configurações → Organização.</p>
              </div>
            ) : (
            <>
            <div className="space-y-4">
              {funnelStages.map((stage, i) => {
                const growthPct = Math.round(((stage.current - stage.before) / stage.before) * 100)
                const convBelowBench = i > 0 && stage.currentConv < stage.benchmarkConv
                return (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{stage.name}</span>
                        {stage.bottleneck && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                            Gargalo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {i > 0 && (
                          <span className={`font-medium ${convBelowBench ? 'text-red-500' : 'text-muted-foreground'}`}>
                            conv. {stage.currentConv}%
                            {convBelowBench && <span className="text-muted-foreground/60"> / bench {stage.benchmarkConv}%</span>}
                          </span>
                        )}
                        <span className="font-semibold tabular-nums">{stage.current}</span>
                        {growthPct > 0 && (
                          <span className="text-emerald-500 font-medium">+{growthPct}%</span>
                        )}
                      </div>
                    </div>
                    {/* Stacked bars: before (grey) + growth (emerald) */}
                    <div className="relative h-5 w-full rounded-md bg-muted/30 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-muted-foreground/25"
                        style={{ width: `${(stage.before / maxFunnel) * 100}%` }}
                      />
                      <div
                        className={`absolute inset-y-0 left-0 rounded-md transition-all ${stage.bottleneck ? 'bg-red-500/70' : 'bg-emerald-500/70'}`}
                        style={{ width: `${(stage.current / maxFunnel) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[10px] font-semibold text-white drop-shadow">
                          {stage.before} → {stage.current}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {(() => {
              const bottleneck = funnelStages.find(s => s.bottleneck)
              if (!bottleneck) return null
              const prevStage = funnelStages[funnelStages.indexOf(bottleneck) - 1]
              const gap = prevStage ? bottleneck.benchmarkConv - bottleneck.currentConv : 0
              return (
                <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-500">
                        Gargalo: {prevStage?.name} → {bottleneck.name} ({bottleneck.currentConv}% vs benchmark {bottleneck.benchmarkConv}%)
                      </p>
                      {gap > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Conversão {gap}pp abaixo do benchmark. Missões ativas nesta área podem ajudar a recuperar essa perda.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
            </>
            )}
          </CardContent>
        </Card>

        {/* Alerts & Insights */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Insights da VAMO IA</CardTitle>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">{alert}</p>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <Activity className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">Equipe com boa atividade. Sem alertas no momento.</p>
              </div>
            )}

            {teamSize > 0 && (
              <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-start gap-2">
                  <Brain className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-500">Recomendação</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {teamSize} vendedores ativos. Acesse os perfis comportamentais para ver recomendações personalizadas por tipo DISC.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-between text-xs" render={<Link href="/auditoria" />}>
                Ver auditoria completa
                <ArrowRight className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-between text-xs" render={<Link href="/saude-equipe" />}>
                Monitor de saúde da equipe
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Ranking */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Performance da Equipe</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" render={<Link href="/equipe" />}>
              Ver todos <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum vendedor registrado ainda.</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" render={<Link href="/configuracoes" />}>
                Configurar equipe
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {teamMembers.slice(0, 5).map((member, i) => {
                const initials = member.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
                const medals = ['🥇', '🥈', '🥉']

                return (
                  <Link
                    key={member.user_id}
                    href={`/equipe/${member.user_id}`}
                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent/50 transition-colors"
                  >
                    <span className="w-5 text-center text-sm">
                      {i < 3 ? medals[i] : <span className="text-muted-foreground font-medium">{i + 1}</span>}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-600">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Nível {member.current_level} · Streak: {member.current_streak}d
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-emerald-500">
                      {member.total_xp.toLocaleString()} XP
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROI da Plataforma — Fórmula Completa */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-sm font-medium">ROI da Plataforma · 90 dias</CardTitle>
            </div>
            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 border-0 font-semibold">
              {roiMultiplier}× de retorno
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Headline message */}
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Para cada R$ 1,00 investido na plataforma</p>
            <p className="text-3xl font-bold text-emerald-600">R$ {roiMultiplier}</p>
            <p className="text-xs text-emerald-700 font-medium mt-1">retornados em 90 dias</p>
          </div>

          {/* Formula breakdown */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Fórmula: (Receita recuperada + Economia administrativa + Redução turnover) ÷ Investimento
            </p>
            <div className="space-y-2">
              {/* Numerator items */}
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Receita Recuperada</p>
                    <p className="text-[10px] text-muted-foreground">Conversão +4pp × volume de leads</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600">
                  + R$ {(roi?.receitaRecuperada ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Economia Administrativa</p>
                    <p className="text-[10px] text-muted-foreground">CRM +26pp → menos retrabalho e reuniões</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  + R$ {(roi?.economiaAdmin ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-violet-500/10 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Redução de Turnover</p>
                    <p className="text-[10px] text-muted-foreground">Engajamento +34% → menos reposição</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-violet-600">
                  + R$ {(roi?.reducaoTurnover ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
              {/* Denominator */}
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-muted/50 flex items-center justify-center">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Investimento Total</p>
                    <p className="text-[10px] text-muted-foreground">Assinatura + horas de setup</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-muted-foreground">
                  ÷ R$ {(roi?.investimentoTotal ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
              {/* Result */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-amber-500/10 flex items-center justify-center">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <p className="text-xs font-semibold">ROI Total (90 dias)</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-emerald-600">
                    R$ {roiTotal.toLocaleString('pt-BR')}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-lg font-bold text-emerald-600">{roiMultiplier}×</span>
                </div>
              </div>
            </div>
          </div>

          {/* Before/after metrics */}
          <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-border/40">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Conversão Geral</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-sm font-bold text-red-400 line-through">8.9%</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold text-emerald-600">12.9%</span>
              </div>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">+4pp</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">CRM Atualizado</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-sm font-bold text-red-400 line-through">63%</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold text-emerald-600">89%</span>
              </div>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">+26pp</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Engajamento</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-sm font-bold text-red-400 line-through">51%</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold text-emerald-600">85%</span>
              </div>
              <p className="text-[10px] text-emerald-600 font-medium mt-0.5">+34pp</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas Proativos da VAMO IA */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-medium">Alertas Proativos da VAMO IA</CardTitle>
            </div>
            {nudges.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{nudges.length} ação(ões) sugerida(s)</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {nudges.length === 0 ? (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <Activity className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">Equipe com boa atividade. Sem alertas proativos no momento.</p>
            </div>
          ) : (
            nudges.map((nudge, i) => {
              const Icon = nudge.type === 'burnout' ? HeartPulse : nudge.type === 'recognize' ? Star : MessageCircle
              const iconColor = nudge.type === 'burnout' ? 'text-red-500' : nudge.type === 'recognize' ? 'text-emerald-500' : 'text-amber-500'
              const iconBg = nudge.type === 'burnout' ? 'bg-red-500/10' : nudge.type === 'recognize' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${nudge.borderColor} ${nudge.bgColor}`}>
                  <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold">{nudge.title}</p>
                      <Badge variant="outline" className={`text-[9px] ${nudge.labelColor}`}>{nudge.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{nudge.message}</p>
                  </div>
                </div>
              )
            })
          )}

          <Button variant="outline" size="sm" className="w-full justify-between text-xs" render={<Link href="/saude-equipe" />}>
            Ver saúde completa da equipe
            <ArrowRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Coach VAMO IA */}
      <CoachWidget />
    </div>
  )
}
