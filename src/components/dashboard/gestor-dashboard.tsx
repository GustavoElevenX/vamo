'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
  Zap,
} from 'lucide-react'
import { CoachWidget } from '@/components/ai/coach-widget'
import { cn } from '@/lib/utils'
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

const RankIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return (
    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-black rank-gold')}>
      1
    </span>
  )
  if (rank === 2) return (
    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-black rank-silver')}>
      2
    </span>
  )
  if (rank === 3) return (
    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-black rank-bronze')}>
      3
    </span>
  )
  return (
    <span className="flex h-7 w-7 items-center justify-center text-xs font-bold text-muted-foreground">
      {rank}
    </span>
  )
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
  const [kpiOverview, setKpiOverview] = useState<KpiOverview | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        const [perfRes, missionsRes, diagnosticsRes, orgRes] = await Promise.allSettled([
          fetch('/api/team/performance', { credentials: 'same-origin' }),
          supabase.from('ai_missions').select('*', { count: 'exact', head: true })
            .eq('organization_id', user.organization_id).in('status', ['pending', 'in_progress']),
          supabase.from('diagnostic_sessions').select('*', { count: 'exact', head: true })
            .eq('organization_id', user.organization_id),
          supabase.from('organizations').select('settings').eq('id', user.organization_id).single(),
        ])

        const missions    = missionsRes.status    === 'fulfilled' ? missionsRes.value.count    : 0
        const diagnostics = diagnosticsRes.status === 'fulfilled' ? diagnosticsRes.value.count : 0

        setActiveMissions(missions ?? 0)
        setDiagnosticCount(diagnostics ?? 0)

        if (orgRes.status === 'fulfilled' && orgRes.value.data) {
          const settings = orgRes.value.data.settings as Record<string, unknown>
          if (settings.funnel) setFunnelStages((settings.funnel as { stages: FunnelStage[] }).stages ?? [])
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
          if (lowStreak.length > 0) alerts.push(`${lowStreak.length} vendedor(es) sem atividade recente`)
          if ((missions ?? 0) > 10) alerts.push('Muitas missões pendentes — verifique a carga da equipe')
          setRecentAlerts(alerts)

          const today = new Date()
          const computedNudges: Nudge[] = []

          const burnoutRisk = list.find((m) => {
            if (m.current_streak !== 0) return false
            if (!m.last_activity_date) return true
            return (today.getTime() - new Date(m.last_activity_date).getTime()) / 86400000 > 5
          })
          if (burnoutRisk) {
            const daysInactive = burnoutRisk.last_activity_date
              ? Math.floor((today.getTime() - new Date(burnoutRisk.last_activity_date).getTime()) / 86400000)
              : null
            computedNudges.push({
              type: 'burnout',
              title: `Agende 1:1 com ${burnoutRisk.name.split(' ')[0]}`,
              label: 'burnout',
              labelColor: 'text-destructive border-destructive/30',
              message: `${burnoutRisk.name.split(' ')[0]} está sem atividade${daysInactive ? ` há ${daysInactive} dias` : ''}. Não lance novas missões antes de conversar — gamificação sobre burnout piora o problema.`,
              borderColor: 'border-destructive/15',
              bgColor: 'bg-destructive/5',
            })
          }

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
        <div className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-primary border-t-transparent" />
      </div>
    )
  }

  const maxFunnel = funnelStages.length > 0 ? Math.max(...funnelStages.map(s => s.current)) : 1

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <div className="bento-label mb-2">
            <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
            Visão executiva
          </div>
          <h2 className="text-3xl font-black tracking-tight">
            Dashboard <span className="text-gradient-primary">Gestor</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Performance comercial da organização em tempo real
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="pill-glow">
            <Users className="h-3 w-3" />
            {teamSize} vendedores
          </span>
        </div>
      </div>

      {/* ── BENTO GRID PRINCIPAL ── */}
      <div className="bento animate-fade-in-up stagger-1">

        {/* Receita mês */}
        <div className="span-2 glass-card glass-hover glass-corner p-6 relative overflow-hidden">
          <div className="bento-label mb-2" style={{ color: 'oklch(0.55 0.18 145)' }}>
            <DollarSign className="h-3 w-3" />
            Receita mês
          </div>
          <div className="hero-number-md font-black tabular-nums text-gradient-primary">
            {kpiOverview ? `R$ ${(kpiOverview.receita_mes / 1000).toFixed(0)}k` : '—'}
          </div>
          {kpiOverview && (
            <div className="flex items-center gap-1 mt-2">
              {kpiOverview.receita_variacao >= 0
                ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
              <span className={cn('text-sm font-bold tabular-nums', kpiOverview.receita_variacao >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                {kpiOverview.receita_variacao > 0 ? '+' : ''}{kpiOverview.receita_variacao}%
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">vs mês anterior</span>
            </div>
          )}
          <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full opacity-10 blur-2xl" style={{ background: 'oklch(0.55 0.18 145)' }} />
        </div>

        {/* Conversão */}
        <div className="span-2 glass-card glass-hover p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="stat-icon stat-icon-blue h-10 w-10">
              <Target className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Conversão</span>
          </div>
          <p className="text-4xl font-black tabular-nums">{kpiOverview ? `${kpiOverview.conversao_geral}%` : '—'}</p>
          {kpiOverview && (
            <div className="flex items-center gap-1 mt-1">
              {kpiOverview.conversao_variacao >= 0
                ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                : <TrendingDown className="h-3 w-3 text-destructive" />}
              <span className={cn('text-[11px] font-bold', kpiOverview.conversao_variacao >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                {kpiOverview.conversao_variacao > 0 ? '+' : ''}{kpiOverview.conversao_variacao}pp
              </span>
            </div>
          )}
        </div>

        {/* Missões ativas */}
        <div className="span-2 glass-card glass-hover p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="stat-icon stat-icon-amber h-10 w-10">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Missões</span>
          </div>
          <p className="text-4xl font-black tabular-nums">{activeMissions}</p>
          <p className="text-[11px] text-muted-foreground mt-1">ativas agora</p>
        </div>

        {/* Diagnósticos */}
        <div className="span-2 glass-card glass-hover p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="stat-icon stat-icon-violet h-10 w-10">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Diagnósticos</span>
          </div>
          <p className="text-4xl font-black tabular-nums">{diagnosticCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">realizados</p>
        </div>

        {/* Funil de vendas */}
        <div className="span-4 glass-card glass-corner p-6 md:p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="bento-label mb-1.5">
                <BarChart3 className="h-3 w-3" />
                Funil · antes vs agora
              </div>
              <h3 className="text-lg font-bold tracking-tight">Evolução das etapas</h3>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-5 rounded-sm bg-muted-foreground/25" />Antes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-5 rounded-sm" style={{ background: 'oklch(0.55 0.20 145)' }} />Agora
              </span>
            </div>
          </div>

          {funnelStages.length === 0 ? (
            <div className="py-10 text-center">
              <div className="stat-icon stat-icon-amber h-12 w-12 mx-auto mb-3">
                <BarChart3 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Dados do funil ainda não configurados</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Configure via Configurações → Organização</p>
            </div>
          ) : (
            <div className="space-y-4">
              {funnelStages.map((stage, i) => {
                const growthPct = Math.round(((stage.current - stage.before) / stage.before) * 100)
                const convBelowBench = i > 0 && stage.currentConv < stage.benchmarkConv
                return (
                  <div key={stage.name} className={cn('animate-fade-in-up', `stagger-${i + 1}`)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{stage.name}</span>
                        {stage.bottleneck && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />Gargalo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {i > 0 && (
                          <span className={cn('font-medium', convBelowBench ? 'text-destructive' : 'text-muted-foreground')}>
                            conv. {stage.currentConv}%
                          </span>
                        )}
                        <span className="font-black tabular-nums">{stage.current}</span>
                        {growthPct > 0 && (
                          <span className="text-emerald-500 font-bold">+{growthPct}%</span>
                        )}
                      </div>
                    </div>
                    <div className="relative h-6 w-full rounded-lg bg-muted/25 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-lg bg-muted-foreground/20 transition-all duration-500"
                        style={{ width: `${(stage.before / maxFunnel) * 100}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
                        style={{
                          width: `${(stage.current / maxFunnel) * 100}%`,
                          background: stage.bottleneck
                            ? 'linear-gradient(90deg, oklch(0.65 0.24 16), oklch(0.70 0.22 20))'
                            : 'linear-gradient(90deg, oklch(0.55 0.20 145), oklch(0.70 0.17 160))',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Insights VAMO IA */}
        <div className="span-2 glass-card glass-corner p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="bento-label mb-1" style={{ color: 'oklch(0.55 0.18 215)' }}>
                <Brain className="h-3 w-3" />
                Insights IA
              </div>
            </div>
            <div className="stat-icon stat-icon-blue h-8 w-8">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-2">
            {recentAlerts.length > 0 ? (
              recentAlerts.slice(0, 2).map((alert, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{alert}</p>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <Activity className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">Equipe com boa atividade. Sem alertas.</p>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full justify-between text-xs gap-1 mt-3 bg-background/40" render={<Link href="/saude-equipe" />}>
              Saúde da equipe <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Top performers */}
        <div className="span-3 glass-card glass-corner p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="bento-label mb-1" style={{ color: 'oklch(0.65 0.18 70)' }}>
                <Star className="h-3 w-3" />
                Performance da equipe
              </div>
              <h3 className="text-lg font-bold tracking-tight">Ranking atual</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" render={<Link href="/equipe" />}>
              Ver todos <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          {teamMembers.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="stat-icon stat-icon-violet h-12 w-12 mx-auto mb-3">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum vendedor registrado</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" render={<Link href="/configuracoes" />}>
                Configurar equipe
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {teamMembers.slice(0, 5).map((member, i) => {
                const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <Link
                    key={member.user_id}
                    href={`/equipe/${member.user_id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-xl p-2.5 border border-transparent',
                      'hover:bg-background/40 hover:border-border/30 transition-all duration-200',
                      'animate-fade-in-up',
                      `stagger-${i + 1}`
                    )}
                  >
                    <RankIcon rank={i + 1} />
                    <Avatar className="h-9 w-9 ring-2 ring-border/50">
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Nível {member.current_level} · {member.missions_completed} missões
                      </p>
                    </div>
                    <span className="text-sm font-black tabular-nums text-primary shrink-0">
                      {member.total_xp.toLocaleString()} pts
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Nudges / Alertas proativos */}
        <div className="span-3 glass-card glass-corner p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="bento-label mb-1" style={{ color: 'oklch(0.60 0.20 16)' }}>
                <Brain className="h-3 w-3" />
                Alertas proativos
              </div>
              <h3 className="text-lg font-bold tracking-tight">Ações sugeridas</h3>
            </div>
            {nudges.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{nudges.length}</Badge>
            )}
          </div>

          <div className="space-y-2.5">
            {nudges.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <Activity className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">Equipe com boa atividade. Sem alertas no momento.</p>
              </div>
            ) : (
              nudges.slice(0, 3).map((nudge, i) => {
                const Icon = nudge.type === 'burnout'
                  ? HeartPulse
                  : nudge.type === 'recognize'
                  ? Star
                  : MessageCircle
                const iconColor = nudge.type === 'burnout'
                  ? 'stat-icon-rose'
                  : nudge.type === 'recognize'
                  ? 'stat-icon-green'
                  : 'stat-icon-amber'
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border',
                      nudge.borderColor, nudge.bgColor,
                      'animate-fade-in-up',
                      `stagger-${i + 1}`
                    )}
                  >
                    <div className={cn('stat-icon h-8 w-8 shrink-0', iconColor)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">{nudge.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{nudge.message}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>

      {/* Coach VAMO IA */}
      <CoachWidget />
    </div>
  )
}
