'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Brain,
  CheckCircle2,
  DollarSign,
  Flame,
  LineChart,
  ListChecks,
  MessageSquare,
  Rocket,
  ShieldAlert,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import {
  calculateCommissionEntriesForSale,
  formatCurrency,
  getCurrentPeriodReference,
  type CommissionEntryDraft,
  type CommissionRule,
  type CommissionSaleInput,
} from '@/lib/commission'
import type { UserXp } from '@/types'

interface KpiDefinitionRow {
  id: string
  name: string
  unit: string
  source_event?: string | null
  period?: string | null
  target_daily?: number | string | null
  target_weekly?: number | string | null
  target_monthly?: number | string | null
  targets?: Record<string, unknown> | null
}

interface KpiEntryRow {
  value: number | string
  kpi_id: string
  recorded_at: string
  source_event?: string | null
}

interface MissionSummary {
  id: string
  title: string
  status: string
  xp_reward: number
  difficulty: number
  target_value?: number | string | null
  current_value?: number | string | null
  deadline?: string | null
  created_at?: string | null
  completed_at?: string | null
  pdi_plan_id?: string | null
}

interface DealRow {
  id: string
  title: string
  value: number | string
  received_amount?: number | string | null
  stage: string
  probability?: number | string | null
  expected_close?: string | null
  last_activity_at?: string | null
  next_action_title?: string | null
  next_action_due_at?: string | null
  updated_at?: string | null
  account_id?: string | null
  product_id?: string | null
  product_name?: string | null
  category_id?: string | null
  category_name?: string | null
  commercial_table_id?: string | null
  commercial_table_name?: string | null
  account?: { name?: string | null } | null
}

interface ActivityRow {
  type: string
  occurred_at: string
}

interface PdiPlanRow {
  id: string
  title: string
  status: string
}

interface PdiApplicationRow {
  id: string
  status: string
  created_at: string
}

interface ProgramGoalsRow {
  company_goal?: Record<string, unknown> | null
  individual_goals?: Array<Record<string, unknown>> | null
}

interface ExecutionItem {
  label: string
  current: number
  target: number
  unit: string
  progress: number
}

interface PriorityAction {
  title: string
  reason: string
  impact: string
  nextStep: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel?: string
  secondaryHref?: string
  aiHref?: string
  tone: 'red' | 'amber' | 'green'
}

const ACTIVITY_LABELS: Record<string, string> = {
  call: 'Ligacoes',
  crm_activity_call: 'Ligacoes',
  whatsapp: 'WhatsApps',
  crm_activity_whatsapp: 'WhatsApps',
  email: 'E-mails',
  crm_activity_email: 'E-mails',
  follow_up: 'Follow-ups',
  crm_activity_follow_up: 'Follow-ups',
  meeting: 'Reunioes',
  crm_activity_meeting: 'Reunioes',
  proposal: 'Propostas',
  proposal_sent: 'Propostas',
  crm_activity_proposal_sent: 'Propostas',
}

const FALLBACK_ACTIVITY_TARGETS: Array<{ type: string; label: string; target: number }> = [
  { type: 'follow_up', label: 'Follow-ups', target: 25 },
  { type: 'call', label: 'Ligacoes', target: 20 },
  { type: 'meeting', label: 'Reunioes', target: 5 },
  { type: 'proposal', label: 'Propostas', target: 6 },
]

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function progressPct(current: number, target: number) {
  if (target <= 0) return current > 0 ? 100 : 0
  return clamp(Math.round((current / target) * 100))
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function daysBetween(dateValue: string | null | undefined, reference = new Date()) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor((startOfDay(reference).getTime() - startOfDay(date).getTime()) / 86400000)
}

