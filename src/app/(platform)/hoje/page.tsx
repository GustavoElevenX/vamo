'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache } from '@/lib/cache'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import { ContextualRecommendationCard, type ContextualRecommendation } from '@/components/performance-os/ContextualRecommendationCard'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Flame,
  MessageSquare,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

function formatDate(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function compactCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function dueLabel(value: string | null | undefined): string {
  if (!value) return 'sem prazo'
  const diffDays = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
  if (diffDays < 0) return `${Math.abs(diffDays)}d atrasado`
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'amanhã'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function isOverdue(value: string | null | undefined): boolean {
  return !!value && new Date(value).getTime() < Date.now()
}

interface MissionData {
  id: string
  title: string
  description: string
  xp_reward: number
  status: string
  difficulty: number
}

interface KpiProgress {
  name: string
  current: number
  target: number
  unit: string
}

interface SellerDeal {
  id: string
  title: string
  value: number
  stage: string
  probability: number
  expected_close: string | null
  last_activity_at: string | null
  next_action_title: string | null
  next_action_due_at: string | null
  forecast_category: string | null
  ai_priority_score: number | null
  account?: { name?: string | null } | null
}

interface HojeCache {
  streak: number
  priorityMission: MissionData | null
  activeMissionCount: number
  dailyKpi: KpiProgress | null
  monthlyEarnings: number
  projectedBonus: number
  hasCheckinToday: boolean
  lastRecognition: string | null
  deals: SellerDeal[]
}

type Priority =
  | { kind: 'deal'; title: string; description: string; href: string; gain: number; tone: 'rose' | 'amber' | 'green' }
  | { kind: 'mission'; title: string; description: string; href: string; gain: number; tone: 'green' }
  | { kind: 'kpi'; title: string; description: string; href: string; gain: number; tone: 'amber' }

function scoreDeal(deal: SellerDeal): number {
  const valueScore = Math.min(Number(deal.value || 0) / 1000, 25)
  const overdueScore = isOverdue(deal.next_action_due_at) ? 45 : 0
  const missingActionScore = deal.next_action_title ? 0 : 30
  const aiScore = Number(deal.ai_priority_score || 0) * 0.35
  return valueScore + overdueScore + missingActionScore + aiScore + Number(deal.probability || 0) * 0.2
}

export default function HojePage() {
  const { user } = useRequiredAuth()
  const supabaseRef = useRef(createClient())
  const [initialCache] = useState(() => getCached<HojeCache>('hoje'))
  const [loading, setLoading] = useState(() => !initialCache)
  const [streak, setStreak] = useState(initialCache?.streak ?? 0)
  const [priorityMission, setPriorityMission] = useState<MissionData | null>(initialCache?.priorityMission ?? null)
  const [activeMissionCount, setActiveMissionCount] = useState(initialCache?.activeMissionCount ?? 0)
  const [dailyKpi, setDailyKpi] = useState<KpiProgress | null>(initialCache?.dailyKpi ?? null)
  const [monthlyEarnings, setMonthlyEarnings] = useState(initialCache?.monthlyEarnings ?? 0)
  const [projectedBonus, setProjectedBonus] = useState(initialCache?.projectedBonus ?? 0)
  const [hasCheckinToday, setHasCheckinToday] = useState(initialCache?.hasCheckinToday ?? false)
  const [lastRecognition, setLastRecognition] = useState<string | null>(initialCache?.lastRecognition ?? null)
  const [deals, setDeals] = useState<SellerDeal[]>(initialCache?.deals ?? [])
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const fetchData = async () => {
      const supabase = supabaseRef.current
      const today = new Date().toISOString().split('T')[0]
      const monthStart = `${today.substring(0, 7)}-01`

      const queries = Promise.allSettled([
        supabase
          .from('user_xp')
          .select('current_streak, longest_streak')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('ai_missions')
          .select('id, title, description, xp_reward, status, difficulty')
          .eq('user_id', user.id)
          .in('status', ['pending', 'in_progress'])
          .order('xp_reward', { ascending: false })
          .limit(5),
        supabase
          .from('kpi_definitions')
          .select('id, name, unit, targets')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('kpi_entries')
          .select('value, kpi_id')
          .eq('user_id', user.id)
          .gte('recorded_at', `${today}T00:00:00`)
          .lte('recorded_at', `${today}T23:59:59`),
        supabase
          .from('kpi_entries')
          .select('points_earned')
          .eq('user_id', user.id)
          .gte('recorded_at', `${monthStart}T00:00:00`),
        supabase
          .from('daily_checkins')
          .select('id')
          .eq('user_id', user.id)
          .eq('checkin_date', today)
          .maybeSingle(),
        supabase
          .from('xp_transactions')
          .select('description, created_at')
          .eq('user_id', user.id)
          .eq('source_type', 'bonus')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        fetch('/api/crm/deals').then(async (res) => (res.ok ? res.json() : { deals: [] })),
        fetch('/api/action-recommendations').then(async (res) => (res.ok ? res.json() : { recommendations: [] })),
      ])

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 20_000)
      )

      const results = await Promise.race([queries, timeout])

      const xpData = results[0].status === 'fulfilled' ? results[0].value.data : null
      const missions = results[1].status === 'fulfilled' ? results[1].value.data : null
      const kpiDefs = results[2].status === 'fulfilled' ? results[2].value.data : null
      const todayEntries = results[3].status === 'fulfilled' ? results[3].value.data : null
      const monthEntries = results[4].status === 'fulfilled' ? results[4].value.data : null
      const checkin = results[5].status === 'fulfilled' ? results[5].value.data : null
      const recentXp = results[6].status === 'fulfilled' ? results[6].value.data : null
      const dealBody = results[7].status === 'fulfilled' ? results[7].value : { deals: [] }
      const recommendationBody = results[8].status === 'fulfilled' ? results[8].value : { recommendations: [] }

      if (cancelled) return

      const newStreak = xpData?.current_streak ?? 0
      const newPriorityMission = missions?.[0] ?? null
      const newActiveMissionCount = missions?.length ?? 0

      let newDailyKpi: KpiProgress | null = null
      if (kpiDefs && todayEntries) {
        const todayTotal = todayEntries
          .filter((entry: { kpi_id: string }) => entry.kpi_id === kpiDefs.id)
          .reduce((sum: number, entry: { value?: number }) => sum + (entry.value || 0), 0)
        newDailyKpi = {
          name: kpiDefs.name,
          current: todayTotal,
          target: (kpiDefs.targets as { daily?: number } | null)?.daily || 0,
          unit: kpiDefs.unit,
        }
      }

      const totalPoints = monthEntries?.reduce((sum: number, entry: { points_earned?: number }) => sum + (entry.points_earned || 0), 0) ?? 0
      const newMonthlyEarnings = totalPoints * 10
      const newProjectedBonus = newPriorityMission ? newPriorityMission.xp_reward * 10 : 0
      const newHasCheckin = !!checkin

      let newRecognition: string | null = null
      if (recentXp) {
        const diffHours = (Date.now() - new Date(recentXp.created_at).getTime()) / 3600000
        if (diffHours <= 48) newRecognition = recentXp.description
      }

      const newDeals = ((dealBody.deals ?? []) as SellerDeal[]).filter(
        (deal) => deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'
      )
      const newRecommendations = ((recommendationBody.recommendations ?? []) as ContextualRecommendation[]).slice(0, 3)

      setStreak(newStreak)
      setPriorityMission(newPriorityMission)
      setActiveMissionCount(newActiveMissionCount)
      setDailyKpi(newDailyKpi)
      setMonthlyEarnings(newMonthlyEarnings)
      setProjectedBonus(newProjectedBonus)
      setHasCheckinToday(newHasCheckin)
      setLastRecognition(newRecognition)
      setDeals(newDeals)
      setRecommendations(newRecommendations)
      setLoading(false)

      setCache<HojeCache>('hoje', {
        streak: newStreak,
        priorityMission: newPriorityMission,
        activeMissionCount: newActiveMissionCount,
        dailyKpi: newDailyKpi,
        monthlyEarnings: newMonthlyEarnings,
        projectedBonus: newProjectedBonus,
        hasCheckinToday: newHasCheckin,
        lastRecognition: newRecognition,
        deals: newDeals,
      }, 3 * 60 * 1000)
    }

    fetchData().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [user])

  const sortedDeals = useMemo(() => [...deals].sort((a, b) => scoreDeal(b) - scoreDeal(a)), [deals])
  const overdueDeals = useMemo(() => deals.filter((deal) => isOverdue(deal.next_action_due_at)), [deals])
  const noActionDeals = useMemo(() => deals.filter((deal) => !deal.next_action_title), [deals])
  const forecastLikely = useMemo(
    () => deals.reduce((sum, deal) => sum + (Number(deal.value || 0) * Number(deal.probability || 0)) / 100, 0),
    [deals]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const firstName = user.name.split(' ')[0]
  const kpiPct = dailyKpi?.target ? Math.min((dailyKpi.current / dailyKpi.target) * 100, 100) : 0
  const kpiRisk = !!dailyKpi?.target && dailyKpi.current < dailyKpi.target
  const topDeal = sortedDeals[0]
  const priority: Priority = overdueDeals[0]
    ? {
        kind: 'deal',
        title: overdueDeals[0].next_action_title || `Retomar ${overdueDeals[0].account?.name || overdueDeals[0].title}`,
        description: `Follow-up atrasado em ${overdueDeals[0].account?.name || overdueDeals[0].title}. Forecast impactado em ${compactCurrency(Number(overdueDeals[0].value || 0))}.`,
        href: `/crm/${overdueDeals[0].id}`,
        gain: Number(overdueDeals[0].value || 0) * Number(overdueDeals[0].probability || 0) / 100,
        tone: 'rose',
      }
    : noActionDeals[0]
      ? {
          kind: 'deal',
          title: `Definir próxima ação: ${noActionDeals[0].account?.name || noActionDeals[0].title}`,
          description: 'Este deal está aberto, mas ainda não tem um próximo passo claro.',
          href: `/crm/${noActionDeals[0].id}`,
          gain: Number(noActionDeals[0].value || 0) * Number(noActionDeals[0].probability || 0) / 100,
          tone: 'amber',
        }
      : priorityMission
        ? {
            kind: 'mission',
            title: priorityMission.title,
            description: priorityMission.description,
            href: '/performance/missoes',
            gain: projectedBonus,
            tone: 'green',
          }
        : {
            kind: 'kpi',
            title: dailyKpi ? `Registrar ${dailyKpi.name}` : 'Registrar a primeira ação do dia',
            description: dailyKpi ? `Faltam ${Math.max(dailyKpi.target - dailyKpi.current, 0)} ${dailyKpi.unit} para fechar a meta diaria.` : 'Comece o dia registrando uma atividade comercial.',
            href: '/kpis/registrar',
            gain: 0,
            tone: 'amber',
          }

  const priorityTone = {
    rose: 'border-red-500/25 bg-red-500/10 text-red-500',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
    green: 'border-primary/25 bg-primary/10 text-primary',
  }[priority.tone]

  return (
    <div className="space-y-6">
      <PageHeader
        label="Hoje"
        title={<>Copiloto <TitleHighlight>diário</TitleHighlight></>}
        description={`Bom dia, ${firstName}. ${formatDate()} - veja onde colocar energia agora.`}
        actions={(
          <>
            {streak > 0 && <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500"><Flame className="h-3 w-3" />{streak} dias</Badge>}
            <Badge className="border-primary/20 bg-primary/10 text-primary">Vendedor</Badge>
          </>
        )}
      />

      <div className="briefing-banner flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">VAMO IA - Briefing de hoje</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Priorize <span className="font-semibold text-primary">{priority.title}</span>. Isso protege forecast, ganho potencial e ritmo de execucao.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{overdueDeals.length} atrasados</Badge>
              <Badge variant="outline">{activeMissionCount} missões</Badge>
          <Badge variant="outline">{compactCurrency(forecastLikely)} forecast</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={DollarSign} label="Ganho do mês" value={formatCurrency(monthlyEarnings)} hint={projectedBonus ? `+${formatCurrency(projectedBonus)} se cumprir a missão` : 'parcial acumulada'} />
        <StatCard icon={TrendingUp} label="Forecast provável" value={compactCurrency(forecastLikely)} hint={`${deals.length} deals em movimento`} />
        <StatCard icon={AlertTriangle} label="Risco hoje" value={`${overdueDeals.length + noActionDeals.length}`} hint="ações atrasadas ou sem próximo passo" />
        <StatCard icon={Target} label="KPI diário" value={dailyKpi ? `${Math.round(kpiPct)}%` : '0%'} hint={dailyKpi ? `${dailyKpi.current}/${dailyKpi.target} ${dailyKpi.unit}` : 'sem meta configurada'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="space-y-5 pt-6">
            <div className="section-label"><span className="h-1.5 w-1.5 rounded-full bg-current" />Prioridade do dia</div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <Badge className={priorityTone}>{priority.kind === 'deal' ? 'Vender' : priority.kind === 'mission' ? 'Evoluir' : 'Executar'}</Badge>
                <h2 className="text-2xl font-black tracking-tight">{priority.title}</h2>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{priority.description}</p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-background/50 p-4 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ganho potencial</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-primary">{priority.gain ? compactCurrency(priority.gain) : '+XP'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button render={<Link href={priority.href} />}>
                Executar agora <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" render={<Link href="/chat-ia" />}>
                <MessageSquare className="h-4 w-4" />
                Pedir script a IA
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
              <div className="section-label"><span className="h-1.5 w-1.5 rounded-full bg-current" />KPI em foco</div>
            {dailyKpi ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{dailyKpi.name}</p>
                    <p className="text-sm text-muted-foreground">{dailyKpi.current}/{dailyKpi.target} {dailyKpi.unit}</p>
                  </div>
                  {kpiRisk ? <Badge variant="outline" className="text-amber-500">em risco</Badge> : <Badge className="bg-primary/10 text-primary">feito</Badge>}
                </div>
                <Progress value={kpiPct} className="h-3" />
                <Button variant="outline" className="w-full" render={<Link href="/kpis/registrar" />}>
                  Registrar KPI
                </Button>
              </>
            ) : (
              <EmptyLine icon={Target} title="Sem KPI diário" description="Quando o gestor configurar indicadores, eles aparecem aqui." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="section-label"><span className="h-1.5 w-1.5 rounded-full bg-current" />Próximas ações</div>
              <Button variant="ghost" size="sm" render={<Link href="/crm" />}>Ver pipeline</Button>
            </div>
            {sortedDeals.length ? (
              <div className="space-y-3">
                {sortedDeals.slice(0, 5).map((deal) => (
                  <Link key={deal.id} href={`/crm/${deal.id}`} className="block rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{deal.account?.name || deal.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{deal.next_action_title || 'Definir próxima ação'}</p>
                      </div>
                      <Badge variant={isOverdue(deal.next_action_due_at) ? 'destructive' : 'outline'} className="shrink-0">
                        <CalendarClock className="h-3 w-3" />
                        {dueLabel(deal.next_action_due_at)}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Number(deal.probability || 0)}% prob.</span>
                      <span className="font-semibold tabular-nums text-foreground">{compactCurrency(Number(deal.value || 0))}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyLine icon={CalendarClock} title="Pipeline limpo" description="Cadastre oportunidades para a VAMO priorizar suas próximas ações." />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {recommendations.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="section-label"><Sparkles className="h-3.5 w-3.5" />Recomendacoes contextuais</div>
                {recommendations.map((recommendation) => (
                  <ContextualRecommendationCard key={recommendation.id} recommendation={recommendation} />
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="space-y-4 pt-6">
              <div className="section-label"><Sparkles className="h-3.5 w-3.5" />Coach IA</div>
              <CoachLine
                icon={overdueDeals.length ? AlertTriangle : CheckCircle2}
                title={overdueDeals.length ? 'Recupere follow-ups atrasados' : 'Ritmo comercial saudavel'}
                description={overdueDeals.length ? 'Comece pelos deals vencidos: eles tem maior chance de virar perda silenciosa.' : 'Sem follow-up vencido. Use a IA para preparar abordagens dos deals com maior valor.'}
              />
              <CoachLine
                icon={Sparkles}
                title="Script contextual"
                description={topDeal ? `Peça um script para ${topDeal.account?.name || topDeal.title} antes de abordar.` : 'Quando houver deals, a IA sugere scripts por etapa.'}
              />
              <Button variant="outline" className="w-full" render={<Link href="/chat-ia" />}>
                Abrir VAMO IA
              </Button>
            </CardContent>
          </Card>

          {lastRecognition && (
            <Card className="border-amber-500/25 bg-amber-500/10">
              <CardContent className="flex items-start gap-3 pt-5">
                <Trophy className="mt-0.5 h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-amber-500">Reconhecimento recente</p>
                  <p className="mt-1 text-sm text-muted-foreground">{lastRecognition}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!hasCheckinToday && streak > 0 && (
            <Card className="border-amber-500/25 bg-amber-500/10">
              <CardContent className="flex items-start gap-3 pt-5">
                <Flame className="mt-0.5 h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-bold">Sua sequência está em risco</p>
                  <p className="mt-1 text-sm text-muted-foreground">Registre uma atividade ou KPI para manter os {streak} dias seguidos.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="stat-icon stat-icon-green h-9 w-9">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-black tabular-nums tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function CoachLine({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/50 bg-background/45 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function EmptyLine({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
