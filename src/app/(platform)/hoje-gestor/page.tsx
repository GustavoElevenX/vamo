'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { MeetingAgendaSheet } from '@/components/hoje-gestor/meeting-agenda-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Brain,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  HeartPulse,
  LineChart,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react'

type Severity = 'critical' | 'high' | 'medium' | 'opportunity' | 'positive'

type ActionLink = {
  label: string
  href: string
}

type ActionQueueItem = {
  id: string
  type: string
  severity: Severity
  score: number
  title: string
  description: string
  impact: string
  entityName: string | null
  primaryHref: string
  actions: ActionLink[]
}

type TeamMember = {
  id: string
  name: string
  risk: Severity
  score: number
  reasons: string[]
  href: string
  metrics: {
    energy: number | null
    kpisToday: number
    activeDeals: number
    overdueDeals: number
    currentStreak: number
    lastActivityDate: string | null
    completedMissionsMonth: number
    totalXp: number
  }
}

type CommandMetric = {
  title: string
  value: string
  detail: string
  href: string
}

type ForecastRisk = {
  id: string
  title: string
  ownerName: string
  accountName: string | null
  value: number
  stage: string
  forecastCategory: string | null
  nextActionDueAt: string | null
  score: number
  reason: string
  href: string
}

type CockpitData = {
  generatedAt: string
  manager: { id: string; name: string }
  briefing: {
    title: string
    summary: string
    principalRisk: string
    principalOpportunity: string
    principalPerson: string | null
    principalAction: string
    quickIndicators: Array<{ label: string; value: string }>
  }
  metrics: {
    forecast: CommandMetric
    team: CommandMetric
    execution: CommandMetric
    commission: CommandMetric
  }
  topDecision: ActionQueueItem | null
  teamMap: {
    attention: TeamMember[]
    recognition: TeamMember[]
    stable: TeamMember[]
  }
  forecastRisks: ForecastRisk[]
  development: {
    openGaps: number
    plansToApprove: number
    activePlans: number
    applicationsToValidate: number
    href: string
  }
  commission: {
    pendingAmount: string
    disputedAmount: string
    disputes: number
    pendingEntries: number
    href: string
  }
  actionQueue: ActionQueueItem[]
  quickAccess: ActionLink[]
  dataHealth: {
    sellers: number
    deals: number
    kpisToday: number
    recommendations: number
    alerts: number
  }
}

const severityLabel: Record<Severity, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Atencao',
  opportunity: 'Oportunidade',
  positive: 'Estavel',
}

const severityClass: Record<Severity, string> = {
  critical: 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300',
  high: 'border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  medium: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  opportunity: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  positive: 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300',
}