function isCurrentMonth(dateValue: string | null | undefined) {
  if (!dateValue) return false
  const date = new Date(dateValue)
  const now = new Date()
  return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function parseMoneyText(value: unknown) {
  const text = String(value ?? '')
  const matches = text.match(/(?:R\$\s*)?\d[\d.]*(?:,\d{1,2})?/g) ?? []
  const values = matches.map((match) => {
    const normalized = match
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.')
    return toNumber(normalized, 0)
  }).filter((item) => item > 0)
  return values.length ? Math.max(...values) : 0
}

function kpiTarget(definition: KpiDefinitionRow, period: 'weekly' | 'monthly') {
  const direct = period === 'weekly' ? definition.target_weekly : definition.target_monthly
  const jsonValue = definition.targets?.[period]
  const daily = toNumber(definition.target_daily ?? definition.targets?.daily, 0)
  const parsed = toNumber(direct ?? jsonValue, 0)
  if (parsed > 0) return parsed
  if (period === 'weekly' && daily > 0) return daily * 5
  return 0
}

function dealName(deal: DealRow) {
  return deal.account?.name || deal.title
}

function weightedDealValue(deal: DealRow) {
  return (toNumber(deal.value) * toNumber(deal.probability)) / 100
}

function isOpenDeal(deal: DealRow) {
  return !['closed_won', 'closed_lost'].includes(deal.stage)
}

function isOverdue(deal: DealRow) {
  return Boolean(deal.next_action_due_at && new Date(deal.next_action_due_at).getTime() < Date.now())
}

function isStale(deal: DealRow) {
  const days = daysBetween(deal.last_activity_at ?? deal.updated_at)
  return days !== null && days >= 5
}

function buildSaleInput(deal: DealRow, user: { id: string; name: string; organization_id: string }): CommissionSaleInput {
  return {
    id: deal.id,
    organization_id: user.organization_id,
    seller_id: user.id,
    seller_name: user.name,
    customer_id: deal.account_id ?? null,
    customer_name: deal.account?.name ?? 'Cliente sem nome',
    product_id: deal.product_id ?? deal.product_name ?? null,
    product_name: deal.product_name ?? deal.title,
    category_id: deal.category_id ?? deal.category_name ?? null,
    category_name: deal.category_name ?? 'Sem categoria',
    commercial_table_id: deal.commercial_table_id ?? deal.commercial_table_name ?? null,
    commercial_table_name: deal.commercial_table_name ?? 'Tabela padrao',
    sale_amount: toNumber(deal.value),
    received_amount: toNumber(deal.received_amount),
    sale_date: deal.expected_close ?? deal.updated_at ?? new Date().toISOString(),
    title: deal.title,
  }
}

function getPerformanceStatus(scores: { result: number; execution: number; pipeline: number; evolution: number }) {
  if (scores.result >= 80 && scores.execution >= 75 && scores.pipeline >= 70) {
    return {
      label: 'Alta Performance',
      description: 'Voce esta perto da meta, executando bem e mantendo o pipeline saudavel.',
      tone: 'green' as const,
    }
  }
  if (scores.pipeline < 55) {
    return {
      label: 'Atencao no pipeline',
      description: 'Existem oportunidades abertas sem proximo passo, atrasadas ou paradas demais.',
      tone: 'amber' as const,
    }
  }
  if (scores.execution < 50) {
    return {
      label: 'Baixa execucao',
      description: 'Sua atividade comercial esta abaixo do ritmo necessario para sustentar a meta.',
      tone: 'red' as const,
    }
  }
  if (scores.execution >= 70 && scores.result < 55) {
    return {
      label: 'Executa, mas nao converte',
      description: 'Voce esta se movimentando, mas precisa melhorar qualificacao, proposta ou fechamento.',
      tone: 'amber' as const,
    }
  }
  return {
    label: 'Em evolucao',
    description: 'Voce tem boa execucao, mas ainda ha alavancas claras para melhorar resultado e previsibilidade.',
    tone: 'blue' as const,
  }
}

function statusMessage(scores: { result: number; execution: number; pipeline: number; evolution: number }, potentialCommission: number, activePdi: PdiPlanRow | null) {
  if (scores.execution >= 70 && scores.result < 55) {
    return 'Voce esta executando bem, mas sua conversao ainda esta baixa. Foque nas oportunidades mais qualificadas e revise a abordagem de fechamento.'
  }
  if (scores.result >= 70 && scores.pipeline < 60) {
    return 'Voce vendeu bem, mas seu pipeline esta com risco. Sem proximos passos claros, a meta dos proximos dias pode cair.'
  }
  if (scores.pipeline < 55) {
    return 'Existem oportunidades com valor relevante sem proxima acao. Destravar pipeline vem antes de buscar novos leads.'
  }
  if (potentialCommission > 0) {
    return 'Voce tem comissao parada no pipeline. Avancar oportunidades em negociacao pode aumentar seu ganho do mes.'
  }
  if (activePdi) {
    return 'Seu PDI atual pode melhorar sua conversao, mas precisa ser aplicado em uma situacao real de venda.'
  }
  return 'Sua performance combina resultado, execucao, pipeline e evolucao. Use a acao de maior impacto para melhorar o placar hoje.'
}

function PillarCard({ label, value, weight, icon: Icon }: { label: string; value: number; weight: string; icon: LucideIcon }) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold">{label}</p>
              <p className="text-[11px] text-muted-foreground">Peso {weight}</p>
            </div>
          </div>
          <p className="text-lg font-black tabular-nums">{value}%</p>
        </div>
        <Progress value={value} className="h-2" />
      </CardContent>
    </Card>
  )
}

