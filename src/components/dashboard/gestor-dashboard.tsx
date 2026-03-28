'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
  Rocket,
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
}

interface FunnelStage {
  name: string
  before: number
  current: number
  benchmarkConv: number
  currentConv: number
  bottleneck: boolean
}

export function GestorDashboard({ user }: GestorDashboardProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamSize, setTeamSize] = useState(0)
  const [activeMissions, setActiveMissions] = useState(0)
  const [diagnosticCount, setDiagnosticCount] = useState(0)
  const [recentAlerts, setRecentAlerts] = useState<string[]>([])

  // Funnel stages: before (diagnóstico) vs current
  const funnelStages = [
    { name: 'Leads',        before: 280, current: 347, benchmarkConv: 100, currentConv: 100, bottleneck: false },
    { name: 'Qualificados', before: 140, current: 198, benchmarkConv: 65,  currentConv: 57,  bottleneck: false },
    { name: 'Propostas',    before: 63,  current: 89,  benchmarkConv: 60,  currentConv: 45,  bottleneck: true  },
    { name: 'Negociação',   before: 38,  current: 52,  benchmarkConv: 65,  currentConv: 58,  bottleneck: false },
    { name: 'Fechamento',   before: 21,  current: 31,  benchmarkConv: 70,  currentConv: 60,  bottleneck: false },
  ]

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const [
        { data: members },
        { count: missions },
        { count: diagnostics },
      ] = await Promise.all([
        supabase
          .from('user_xp')
          .select('user_id, total_xp, current_level, current_streak, users!inner(name, role)')
          .eq('organization_id', user.organization_id)
          .order('total_xp', { ascending: false })
          .limit(10),
        supabase
          .from('ai_missions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', user.organization_id)
          .in('status', ['pending', 'in_progress']),
        supabase
          .from('diagnostic_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', user.organization_id),
      ])

      const { count: total } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', user.organization_id)
        .eq('role', 'seller')
        .eq('active', true)

      setTeamSize(total ?? 0)
      setActiveMissions(missions ?? 0)
      setDiagnosticCount(diagnostics ?? 0)

      if (members) {
        setTeamMembers(
          (members as any[])
            .filter((m) => m.users?.role === 'seller')
            .map((m) => ({
              user_id: m.user_id,
              name: m.users?.name ?? 'Vendedor',
              total_xp: m.total_xp,
              current_level: m.current_level,
              current_streak: m.current_streak,
            }))
        )
      }

      // Generate alerts based on data
      const alerts: string[] = []
      if (members) {
        const lowStreak = (members as any[]).filter(
          (m) => m.current_streak === 0 && m.users?.role === 'seller'
        )
        if (lowStreak.length > 0) {
          alerts.push(`${lowStreak.length} vendedor(es) sem atividade recente`)
        }
      }
      if ((missions ?? 0) > 10) {
        alerts.push('Muitas missões pendentes — verifique a carga da equipe')
      }
      setRecentAlerts(alerts)
      setLoading(false)
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

  const maxFunnel = Math.max(...funnelStages.map(s => s.current))

  // ROI formula values (simulated — will come from real data after CRM sync)
  const roi = {
    receitaRecuperada: 12400,
    economiaAdmin: 3200,
    reducaoTurnover: 4800,
    investimentoTotal: 4880,
  }
  const roiTotal = roi.receitaRecuperada + roi.economiaAdmin + roi.reducaoTurnover
  const roiMultiplier = (roiTotal / roi.investimentoTotal).toFixed(2)

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
                <p className="text-2xl font-bold mt-1">R$ 84.200</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-emerald-500 font-medium">+12.5%</span>
                </div>
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
                <p className="text-2xl font-bold mt-1">8.9%</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500 font-medium">-2.1%</span>
                </div>
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

            <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-500">Gargalo: Qualificados → Propostas (45% vs benchmark 60%)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conversão 15pp abaixo do benchmark. Perda estimada: R$ 23.400/mês.
                    Missão ativa: &quot;Revisar script de proposta&quot; pode recuperar R$ 8.200/mês.
                  </p>
                </div>
              </div>
            </div>
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

            <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-start gap-2">
                <Brain className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-blue-500">Recomendação</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    3 vendedores com perfil &quot;I&quot; (Influência) têm taxa de fechamento 23% maior.
                    Considere treinar a equipe em técnicas de rapport.
                  </p>
                </div>
              </div>
            </div>

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
                  + R$ {roi.receitaRecuperada.toLocaleString('pt-BR')}
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
                  + R$ {roi.economiaAdmin.toLocaleString('pt-BR')}
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
                  + R$ {roi.reducaoTurnover.toLocaleString('pt-BR')}
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
                  ÷ R$ {roi.investimentoTotal.toLocaleString('pt-BR')}
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
            <Badge variant="secondary" className="text-[10px]">3 ações sugeridas</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Nudge */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <MessageCircle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold">Nudge sugerido</p>
                <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30">urgente</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Diego tem 3 propostas abertas há mais de 5 dias sem follow-up. Envie um lembrete rápido antes de perder essas oportunidades.
              </p>
            </div>
          </div>

          {/* Reconhecimento */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Star className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold">Reconheça Ana publicamente</p>
                <Badge variant="outline" className="text-[9px] text-emerald-500 border-emerald-500/30">alto impacto</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ana completou 4 missões esta semana e subiu de nível. Reconhecimento público agora aumenta a motivação de toda a equipe.
              </p>
            </div>
          </div>

          {/* 1:1 */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <HeartPulse className="h-4 w-4 text-red-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold">Agende 1:1 com Bruna</p>
                <Badge variant="outline" className="text-[9px] text-red-500 border-red-500/30">burnout</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bruna está sem atividade há 6 dias. Não lance novas missões antes de conversar — gamificação sobre burnout piora o problema.
              </p>
            </div>
          </div>

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
