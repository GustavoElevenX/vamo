'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  Flame,
  Medal,
  ArrowRight,
  Sparkles,
  Target,
  DollarSign,
  Zap,
  Star,
  ChevronRight,
  Brain,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react'
import { CoachWidget } from '@/components/ai/coach-widget'
import type { User, UserXp, XpLevel, BehavioralProfile } from '@/types'

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

// Módulo 2 — KPI card data
const MY_KPIS = [
  { name: 'Taxa de Fechamento', current: 22, target: 35, unit: '%', trend: 'up' as const },
  { name: 'Ligações / Semana', current: 27, target: 40, unit: '', trend: 'up' as const },
  { name: 'Ticket Médio', current: 7200, target: 9500, unit: 'R$', trend: 'stable' as const },
  { name: '% CRM Atualizado', current: 68, target: 95, unit: '%', trend: 'down' as const },
]

// Módulo 6 — DISC feedback by profile
const DISC_FEEDBACK: Record<string, { strengths: string[]; opportunities: string[]; insight: string }> = {
  D: {
    strengths: [
      'Sua taxa de fechamento em primeira reunião é 20% acima da média da equipe',
      'Alta capacidade de superar objeções com firmeza e argumentos diretos',
      'Você é referência em velocidade de resposta e follow-up rápido',
    ],
    opportunities: [
      'Ticket médio abaixo do potencial — perfil D tende a ir direto ao preço sem construir valor suficiente',
      'Aprender a fazer perguntas consultivas antes de apresentar a solução pode aumentar seu ticket em 15–20%',
    ],
    insight: 'A IA detectou que seu engajamento aumenta o resultado coletivo quando você lidera desafios de time. Experimente as missões coletivas.',
  },
  I: {
    strengths: [
      'Sua taxa de conversão em Primeira Reunião é 20% acima da média da equipe',
      'Perfil Influenciador cria rapport rapidamente — você conquista confiança do cliente em poucos minutos',
      'Você tem o maior índice de indicações da equipe',
    ],
    opportunities: [
      'Ticket médio abaixo do potencial — perfil I tem alta capacidade para vendas consultivas de maior valor',
      'Identificar oportunidades de upsell pode aumentar seu ticket em 15–20%',
    ],
    insight: 'A IA detectou que seu engajamento sobe o engajamento médio coletivo quando você está ativo em missões colaborativas.',
  },
  S: {
    strengths: [
      'Você tem a maior taxa de retenção de clientes da equipe',
      'Sua consistência no CRM é a mais alta — dados sempre organizados e atualizados',
      'Clientes antigos confiam em você para expansão — maior LTV médio',
    ],
    opportunities: [
      'Metas de volume alto podem gerar estresse — prefira metas de qualidade que se alinham ao seu estilo',
      'Prospecção ativa (frio) é o ponto de desenvolvimento — seu ponto forte é relacionamento com clientes existentes',
    ],
    insight: 'A IA sugere missões de upsell em clientes existentes — área onde seu perfil S tem 3x mais chances de sucesso.',
  },
  C: {
    strengths: [
      'Sua taxa de conversão em propostas técnicas é a mais alta da equipe',
      'Você prepara as apresentações mais completas e bem fundamentadas',
      'Sua análise de dados antes de cada reunião é um diferencial percebido pelos clientes',
    ],
    opportunities: [
      'Ciclo de vendas acima da média — perfil C tende a analisar demais antes de avançar',
      'Estabelecer critérios claros de quando avançar no funil pode reduzir seu ciclo em 25–30%',
    ],
    insight: 'A IA detectou que você fecha mais quando tem acesso a dados e comparativos. Peça estudos de caso antes de cada proposta.',
  },
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
  const [discProfile, setDiscProfile] = useState<BehavioralProfile | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      const today = new Date().toISOString().split('T')[0]

      const [
        { data: xp },
        { count: badges },
        { count: kpis },
        { data: missions },
        { data: allXp },
        { count: sellers },
      ] = await Promise.all([
        supabase.from('user_xp').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('kpi_entries').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
          .gte('recorded_at', `${today}T00:00:00`).lte('recorded_at', `${today}T23:59:59`),
        supabase.from('ai_missions').select('id, title, status, xp_reward, difficulty')
          .eq('user_id', user.id).in('status', ['pending', 'in_progress'])
          .order('created_at', { ascending: false }).limit(4),
        supabase.from('user_xp').select('user_id, total_xp').eq('organization_id', user.organization_id)
          .order('total_xp', { ascending: false }),
        supabase.from('users').select('*', { count: 'exact', head: true })
          .eq('organization_id', user.organization_id).eq('role', 'seller').eq('active', true),
      ])

      setUserXp(xp)
      setBadgeCount(badges ?? 0)
      setTodayKpiCount(kpis ?? 0)
      setActiveMissions((missions ?? []) as MissionSummary[])
      setTotalSellers(sellers ?? 0)

      if (allXp) {
        const rank = allXp.findIndex((r: any) => r.user_id === user.id)
        setMyRank(rank >= 0 ? rank + 1 : null)
      }

      if (xp) {
        const { data: levels } = await supabase
          .from('xp_levels').select('*').eq('organization_id', user.organization_id).order('level', { ascending: true })
        if (levels) {
          setCurrentLevel(levels.find((l: any) => l.level === xp.current_level) ?? null)
          setNextLevel(levels.find((l: any) => l.level === xp.current_level + 1) ?? null)
        }
      }

      // Load DISC profile
      try {
        const res = await fetch('/api/ai/behavioral-profile')
        if (res.ok) {
          const data = await res.json()
          if (data.profile) setDiscProfile(data.profile)
        }
      } catch { /* ignore */ }

      setLoading(false)
    }

    fetchAll()
  }, [user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const xpToNext = nextLevel ? nextLevel.xp_required - (userXp?.total_xp ?? 0) : 0
  const xpProgress =
    currentLevel && nextLevel
      ? Math.round(
          (((userXp?.total_xp ?? 0) - currentLevel.xp_required) /
            (nextLevel.xp_required - currentLevel.xp_required)) * 100
        )
      : 100

  const difficultyLabel = (d: number) => {
    if (d === 1) return { text: 'Fácil', color: 'text-emerald-500' }
    if (d === 2) return { text: 'Médio', color: 'text-amber-500' }
    return { text: 'Difícil', color: 'text-red-500' }
  }

  // Earnings projection — 3 scenarios
  const baseSalary = 2500
  const completedMissionBonus = 0 // would come from DB in production
  const pendingMissionBonus = activeMissions.reduce((s, m) => s + m.xp_reward * 1.5, 0)
  const maxMissionBonus = pendingMissionBonus * 1.4 // if also accepts suggested missions

  const scenarios = [
    {
      label: 'Cenário Atual',
      desc: 'Sem completar novas missões',
      total: baseSalary + completedMissionBonus,
      color: 'text-muted-foreground',
      border: 'border-border/40',
    },
    {
      label: 'Com Missões Ativas',
      desc: `Se completar ${activeMissions.length} missões em andamento`,
      total: baseSalary + completedMissionBonus + pendingMissionBonus,
      color: 'text-amber-500',
      border: 'border-amber-500/20 bg-amber-500/5',
    },
    {
      label: 'Cenário Máximo',
      desc: 'Todas as missões + KPIs no topo',
      total: baseSalary + completedMissionBonus + maxMissionBonus,
      color: 'text-emerald-500',
      border: 'border-emerald-500/20 bg-emerald-500/5',
    },
  ]

  const discFeedback = discProfile
    ? DISC_FEEDBACK[discProfile.dominant_profile] ?? DISC_FEEDBACK['I']
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Olá, {user.name.split(' ')[0]}!
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Minha Performance — resumo completo
        </p>
      </div>

      {/* ── Módulo 1: XP & Level Hero ── */}
      <Card className="border-border/50">
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                  strokeDasharray={`${(xpProgress / 100) * 264} 264`}
                  strokeLinecap="round" className="text-emerald-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">{userXp?.current_level ?? 1}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">nível</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">{(userXp?.total_xp ?? 0).toLocaleString()} XP</p>
                {currentLevel && (
                  <Badge variant="secondary" className="text-[10px]">{currentLevel.name}</Badge>
                )}
                {myRank && (
                  <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                    #{myRank} Ranking
                  </Badge>
                )}
              </div>
              {nextLevel && (
                <>
                  <Progress value={xpProgress} className="h-2 mt-2 [&>div]:bg-emerald-500" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {xpToNext.toLocaleString()} XP para Nível {nextLevel.level} ({nextLevel.name})
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{userXp?.current_streak ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Streak (dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Medal className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{badgeCount}</p>
                <p className="text-[10px] text-muted-foreground">Conquistas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{todayKpiCount}</p>
                <p className="text-[10px] text-muted-foreground">KPIs hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Star className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{myRank ? `#${myRank}` : '—'}</p>
                <p className="text-[10px] text-muted-foreground">
                  Ranking{totalSellers > 0 ? ` / ${totalSellers}` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Módulo 2: Meus Indicadores vs Metas ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-medium">Meus Indicadores vs Metas</CardTitle>
            </div>
            <Badge variant="secondary" className="text-[10px]">Março 2026</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {MY_KPIS.map((kpi) => {
            const pct = Math.min(100, Math.round((kpi.current / kpi.target) * 100))
            const isOnTrack = pct >= 70
            const isAtRisk = pct >= 40 && pct < 70
            const color = isOnTrack ? 'text-emerald-500 [&>div]:bg-emerald-500' :
              isAtRisk ? 'text-amber-500 [&>div]:bg-amber-500' :
              'text-red-500 [&>div]:bg-red-500'
            const status = isOnTrack ? 'Meta em andamento' : isAtRisk ? 'Atenção' : 'Abaixo da meta'
            const statusColor = isOnTrack ? 'text-emerald-500' : isAtRisk ? 'text-amber-500' : 'text-red-500'

            return (
              <div key={kpi.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{kpi.name}</span>
                    {kpi.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                    {kpi.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {kpi.unit === 'R$' ? `R$ ${kpi.current.toLocaleString('pt-BR')}` : `${kpi.current}${kpi.unit}`}
                      {' / '}
                      {kpi.unit === 'R$' ? `R$ ${kpi.target.toLocaleString('pt-BR')}` : `${kpi.target}${kpi.unit}`}
                    </span>
                    <span className={`text-[10px] font-medium ${statusColor}`}>{pct}%</span>
                  </div>
                </div>
                <Progress value={pct} className={`h-1.5 ${color}`} />
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[10px] ${statusColor}`}>{status}</span>
                  {kpi.name === 'Ticket Médio' && pct < 80 && (
                    <span className="text-[10px] text-muted-foreground">
                      Atingir meta → +R$ 600 de bônus
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Módulo 3: Missões Ativas ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium">Missões Ativas</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" render={<Link href="/missoes" />}>
              Ver todas <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeMissions.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Zap className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma missão ativa.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Missões são geradas pela IA com base no seu perfil.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeMissions.map((mission) => {
                const diff = difficultyLabel(mission.difficulty)
                const bonus = Math.round(mission.xp_reward * 1.5)
                return (
                  <div
                    key={mission.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mission.title}</p>
                      <p className={`text-[10px] ${diff.color}`}>{diff.text}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="text-[10px]">+{mission.xp_reward} XP</Badge>
                      <p className="text-[10px] text-emerald-500 font-medium mt-0.5">R$ {bonus}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Módulo 5: Projeção de Ganhos — 3 Cenários ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm font-medium">Projeção de Ganhos</CardTitle>
            <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-500 border-0">
              <Brain className="h-2.5 w-2.5 mr-0.5" />IA
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {scenarios.map((scenario, i) => (
            <div
              key={scenario.label}
              className={`flex items-center gap-3 p-3 rounded-lg border ${scenario.border}`}
            >
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i === 0 ? 'bg-muted text-muted-foreground' :
                i === 1 ? 'bg-amber-500/15 text-amber-500' :
                'bg-emerald-500/15 text-emerald-500'
              }`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{scenario.label}</p>
                <p className="text-[10px] text-muted-foreground">{scenario.desc}</p>
              </div>
              <span className={`text-base font-bold shrink-0 ${scenario.color}`}>
                R$ {scenario.total.toLocaleString('pt-BR')}
              </span>
            </div>
          ))}

          {activeMissions.length > 0 && (
            <div className="pt-1 space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium">Ações × Ganho adicional:</p>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Completar missão de upsell</span>
                <span className="text-emerald-500 font-medium">+R$ 600 potencial</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Manter streak do CRM até dia 30</span>
                <span className="text-emerald-500 font-medium">+R$ 150 garantido + badge</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Fechar 2 negócios esta semana</span>
                <span className="text-emerald-500 font-medium">+R$ 280 comissão base</span>
              </div>
            </div>
          )}

          <Link href="/meus-ganhos">
            <Button variant="outline" size="sm" className="w-full text-xs mt-1">
              Ver comissão detalhada <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* ── Módulo 6: Feedback da IA ── */}
      {discProfile && discFeedback ? (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-medium">Feedback da IA</CardTitle>
              <Badge variant="secondary" className="text-[9px]">
                Perfil {discProfile.dominant_profile} · {discProfile.profile_name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-2">
                Pontos Fortes Confirmados pelos Dados
              </p>
              <ul className="space-y-1.5">
                {discFeedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-2">
                Oportunidades de Desenvolvimento
              </p>
              <ul className="space-y-1.5">
                {discFeedback.opportunities.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-background/50 p-2.5">
              <p className="text-xs text-muted-foreground">
                <Brain className="inline h-3 w-3 text-blue-500 mr-1" />
                <strong>Insight coletivo:</strong> {discFeedback.insight}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Feedback personalizado da IA</p>
                <p className="text-xs text-muted-foreground">Complete seu Perfil Comportamental DISC para receber insights personalizados.</p>
              </div>
              <Link href="/perfil-comportamental">
                <Button size="sm" variant="outline" className="text-xs h-7 shrink-0">
                  Fazer agora <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-2">
        <Button variant="outline" className="h-auto py-3 flex-col gap-1" render={<Link href="/meus-ganhos" />}>
          <DollarSign className="h-5 w-5 text-emerald-500" />
          <span className="text-xs font-medium">Meus Ganhos</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1" render={<Link href="/feed" />}>
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <span className="text-xs font-medium">Feed & Recompensas</span>
        </Button>
      </div>

      {/* Coach IA */}
      <CoachWidget />
    </div>
  )
}