function MetricLine({ item }: { item: ExecutionItem }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{item.label}</span>
        <span className="text-muted-foreground">{item.current}/{item.target} {item.unit}</span>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={item.progress} className="h-2" />
        <span className="w-10 text-right text-xs font-bold tabular-nums">{item.progress}%</span>
      </div>
    </div>
  )
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export default function PerformancePage() {
  const { user } = useRequiredAuth()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [kpiDefinitions, setKpiDefinitions] = useState<KpiDefinitionRow[]>([])
  const [kpiEntries, setKpiEntries] = useState<KpiEntryRow[]>([])
  const [missions, setMissions] = useState<MissionSummary[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [pdiPlans, setPdiPlans] = useState<PdiPlanRow[]>([])
  const [pdiApplications, setPdiApplications] = useState<PdiApplicationRow[]>([])
  const [commissionEntries, setCommissionEntries] = useState<CommissionEntryDraft[]>([])
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([])
  const [programGoals, setProgramGoals] = useState<ProgramGoalsRow | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const fetchAll = async () => {
      setLoading(true)
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - 6)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const reference = getCurrentPeriodReference()

      const results = await Promise.allSettled([
        supabase.from('user_xp').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase
          .from('kpi_definitions')
          .select('id,name,unit,source_event,period,target_daily,target_weekly,target_monthly,targets')
          .eq('organization_id', user.organization_id)
          .eq('active', true),
        supabase
          .from('kpi_entries')
          .select('value,kpi_id,recorded_at,source_event')
          .eq('organization_id', user.organization_id)
          .eq('user_id', user.id)
          .gte('recorded_at', weekStart.toISOString().slice(0, 10)),
        supabase
          .from('ai_missions')
          .select('id,title,status,xp_reward,difficulty,target_value,current_value,deadline,created_at,completed_at,pdi_plan_id')
          .eq('organization_id', user.organization_id)
          .eq('user_id', user.id)
          .gte('created_at', monthStart.toISOString()),
        supabase
          .from('crm_deals')
          .select('id,title,value,received_amount,stage,probability,expected_close,last_activity_at,next_action_title,next_action_due_at,updated_at,account_id,product_id,product_name,category_id,category_name,commercial_table_id,commercial_table_name,account:crm_accounts(id,name)')
          .eq('organization_id', user.organization_id)
          .eq('owner_id', user.id),
        supabase
          .from('crm_activities')
          .select('type,occurred_at')
          .eq('user_id', user.id)
          .gte('occurred_at', weekStart.toISOString()),
        supabase
          .from('pdi_plans')
          .select('id,title,status')
          .eq('organization_id', user.organization_id)
          .eq('user_id', user.id)
          .in('status', ['recommended', 'pending_approval', 'approved', 'active', 'in_progress'])
          .limit(5),
        supabase
          .from('pdi_applications')
          .select('id,status,created_at')
          .eq('organization_id', user.organization_id)
          .eq('user_id', user.id)
          .gte('created_at', monthStart.toISOString()),
        supabase
          .from('commission_entries')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('seller_id', user.id)
          .eq('period_reference', reference),
        supabase
          .from('commission_rules')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .order('priority', { ascending: true }),
        supabase
          .from('program_goals')
          .select('company_goal,individual_goals')
          .eq('organization_id', user.organization_id)
          .maybeSingle(),
      ])

      if (cancelled) return

      const value = <T,>(index: number, fallback: T): T => {
        const result = results[index]
        if (result.status !== 'fulfilled') return fallback
        const response = result.value as { data?: T | null; count?: number | null }
        return (response.data ?? fallback) as T
      }

      setUserXp(value<UserXp | null>(0, null))
      const badgeResult = results[1]
      setBadgeCount(badgeResult.status === 'fulfilled' ? (badgeResult.value.count ?? 0) : 0)
      setKpiDefinitions(value<KpiDefinitionRow[]>(2, []))
      setKpiEntries(value<KpiEntryRow[]>(3, []))
      setMissions(value<MissionSummary[]>(4, []))
      setDeals(value<DealRow[]>(5, []))
      setActivities(value<ActivityRow[]>(6, []))
      setPdiPlans(value<PdiPlanRow[]>(7, []))
      setPdiApplications(value<PdiApplicationRow[]>(8, []))
      setCommissionEntries(value<CommissionEntryDraft[]>(9, []))
      setCommissionRules(value<CommissionRule[]>(10, []))
      setProgramGoals(value<ProgramGoalsRow | null>(11, null))
      setLoading(false)
    }

    fetchAll().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [supabase, user])

  const openDeals = useMemo(() => deals.filter(isOpenDeal), [deals])
  const wonDeals = useMemo(() => deals.filter((deal) => deal.stage === 'closed_won' && isCurrentMonth(deal.expected_close ?? deal.updated_at)), [deals])
  const monthlyRevenue = useMemo(() => wonDeals.reduce((sum, deal) => sum + toNumber(deal.value), 0), [wonDeals])
  const forecastLikely = useMemo(() => openDeals.reduce((sum, deal) => sum + weightedDealValue(deal), 0), [openDeals])
  const missingActionDeals = useMemo(() => openDeals.filter((deal) => !deal.next_action_title), [openDeals])
  const overdueDeals = useMemo(() => openDeals.filter(isOverdue), [openDeals])
  const staleDeals = useMemo(() => openDeals.filter(isStale), [openDeals])
  const riskDeals = useMemo(() => {
    const ids = new Set([...missingActionDeals, ...overdueDeals, ...staleDeals].map((deal) => deal.id))
    return openDeals.filter((deal) => ids.has(deal.id))
  }, [missingActionDeals, openDeals, overdueDeals, staleDeals])
  const forecastRisk = useMemo(() => riskDeals.reduce((sum, deal) => sum + weightedDealValue(deal), 0), [riskDeals])

  const individualGoal = useMemo(() => {
    const goals = programGoals?.individual_goals ?? []
    return goals.find((goal) => goal.user_id === user.id) ?? null
  }, [programGoals, user.id])

  const goalTarget = useMemo(() => {
    const revenueKpi = kpiDefinitions.find((kpi) => {
      const name = kpi.name.toLowerCase()
      return kpiTarget(kpi, 'monthly') > 0 && (name.includes('receita') || name.includes('venda') || kpi.source_event === 'crm_deal_won')
    })
    if (revenueKpi) return kpiTarget(revenueKpi, 'monthly')
    const directIndividual = toNumber(individualGoal?.target_amount ?? individualGoal?.valorMeta, 0)
    if (directIndividual > 0) return directIndividual
    const parsedIndividual = parseMoneyText(individualGoal?.goal)
    if (parsedIndividual > 0) return parsedIndividual
    return 0
  }, [individualGoal, kpiDefinitions])

  const executionItems = useMemo<ExecutionItem[]>(() => {
    const configured = kpiDefinitions
      .map((definition) => {
        const target = kpiTarget(definition, 'weekly')
        if (target <= 0) return null
        const current = kpiEntries
          .filter((entry) => entry.kpi_id === definition.id)
          .reduce((sum, entry) => sum + toNumber(entry.value), 0)
        return {
          label: ACTIVITY_LABELS[definition.source_event ?? ''] ?? definition.name,
          current,
          target,
          unit: definition.unit,
          progress: progressPct(current, target),
        }
      })
      .filter((item): item is ExecutionItem => Boolean(item))
      .slice(0, 4)

    if (configured.length > 0) return configured

    return FALLBACK_ACTIVITY_TARGETS.map((fallback) => {
      const current = activities.filter((activity) => {
        const label = ACTIVITY_LABELS[activity.type] ?? activity.type
        return label === fallback.label || activity.type === fallback.type
      }).length
      return {
        label: fallback.label,
        current,
        target: fallback.target,
        unit: 'acoes',
        progress: progressPct(current, fallback.target),
      }
    })
  }, [activities, kpiDefinitions, kpiEntries])

  const activeMissions = missions.filter((mission) => ['pending', 'in_progress', 'awaiting_approval', 'rejected'].includes(mission.status))
  const completedMissions = missions.filter((mission) => mission.status === 'completed')
  const activePdi = pdiPlans.find((plan) => ['approved', 'active', 'in_progress'].includes(plan.status)) ?? pdiPlans[0] ?? null
  const approvedApplications = pdiApplications.filter((application) => ['approved', 'validated'].includes(application.status)).length

  const scores = useMemo(() => {
    const goalProgress = goalTarget > 0 ? (monthlyRevenue / goalTarget) * 100 : (monthlyRevenue > 0 ? 60 : 35)
    const forecastCoverage = goalTarget > 0
      ? ((monthlyRevenue + forecastLikely) / goalTarget) * 100
      : (forecastLikely > 0 ? 55 : 25)
    const result = clamp(Math.round(goalProgress * 0.7 + forecastCoverage * 0.3))
    const execution = executionItems.length
      ? clamp(Math.round(executionItems.reduce((sum, item) => sum + item.progress, 0) / executionItems.length))
      : clamp((userXp?.current_streak ?? 0) * 8)
    const openValue = openDeals.reduce((sum, deal) => sum + weightedDealValue(deal), 0)
    const riskWeight = openValue > 0 ? (forecastRisk / openValue) * 25 : 0
    const pipeline = clamp(Math.round(100 - missingActionDeals.length * 12 - overdueDeals.length * 18 - staleDeals.length * 10 - riskWeight))
    const missionProgress = activeMissions.length
      ? activeMissions.reduce((sum, mission) => sum + progressPct(toNumber(mission.current_value), toNumber(mission.target_value)), 0) / activeMissions.length
      : 0
    const evolution = clamp(Math.round(
      completedMissions.length * 14 +
      missionProgress * 0.25 +
      (activePdi ? 24 : 0) +
      approvedApplications * 12 +
      Math.min((userXp?.current_streak ?? 0) * 3, 18) +
      Math.min(badgeCount * 2, 12)
    ))

    return { result, execution, pipeline, evolution }
  }, [activeMissions, activePdi, approvedApplications, badgeCount, completedMissions.length, executionItems, forecastLikely, forecastRisk, goalTarget, missingActionDeals.length, monthlyRevenue, openDeals, overdueDeals.length, staleDeals.length, userXp?.current_streak])

  const performanceScore = Math.round(scores.result * 0.35 + scores.execution * 0.3 + scores.pipeline * 0.2 + scores.evolution * 0.15)
  const performanceStatus = getPerformanceStatus(scores)
  const statusTone = {
    green: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-700',
    red: 'border-red-500/25 bg-red-500/10 text-red-700',
    blue: 'border-blue-500/25 bg-blue-500/10 text-blue-700',
  }[performanceStatus.tone]

  const goalProgress = goalTarget > 0 ? progressPct(monthlyRevenue, goalTarget) : 0
  const remainingGoal = Math.max(goalTarget - monthlyRevenue, 0)
  const weeksLeft = Math.max(1, Math.ceil((new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate() + 1) / 7))
  const neededPerWeek = remainingGoal / weeksLeft

  const commissionSummary = useMemo(() => {
    const confirmed = commissionEntries
      .filter((entry) => ['confirmed', 'adjusted', 'paid'].includes(entry.status))
      .reduce((sum, entry) => sum + toNumber(entry.commission_amount), 0)
    const pending = commissionEntries
      .filter((entry) => entry.status === 'pending')
      .reduce((sum, entry) => sum + toNumber(entry.commission_amount), 0)
    const potential = openDeals.reduce((sum, deal) => {
      const entries = calculateCommissionEntriesForSale(buildSaleInput({ ...deal, received_amount: 0 }, user), commissionRules)
      const dealCommission = entries.reduce((entrySum, entry) => entrySum + toNumber(entry.commission_amount), 0)
      return sum + (dealCommission * toNumber(deal.probability)) / 100
    }, 0)
    const salesPotential = openDeals.reduce((sum, deal) => sum + toNumber(deal.value), 0)
    return { confirmed, pending, potential, salesPotential }
  }, [commissionEntries, commissionRules, openDeals, user])

  const topImpactAction = useMemo<PriorityAction>(() => {
    const sortedRiskDeals = [...riskDeals].sort((a, b) => weightedDealValue(b) - weightedDealValue(a))
    const deal = sortedRiskDeals[0] ?? [...openDeals].sort((a, b) => weightedDealValue(b) - weightedDealValue(a))[0]
    if (deal) {
      const days = daysBetween(deal.last_activity_at ?? deal.updated_at)
      const impactPct = goalTarget > 0 ? Math.round((toNumber(deal.value) / goalTarget) * 100) : Math.round(toNumber(deal.probability))
      const reason = isOverdue(deal)
        ? `Follow-up atrasado em ${dealName(deal)}.`
        : !deal.next_action_title
          ? `${dealName(deal)} esta sem proximo passo definido.`
          : `${dealName(deal)} esta ${days !== null ? `ha ${days} dias` : ''} sem movimento relevante.`
      return {
        title: `Retomar contato com ${dealName(deal)}`,
        reason: `${reason} Oportunidade de ${formatCurrency(toNumber(deal.value))}.`,
        impact: goalTarget > 0
          ? `Pode destravar ${impactPct}% da sua meta mensal.`
          : `Pode destravar ${formatCurrency(weightedDealValue(deal))} de forecast ponderado.`,
        nextStep: deal.next_action_title || 'Enviar follow-up com pergunta de decisao.',
        primaryLabel: 'Abrir oportunidade',
        primaryHref: `/crm/${deal.id}`,
        secondaryLabel: 'Registrar follow-up',
        secondaryHref: `/kpis/registrar?dealId=${encodeURIComponent(deal.id)}&action=crm_activity_follow_up`,
        aiHref: '/chat-ia',
        tone: isOverdue(deal) ? 'red' : 'amber',
      }
    }

    const mission = activeMissions[0]
    if (mission) {
      return {
        title: mission.title,
        reason: 'Missao ativa pode melhorar sua evolucao comercial e gerar XP.',
        impact: `${mission.xp_reward ?? 0} XP de recompensa vinculada a execucao.`,
        nextStep: 'Abra a missao, registre a acao e solicite validacao quando concluir.',
        primaryLabel: 'Abrir missao',
        primaryHref: '/performance/missoes',
        secondaryLabel: 'Registrar evidencia',
        secondaryHref: '/desenvolvimento/pdi',
        aiHref: '/chat-ia',
        tone: 'green',
      }
    }

    return {
      title: 'Registrar uma acao comercial agora',
      reason: 'Ainda nao existe uma oportunidade critica priorizada pela Vamo.',
      impact: 'Aumenta seu ritmo de execucao e melhora a leitura da performance.',
      nextStep: 'Registre follow-up, ligacao, reuniao ou proposta enviada.',
      primaryLabel: 'Registrar acao',
      primaryHref: '/kpis/registrar',
      secondaryLabel: 'Ver pipeline',
      secondaryHref: '/crm',
      aiHref: '/chat-ia',
      tone: 'green',
    }
  }, [activeMissions, goalTarget, openDeals, riskDeals])

  const intelligentMessage = statusMessage(scores, commissionSummary.potential, activePdi)
  const maxStaleProposalDays = openDeals
    .filter((deal) => ['proposal', 'negotiation'].includes(deal.stage))
    .map((deal) => daysBetween(deal.last_activity_at ?? deal.updated_at) ?? 0)
    .sort((a, b) => b - a)[0] ?? 0

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        label="Performance"
        title={<>Minha <TitleHighlight>Performance Comercial</TitleHighlight></>}
        description="Performance combina resultado, execucao, saude do pipeline e evolucao comercial para interpretar onde agir agora."
        actions={(
          <Badge className={statusTone}>{performanceStatus.label}</Badge>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden border-primary/25 bg-primary/5">
          <CardContent className="p-6">
            <div className="grid gap-5 lg:grid-cols-[13rem_1fr] lg:items-center">
              <div className="relative mx-auto h-44 w-44">
                <svg viewBox="0 0 120 120" className="h-44 w-44 -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="10" className="text-background" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(performanceScore / 100) * 314} 314`}
                    className="text-primary"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-5xl font-black tabular-nums">{performanceScore}</span>
                  <span className="text-xs font-bold uppercase text-muted-foreground">de 100</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="section-label"><Brain className="h-3.5 w-3.5" />Score de Performance</div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">Performance Geral</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {performanceStatus.description}
                  </p>
                </div>
                <div className="rounded-lg border border-primary/20 bg-background/70 p-4 text-sm leading-relaxed text-muted-foreground">
                  {intelligentMessage}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Minha meta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-2xl font-black tabular-nums">
                {formatCurrency(monthlyRevenue)} {goalTarget > 0 && <span className="text-muted-foreground">/ {formatCurrency(goalTarget)}</span>}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {goalTarget > 0 ? `${goalProgress}% concluido. Faltam ${formatCurrency(remainingGoal)} para bater a meta.` : 'Meta financeira do mes ainda nao configurada.'}
              </p>
            </div>
            <Progress value={goalProgress} className="h-3" />
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Forecast provavel</span><strong>{formatCurrency(forecastLikely)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Forecast em risco</span><strong>{formatCurrency(forecastRisk)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Necessario por semana</span><strong>{goalTarget > 0 ? formatCurrency(neededPerWeek) : '-'}</strong></div>
            </div>
            {Boolean(individualGoal?.goal) && (
              <p className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">{String(individualGoal?.goal)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <PillarCard label="Resultado" value={scores.result} weight="35%" icon={Trophy} />
        <PillarCard label="Execucao" value={scores.execution} weight="30%" icon={ListChecks} />
        <PillarCard label="Pipeline" value={scores.pipeline} weight="20%" icon={LineChart} />
        <PillarCard label="Evolucao" value={scores.evolution} weight="15%" icon={Rocket} />
      </div>

      <Card className="border-amber-500/25 bg-amber-500/10">
        <CardContent className="p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-2">
              <div className="section-label"><AlertTriangle className="h-3.5 w-3.5" />Acao de maior impacto hoje</div>
              <h2 className="text-xl font-black tracking-tight">{topImpactAction.title}</h2>
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">Motivo:</strong> {topImpactAction.reason}</p>
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">Impacto:</strong> {topImpactAction.impact}</p>
              <p className="text-sm text-muted-foreground"><strong className="text-foreground">Proximo passo sugerido:</strong> {topImpactAction.nextStep}</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
              <Button render={<Link href={topImpactAction.primaryHref} />}>
                {topImpactAction.primaryLabel} <ArrowRight className="h-4 w-4" />
              </Button>
              {topImpactAction.secondaryHref && topImpactAction.secondaryLabel && (
                <Button variant="outline" render={<Link href={topImpactAction.secondaryHref} />}>
                  {topImpactAction.secondaryLabel}
                </Button>
              )}
              <Button variant="outline" render={<Link href={topImpactAction.aiHref ?? '/chat-ia'} />}>
                <MessageSquare className="h-4 w-4" />
                Pedir ajuda da IA
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-primary" />
              Execucao da semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {executionItems.length > 0 ? executionItems.map((item) => <MetricLine key={item.label} item={item} />) : (
              <EmptyHint>Registre acoes comerciais para a Vamo interpretar sua execucao semanal.</EmptyHint>
            )}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-muted-foreground">
              {scores.execution >= 75
                ? 'Sua execucao esta em bom ritmo. O proximo ganho vem de converter melhor as oportunidades abertas.'
                : 'Sua execucao ainda esta abaixo do necessario. Priorize as atividades com menor progresso nesta semana.'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Saude do pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-4xl font-black tabular-nums">{scores.pipeline}<span className="text-lg text-muted-foreground">/100</span></p>
                <p className="text-sm text-muted-foreground">{openDeals.length} oportunidades abertas</p>
              </div>
              <Badge className={scores.pipeline < 55 ? 'bg-red-500/10 text-red-700' : 'bg-amber-500/10 text-amber-700'}>
                {scores.pipeline < 55 ? 'Risco' : 'Monitorar'}
              </Badge>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Sem proxima acao</span><strong>{missingActionDeals.length}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Follow-ups atrasados</span><strong>{overdueDeals.length}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Forecast parado</span><strong>{formatCurrency(forecastRisk)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Dias sem mover proposta principal</span><strong>{maxStaleProposalDays}</strong></div>
            </div>
            {(missingActionDeals.length > 0 || overdueDeals.length > 0) && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-muted-foreground">
                Atencao: {missingActionDeals.length + overdueDeals.length} oportunidades precisam de proximo passo para o pipeline voltar a respirar.
              </div>
            )}
            <Button variant="outline" className="w-full" render={<Link href="/hoje" />}>Ver acoes prioritarias</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Comissao potencial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Atual</p>
                <p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(commissionSummary.confirmed)}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(commissionSummary.pending)}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                <p className="text-xs text-muted-foreground">Potencial</p>
                <p className="mt-1 text-xl font-black tabular-nums">{formatCurrency(commissionSummary.potential)}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {openDeals.length} oportunidades abertas podem gerar {formatCurrency(commissionSummary.salesPotential)} em vendas e {formatCurrency(commissionSummary.potential)} em comissao estimada. Potencial nao e valor garantido.
            </p>
            <Button variant="outline" className="w-full" render={<Link href="/ganhos/comissao" />}>Ver detalhes da comissao</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="h-4 w-4 text-primary" />
              Missoes e PDI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Missoes ativas</p>
                <p className="mt-1 text-2xl font-black">{activeMissions.length}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Concluidas no mes</p>
                <p className="mt-1 text-2xl font-black">{completedMissions.length}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Evidencias aprovadas</p>
                <p className="mt-1 text-2xl font-black">{approvedApplications}</p>
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm leading-relaxed text-muted-foreground">
              {activePdi
                ? `Voce esta evoluindo em ${activePdi.title}. Aplique o treino em uma oportunidade real e envie evidencia.`
                : activeMissions.length > 0
                  ? 'Suas missoes ativas sustentam a evolucao pratica. Conclua, registre a evidencia e peca validacao.'
                  : 'Sem PDI ativo agora. Quando o gestor liberar um plano, ele aparece aqui junto das missoes praticas.'}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" render={<Link href="/performance/missoes" />}>Ver missoes</Button>
              <Button variant="outline" render={<Link href="/desenvolvimento/pdi" />}>Abrir PDI</Button>
              <Button render={<Link href="/desenvolvimento/pdi" />}>Enviar evidencia</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Historico de evolucao
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">XP total</p>
            <p className="mt-1 text-xl font-black">{(userXp?.total_xp ?? 0).toLocaleString('pt-BR')}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Streak</p>
            <p className="mt-1 flex items-center gap-1 text-xl font-black"><Flame className="h-4 w-4 text-orange-500" />{userXp?.current_streak ?? 0} dias</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Conquistas</p>
            <p className="mt-1 text-xl font-black">{badgeCount}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Nivel</p>
            <p className="mt-1 text-xl font-black">{userXp?.current_level ?? 1}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
