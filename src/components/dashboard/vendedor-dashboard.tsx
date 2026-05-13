'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  Flame,
  Medal,
  ArrowRight,
  Sparkles,
  Target,
  DollarSign,
  Zap,
  Brain,
  TrendingDown,
  Trophy,
} from 'lucide-react'
import { CoachWidget } from '@/components/ai/coach-widget'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'
import type { User, UserXp, XpLevel } from '@/types'

interface VendedorDashboardProps {
  user: User
}

interface MissionSummary {
  id: string
  title: string
  status: string
  xp_reward: number
  difficulty: number
}

interface KpiItem {
  kpi_id: string
  name: string
  unit: string
  current: number
  target: number
  trend: 'up' | 'down' | 'stable'
}

const difficultyLabel = (d: number) => {
  if (d === 1) return { text: 'Fácil',   color: 'text-emerald-500', icon: 'stat-icon-green' }
  if (d === 2) return { text: 'Médio',   color: 'text-amber-500',   icon: 'stat-icon-amber' }
  return             { text: 'Difícil',  color: 'text-destructive', icon: 'stat-icon-rose'  }
}

export function VendedorDashboard({ user }: VendedorDashboardProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [currentLevel, setCurrentLevel] = useState<XpLevel | null>(null)
  const [nextLevel, setNextLevel] = useState<XpLevel | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [todayKpiCount, setTodayKpiCount] = useState(0)
  const [activeMissions, setActiveMissions] = useState<MissionSummary[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [totalSellers, setTotalSellers] = useState(0)
  const [myKpis, setMyKpis] = useState<KpiItem[]>([])

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]

        const [results, perfRes] = await Promise.all([
          Promise.allSettled([
            supabase.from('user_xp').select('*').eq('user_id', user.id).maybeSingle(),
            supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('kpi_entries').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
              .gte('recorded_at', `${today}T00:00:00`).lte('recorded_at', `${today}T23:59:59`),
            supabase.from('ai_missions').select('id, title, status, xp_reward, difficulty')
              .eq('user_id', user.id).in('status', ['pending', 'in_progress'])
              .order('created_at', { ascending: false }).limit(4),
          ]),
          fetch('/api/team/performance', { credentials: 'same-origin' }),
        ])

        const val = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
          r.status === 'fulfilled' ? r.value : fallback

        const xpResult     = val(results[0], { data: null, error: null } as any)
        const badgesResult = val(results[1], { count: 0 } as any)
        const kpisResult   = val(results[2], { count: 0 } as any)
        const missionsResult = val(results[3], { data: [] } as any)

        const xp = xpResult.data
        setUserXp(xp)
        setBadgeCount(badgesResult.count ?? 0)
        setTodayKpiCount(kpisResult.count ?? 0)
        setActiveMissions((missionsResult.data ?? []) as MissionSummary[])

        if (perfRes.ok) {
          const { members } = await perfRes.json()
          const list: { user_id: string; total_xp: number }[] = members ?? []
          setTotalSellers(list.length)
          const rank = list.findIndex((r) => r.user_id === user.id)
          setMyRank(rank >= 0 ? rank + 1 : null)
        }

        if (xp) {
          const { data: levels } = await supabase
            .from('xp_levels').select('*').eq('organization_id', user.organization_id).order('level', { ascending: true })
          if (levels) {
            setCurrentLevel(levels.find((l: XpLevel) => l.level === xp.current_level) ?? null)
            setNextLevel(levels.find((l: XpLevel) => l.level === xp.current_level + 1) ?? null)
          }
        }

        try {
          const monthStart = new Date()
          monthStart.setDate(1)
          const monthStartStr = monthStart.toISOString().split('T')[0]

          const { data: kpiDefs } = await supabase
            .from('kpi_definitions')
            .select('id, name, unit, targets')
            .eq('organization_id', user.organization_id)
            .eq('active', true)
            .order('name')

          if (kpiDefs && kpiDefs.length > 0) {
            const { data: entries } = await supabase
              .from('kpi_entries')
              .select('kpi_id, value, recorded_at')
              .eq('user_id', user.id)
              .gte('recorded_at', monthStartStr)
              .order('recorded_at', { ascending: false })

            const kpiItems: KpiItem[] = kpiDefs.map((def: { id: string; name: string; unit: string; targets: unknown }) => {
              const defEntries = (entries ?? []).filter((e: { kpi_id: string; value: number; recorded_at: string }) => e.kpi_id === def.id)
              const latest = defEntries[0]?.value ?? 0
              const prev = defEntries[1]?.value ?? null
              const target = (def.targets as { monthly_target?: number })?.monthly_target ?? 0
              let trend: 'up' | 'down' | 'stable' = 'stable'
              if (prev !== null) {
                if (latest > prev) trend = 'up'
                else if (latest < prev) trend = 'down'
              }
              return { kpi_id: def.id, name: def.name, unit: def.unit, current: latest, target, trend }
            })
            setMyKpis(kpiItems)
          }
        } catch { /* ignore */ }

      } catch (err) {
        console.error('[VendedorDashboard] Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-primary border-t-transparent" />
      </div>
    )
  }

  const xpProgress =
    currentLevel && nextLevel
      ? Math.round(
          (((userXp?.total_xp ?? 0) - currentLevel.xp_required) /
            (nextLevel.xp_required - currentLevel.xp_required)) * 100
        )
      : 100
  const xpToNext = nextLevel ? nextLevel.xp_required - (userXp?.total_xp ?? 0) : 0

  const baseSalary = 2500
  const pendingMissionBonus = activeMissions.reduce((s, m) => s + m.xp_reward * 1.5, 0)
  const maxMissionBonus = pendingMissionBonus * 1.4

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <PageHeader
        label="Minha Performance"
        title={<>Olá, <TitleHighlight>{user.name.split(' ')[0]}</TitleHighlight></>}
        description="Resumo completo do seu progresso em tempo real"
        actions={
          userXp && userXp.current_streak > 0 ? (
            <span className="streak-pill">
              <Flame className="h-3 w-3" />
              Streak {userXp.current_streak} dias
            </span>
          ) : undefined
        }
      />

      {/* ── BENTO GRID ── */}
      <div className="bento animate-fade-in-up stagger-1">

        {/* HERO: XP giant */}
        <div className="span-4 glass-card-primary glass-corner p-7 md:p-8 relative overflow-hidden">
          <div className="glow-orb glow-orb-green -top-20 -right-20 w-64 h-64" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="bento-label">
                <Zap className="h-3 w-3" />
                Experiência total
              </div>
              {currentLevel && (
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {currentLevel.name}
                </Badge>
              )}
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="hero-number">
                {(userXp?.total_xp ?? 0).toLocaleString()}
              </span>
              <span className="text-xl font-black text-muted-foreground">pontos</span>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Nível <span className="font-bold text-foreground tabular-nums">{userXp?.current_level ?? 1}</span>
                </span>
                {nextLevel && (
                  <span className="text-muted-foreground tabular-nums">
                    <span className="font-bold text-primary">{xpToNext.toLocaleString()}</span> pontos para Nv {nextLevel.level}
                  </span>
                )}
              </div>
              <div className="xp-track h-2 w-full">
                <div className="xp-fill h-full" style={{ width: `${xpProgress}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 uppercase tracking-wider font-bold">
                <span>{xpProgress}% do nível</span>
                {nextLevel && <span>{nextLevel.name}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Ranking BIG */}
        <div className="span-2 glass-card glass-hover glass-corner p-6 relative overflow-hidden">
          <div className="bento-label mb-2" style={{ color: 'oklch(0.65 0.18 70)' }}>
            <Trophy className="h-3 w-3" />
            Ranking
          </div>
          <div className="hero-number-md font-black tabular-nums" style={{ color: 'oklch(0.65 0.18 70)' }}>
            {myRank ? `#${myRank}` : '—'}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {totalSellers > 0 ? `de ${totalSellers} vendedores` : 'posição na equipe'}
          </p>
          <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-10" style={{ background: 'oklch(0.65 0.18 70)', filter: 'blur(30px)' }} />
        </div>

        {/* Streak */}
        <div className="span-2 glass-card glass-hover p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="stat-icon stat-icon-orange h-10 w-10">
              <Flame className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Streak</span>
          </div>
          <p className="text-4xl font-black tabular-nums">{userXp?.current_streak ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-1">dias consecutivos</p>
        </div>

        {/* Badges */}
        <div className="span-2 glass-card glass-hover p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="stat-icon stat-icon-violet h-10 w-10">
              <Medal className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Conquistas</span>
          </div>
          <p className="text-4xl font-black tabular-nums">{badgeCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">badges desbloqueadas</p>
        </div>

        {/* KPI hoje */}
        <div className="span-2 glass-card glass-hover p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="stat-icon stat-icon-blue h-10 w-10">
              <Target className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">KPIs hoje</span>
          </div>
          <p className="text-4xl font-black tabular-nums">{todayKpiCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">registros hoje</p>
        </div>

        {/* KPIs vs Metas — wide card */}
        <div className="span-6 glass-card glass-corner p-6 md:p-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="bento-label mb-1.5">
                <Target className="h-3 w-3" />
                Indicadores vs metas
              </div>
              <h3 className="text-lg font-bold tracking-tight">Meu progresso mensal</h3>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </Badge>
          </div>

          {myKpis.length === 0 ? (
            <div className="py-10 text-center">
              <div className="stat-icon stat-icon-blue h-12 w-12 mx-auto mb-3">
                <Target className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum KPI registrado ainda</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Registre seus indicadores para acompanhar o progresso</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {myKpis.map((kpi, i) => {
                const pct = Math.min(100, Math.round((kpi.current / kpi.target) * 100))
                const isOnTrack = pct >= 70
                const isAtRisk  = pct >= 40 && pct < 70
                const statusColor = isOnTrack ? 'text-emerald-500' : isAtRisk ? 'text-amber-500' : 'text-destructive'
                const barGradient = isOnTrack
                  ? 'linear-gradient(90deg, oklch(0.55 0.18 145), oklch(0.70 0.20 155))'
                  : isAtRisk
                  ? 'linear-gradient(90deg, oklch(0.70 0.18 70), oklch(0.80 0.19 60))'
                  : 'linear-gradient(90deg, oklch(0.60 0.22 16), oklch(0.70 0.24 20))'

                return (
                  <div
                    key={kpi.name}
                    className={cn(
                      'relative p-4 rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm',
                      'animate-fade-in-up',
                      `stagger-${i + 1}`
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{kpi.name}</span>
                        {kpi.trend === 'up'   && <TrendingUp   className="h-3 w-3 text-emerald-500" />}
                        {kpi.trend === 'down' && <TrendingDown className="h-3 w-3 text-destructive" />}
                      </div>
                      <span className={cn('text-2xl font-black tabular-nums', statusColor)}>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barGradient }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                      {kpi.unit === 'R$'
                        ? `R$ ${kpi.current.toLocaleString('pt-BR')} / R$ ${kpi.target.toLocaleString('pt-BR')}`
                        : `${kpi.current} / ${kpi.target} ${kpi.unit}`}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Missões ativas */}
        <div className="span-3 glass-card glass-corner p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="bento-label mb-1.5" style={{ color: 'oklch(0.65 0.18 70)' }}>
                <Sparkles className="h-3 w-3" />
                Missões ativas
              </div>
              <h3 className="text-lg font-bold tracking-tight">Em andamento</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" render={<Link href="/performance/missoes" />}>
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </div>

          {activeMissions.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="stat-icon stat-icon-amber h-12 w-12 mx-auto mb-3">
                <Zap className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhuma missão ativa</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Aguarde novas missões da VAMO IA</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeMissions.slice(0, 4).map((mission, i) => {
                const diff = difficultyLabel(mission.difficulty)
                const bonus = Math.round(mission.xp_reward * 1.5)
                return (
                  <div
                    key={mission.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-background/40',
                      'hover:border-primary/30 hover:bg-primary/5 transition-all duration-200',
                      'animate-fade-in-up',
                      `stagger-${i + 1}`
                    )}
                  >
                    <div className={cn('stat-icon h-9 w-9 shrink-0', diff.icon)}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{mission.title}</p>
                      <p className={cn('text-[10px] font-medium mt-0.5', diff.color)}>{diff.text}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-[10px] font-bold">+{mission.xp_reward} pts</Badge>
                      <p className="text-[10px] text-emerald-500 font-semibold mt-0.5 tabular-nums">R$ {bonus}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Projeção de ganhos — HUGE */}
        <div className="span-3 glass-card-primary glass-corner p-6 relative overflow-hidden">
          <div className="glow-orb glow-orb-green -bottom-16 -left-16 w-48 h-48" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="bento-label">
                <DollarSign className="h-3 w-3" />
                Projeção de ganhos
              </div>
              <span className="pill-glow">
                <Brain className="h-2.5 w-2.5" />
                VAMO IA
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground mb-1">Cenário máximo este mês</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="hero-number-md text-gradient-primary">
                R$ {(baseSalary + maxMissionBonus).toLocaleString('pt-BR')}
              </span>
            </div>
            <p className="text-[11px] text-emerald-500 font-semibold mt-1">
              +R$ {maxMissionBonus.toLocaleString('pt-BR')} de bônus potencial
            </p>

            <div className="mt-4 space-y-2">
              {[
                { label: 'Atual', value: baseSalary, dim: true },
                { label: 'Com missões ativas', value: baseSalary + pendingMissionBonus, mid: true },
                { label: 'Máximo (todas metas)', value: baseSalary + maxMissionBonus, top: true },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs py-2 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className={cn(
                    'font-black tabular-nums',
                    s.top && 'text-emerald-500',
                    s.mid && 'text-amber-500',
                    s.dim && 'text-muted-foreground',
                  )}>
                    R$ {s.value.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" className="w-full text-xs mt-4 gap-1 bg-background/60 backdrop-blur-sm hover:bg-primary/10 hover:border-primary/40" render={<Link href="/meus-ganhos" />}>
              Ver comissão detalhada <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {/* Quick actions */}
        <Link href="/meus-ganhos" className="span-3 group">
          <div className="glass-card glass-hover p-5 h-full flex items-center gap-4">
            <div className="stat-icon stat-icon-green h-12 w-12 shrink-0">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Meus Ganhos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Comissão, bônus e projeções</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
          </div>
        </Link>
        <Link href="/feed" className="span-3 group">
          <div className="glass-card glass-hover p-5 h-full flex items-center gap-4">
            <div className="stat-icon stat-icon-blue h-12 w-12 shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Feed & Recompensas</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Loja, conquistas e atividades</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
          </div>
        </Link>
      </div>

      {/* Coach VAMO IA */}
      <CoachWidget />
    </div>
  )
}