const metricIcons = {
  forecast: LineChart,
  team: UsersRound,
  execution: ClipboardList,
  commission: BadgeDollarSign,
} as const

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function CommandCard({ metricKey, metric }: { metricKey: keyof CockpitData['metrics']; metric: CommandMetric }) {
  const Icon = metricIcons[metricKey]
  return (
    <Card className="min-h-[148px] border-border/70">
      <CardContent className="flex h-full flex-col justify-between gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
            <p className="mt-2 text-2xl font-bold tracking-normal">{metric.value}</p>
          </div>
          <span className="rounded-lg border border-border/70 bg-muted/50 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </span>
        </div>
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{metric.detail}</p>
          <Button size="sm" variant="outline" render={<Link href={metric.href} />}>
            Abrir
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ActionButtons({ actions }: { actions: ActionLink[] }) {
  if (!actions.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {actions.slice(0, 3).map((action, index) => (
        <Button
          key={`${action.href}-${action.label}`}
          size="sm"
          variant={index === 0 ? 'default' : 'outline'}
          render={<Link href={action.href} />}
        >
          {action.label}
          {index === 0 && <ArrowRight className="h-3.5 w-3.5" />}
        </Button>
      ))}
    </div>
  )
}

function TeamRow({ member, mode }: { member: TeamMember; mode: 'attention' | 'recognition' | 'stable' }) {
  const Icon = mode === 'recognition' ? Trophy : mode === 'stable' ? CheckCircle2 : ShieldAlert
  const note = mode === 'recognition'
    ? `${member.metrics.completedMissionsMonth} missoes no mes | ${member.metrics.totalXp.toLocaleString('pt-BR')} XP`
    : mode === 'stable'
      ? `${member.metrics.kpisToday} KPIs hoje | ${member.metrics.currentStreak} dias de streak`
      : member.reasons.join(', ')

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <p className="truncate text-sm font-semibold">{member.name}</p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note || 'Sem sinal critico registrado hoje'}</p>
      </div>
      <Button size="icon-sm" variant="ghost" render={<Link href={member.href} aria-label={`Ver ${member.name}`} />}>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function QueueCard({ item }: { item: ActionQueueItem }) {
  return (
    <div className="rounded-lg border border-border/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={severityClass[item.severity]}>
              {severityLabel[item.severity]}
            </Badge>
            <span className="text-xs text-muted-foreground">{item.impact}</span>
          </div>
          <div>
            <p className="font-semibold leading-snug">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        </div>
        <div className="shrink-0">
          <ActionButtons actions={item.actions} />
        </div>
      </div>
    </div>
  )
}

export default function HojeGestorPage() {
  const { user } = useRequiredAuth()
  const [data, setData] = useState<CockpitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/manager/cockpit', { credentials: 'same-origin' })
      const body = await res.json().catch(() => ({}))
      if (cancelled) return
      if (!res.ok) {
        setError(body.error || 'Erro ao carregar painel de comando')
        setLoading(false)
        return
      }
      setData(body as CockpitData)
      setLoading(false)
    }

    load().catch((err) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Erro ao carregar painel de comando')
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const date = useMemo(() => formatDate(), [])
  const metrics = data?.metrics
  const hasSignals = Boolean(
    data && (data.dataHealth.deals || data.dataHealth.kpisToday || data.dataHealth.recommendations || data.dataHealth.alerts),
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data || !metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-3 text-sm text-muted-foreground">{error || 'Não foi possível montar o painel de comando.'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting()}, {firstName(user.name)}.</h1>
          <p className="text-sm capitalize text-muted-foreground">Painel de comando comercial - {date}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/chat-ia" />}>
            <Brain className="h-4 w-4" />
            VAMO IA
          </Button>
          <MeetingAgendaSheet />
        </div>
      </div>

      <section className="rounded-xl border border-primary/25 bg-primary/5 p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Badge className="bg-primary text-primary-foreground">
              <Sparkles className="h-3 w-3" />
              {data.briefing.title}
            </Badge>
            <div>
              <h2 className="text-xl font-bold leading-tight">Onde intervir hoje</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{data.briefing.summary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Risco principal</p>
                <p className="mt-1 text-sm font-semibold">{data.briefing.principalRisk}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Ação recomendada</p>
                <p className="mt-1 text-sm font-semibold">{data.briefing.principalAction}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            {data.briefing.quickIndicators.map((indicator) => (
              <div key={indicator.label} className="rounded-lg border border-border/60 bg-background/75 p-3">
                <p className="text-xs text-muted-foreground">{indicator.label}</p>
                <p className="mt-1 text-lg font-bold">{indicator.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CommandCard metricKey="forecast" metric={metrics.forecast} />
        <CommandCard metricKey="team" metric={metrics.team} />
        <CommandCard metricKey="execution" metric={metrics.execution} />
        <CommandCard metricKey="commission" metric={metrics.commission} />
      </section>

      {data.topDecision ? (
        <Card className="border-primary/30">
          <CardContent className="p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                <Badge variant="outline" className={severityClass[data.topDecision.severity]}>
                  <Target className="h-3 w-3" />
                  Decisão no 1 do gestor
                </Badge>
                <div>
                  <h2 className="text-xl font-bold leading-tight">{data.topDecision.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.topDecision.description}</p>
                </div>
                <p className="text-sm font-medium">{data.topDecision.impact}</p>
              </div>
              <div className="flex flex-col justify-between gap-4 rounded-lg border border-border/70 p-4">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Pessoa/contexto</p>
                  <p className="mt-1 text-lg font-bold">{data.topDecision.entityName || 'Equipe comercial'}</p>
                </div>
                <ActionButtons actions={data.topDecision.actions} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Sem decisão prioritaria gerada porque a conta ainda não tem sinais reais suficientes para esse bloco.
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Quem precisa de atencao
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.teamMap.attention.length ? data.teamMap.attention.map((member) => (
              <TeamRow key={member.id} member={member} mode="attention" />
            )) : <p className="text-sm text-muted-foreground">Nenhum vendedor em risco pelos sinais de hoje.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-primary" />
              Quem merece reconhecimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.teamMap.recognition.length ? data.teamMap.recognition.map((member) => (
              <TeamRow key={member.id} member={member} mode="recognition" />
            )) : <p className="text-sm text-muted-foreground">Sem sinal real de reconhecimento priorizado até agora.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Quem esta estavel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.teamMap.stable.length ? data.teamMap.stable.map((member) => (
              <TeamRow key={member.id} member={member} mode="stable" />
            )) : <p className="text-sm text-muted-foreground">Ainda sem base real suficiente para classificar estabilidade.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-primary" />
              Funil e oportunidades criticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.forecastRisks.length ? data.forecastRisks.slice(0, 5).map((deal) => (
              <div key={deal.id} className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{deal.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {deal.ownerName} | {formatCurrency(deal.value)} | {deal.reason}
                  </p>
                </div>
                <Button size="sm" variant="outline" render={<Link href={deal.href} />}>
                  Ver oportunidade
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )) : <p className="text-sm text-muted-foreground">Nenhuma oportunidade aberto aparece como critico pelos sinais atuais.</p>}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="h-4 w-4 text-primary" />
                Desenvolvimento/PDI
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Gaps abertos</p>
                <p className="mt-1 text-xl font-bold">{data.development.openGaps}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">PDIs para aprovar</p>
                <p className="mt-1 text-xl font-bold">{data.development.plansToApprove}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">PDIs ativos</p>
                <p className="mt-1 text-xl font-bold">{data.development.activePlans}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">Validacoes</p>
                <p className="mt-1 text-xl font-bold">{data.development.applicationsToValidate}</p>
              </div>
              <Button className="col-span-2" variant="outline" render={<Link href={data.development.href} />}>
                Abrir desenvolvimento
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeDollarSign className="h-4 w-4 text-primary" />
                Comissionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Pendente</p>
                  <p className="mt-1 text-lg font-bold">{data.commission.pendingAmount}</p>
                </div>
                <div className="rounded-lg border border-border/70 p-3">
                  <p className="text-xs text-muted-foreground">Contestado</p>
                  <p className="mt-1 text-lg font-bold">{data.commission.disputedAmount}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {data.commission.disputes} contestacoes e {data.commission.pendingEntries} lancamentos pendentes no período.
              </p>
              <Button variant="outline" render={<Link href={data.commission.href} />}>
                Revisar comissões
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Fila de ações recomendadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.actionQueue.length ? data.actionQueue.map((item) => (
            <QueueCard key={item.id} item={item} />
          )) : (
            <p className="text-sm text-muted-foreground">Sem fila acionável agora. Novos alertas, KPIs, oportunidades e comissões alimentam esta lista automaticamente.</p>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-wrap gap-2">
        {data.quickAccess.map((item) => (
          <Button key={item.href} variant="outline" render={<Link href={item.href} />}>
            <CircleDot className="h-3.5 w-3.5" />
            {item.label}
          </Button>
        ))}
      </section>

      {!hasSignals && (
        <Card>
          <CardContent className="flex items-start gap-3 py-4">
            <MessageSquareText className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              A conta tem {data.dataHealth.sellers} vendedor{data.dataHealth.sellers === 1 ? '' : 'es'}, mas ainda não há oportunidades, KPIs, recomendações ou alertas reais suficientes para uma decisão automatica.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
