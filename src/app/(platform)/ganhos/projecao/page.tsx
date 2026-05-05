'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import { ContextualRecommendationCard, type ContextualRecommendation } from '@/components/performance-os/ContextualRecommendationCard'
import type { CrmDeal } from '@/types/crm'
import { ArrowRight, Brain, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react'

interface MissionSummary {
  id: string
  title: string | null
  xp_reward: number
  status?: string | null
}

interface CommissionRuleRow {
  percentage: number | string | null
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function commission(value: number, rate: number) {
  return (Number(value || 0) * rate) / 100
}

function weightedCommission(lead: CrmDeal, rate: number) {
  return commission(Number(lead.value || 0), rate) * (Number(lead.probability || 0) / 100)
}

export default function ProjecaoPage() {
  const { user } = useRequiredAuth()
  const supabase = useMemo(() => createClient(), [])
  const userId = user?.id
  const organizationId = user?.organization_id
  const [loading, setLoading] = useState(true)
  const [activeMissions, setActiveMissions] = useState<MissionSummary[]>([])
  const [leads, setLeads] = useState<CrmDeal[]>([])
  const [commissionRate, setCommissionRate] = useState(5)

  useEffect(() => {
    if (!userId || !organizationId) return

    const fetchData = async () => {
      const [missionsResult, rulesResult, leadsResult] = await Promise.allSettled([
        fetch('/api/ai/missions').then(async (res) => (res.ok ? res.json() as Promise<{ missions?: MissionSummary[] }> : { missions: [] })),
        supabase
          .from('commission_rules')
          .select('percentage')
          .eq('organization_id', organizationId)
          .eq('active', true)
          .order('priority', { ascending: true })
          .limit(1),
        fetch('/api/crm/deals').then(async (res) => (res.ok ? res.json() as Promise<{ deals?: CrmDeal[] }> : { deals: [] })),
      ])

      if (missionsResult.status === 'fulfilled') {
        setActiveMissions((missionsResult.value.missions ?? []).filter((mission) => ['pending', 'in_progress'].includes(String(mission.status ?? 'pending'))))
      }

      if (rulesResult.status === 'fulfilled') {
        const rule = (rulesResult.value.data?.[0] ?? null) as CommissionRuleRow | null
        const parsedRate = Number(rule?.percentage ?? 0)
        if (Number.isFinite(parsedRate) && parsedRate > 0) setCommissionRate(parsedRate)
      }

      if (leadsResult.status === 'fulfilled') {
        setLeads(leadsResult.value.deals ?? [])
      }

      setLoading(false)
    }

    fetchData().catch(() => setLoading(false))
  }, [organizationId, supabase, userId])

  const projection = useMemo(() => {
    const wonLeads = leads.filter((lead) => lead.stage === 'closed_won')
    const openLeads = leads.filter((lead) => !['closed_won', 'closed_lost'].includes(lead.stage))
    const confirmed = wonLeads.reduce((sum, lead) => sum + commission(Number(lead.value || 0), commissionRate), 0)
    const weighted = openLeads.reduce((sum, lead) => sum + weightedCommission(lead, commissionRate), 0)
    const fullPipeline = openLeads.reduce((sum, lead) => sum + commission(Number(lead.value || 0), commissionRate), 0)
    const missionBonus = activeMissions.reduce((sum, mission) => sum + Number(mission.xp_reward || 0) * 1.5, 0)

    return {
      confirmed,
      likely: confirmed + weighted + missionBonus,
      maximum: confirmed + fullPipeline + missionBonus,
      openLeads,
      wonLeads,
      missionBonus,
    }
  }, [activeMissions, commissionRate, leads])

  const actions = useMemo(() => {
    const leadActions = projection.openLeads
      .slice()
      .sort((a, b) => weightedCommission(b, commissionRate) - weightedCommission(a, commissionRate))
      .slice(0, 3)
      .map((lead) => ({
        action: lead.next_action_status === 'open' && lead.next_action_title
          ? `Fazer próxima ação: ${lead.next_action_title}`
          : `Definir próxima ação para ${lead.account?.name || lead.title}`,
        gain: weightedCommission(lead, commissionRate),
        href: `/crm/${lead.id}`,
      }))

    if (leadActions.length > 0) return leadActions

    return activeMissions.slice(0, 3).map((mission) => ({
      action: mission.title ? `Completar missão: ${mission.title}` : 'Completar missão ativa',
      gain: Number(mission.xp_reward || 0) * 1.5,
      href: '/performance/missoes',
    }))
  }, [activeMissions, commissionRate, projection.openLeads])

  const projectionRecommendation = useMemo<ContextualRecommendation | null>(() => {
    const bestAction = actions[0]
    if (!bestAction) return null
    return {
      id: 'projection-next-best-action',
      title: 'Proxima melhor acao para aumentar ganhos',
      description: `${bestAction.action}. Impacto projetado: ${money(bestAction.gain)}.`,
      priority: bestAction.gain > 500 ? 'high' : 'medium',
      status: 'open',
      suggested_action_label: 'Executar agora',
      suggested_action_href: bestAction.href,
      recommendation_type: 'earnings_projection',
      source_module: 'projection',
    }
  }, [actions])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const scenarios = [
    {
      label: 'Cenário atual',
      desc: `${projection.wonLeads.length} leads ganhos, comissão estimada pela regra atual`,
      total: projection.confirmed,
      color: 'text-muted-foreground',
      border: 'border-border/40',
      bg: 'bg-muted',
      textColor: 'text-muted-foreground',
    },
    {
      label: 'Cenário provável',
      desc: `${projection.openLeads.length} leads abertos ponderados pela probabilidade do pipeline`,
      total: projection.likely,
      color: 'text-amber-500',
      border: 'border-amber-500/20 bg-amber-500/5',
      bg: 'bg-amber-500/15',
      textColor: 'text-amber-500',
    },
    {
      label: 'Cenário máximo',
      desc: 'Todos os leads em aberto fechando + missões ativas concluídas',
      total: projection.maximum,
      color: 'text-emerald-500',
      border: 'border-emerald-500/20 bg-emerald-500/5',
      bg: 'bg-emerald-500/15',
      textColor: 'text-emerald-500',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        label="Ganhar"
        title={<>Projeção de <TitleHighlight>ganhos</TitleHighlight></>}
        description={`Baseada nos leads do pipeline, probabilidade de fechamento, missões ativas e comissão estimada de ${commissionRate.toLocaleString('pt-BR')}%.`}
        actions={(
          <>
            <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-3 w-3" />
              Tempo real
            </Badge>
            <Badge variant="secondary" className="border-0 bg-emerald-500/10 text-emerald-500">
              <Brain className="h-3 w-3" />
              VAMO IA
            </Badge>
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Leads abertos</p><p className="text-2xl font-bold">{projection.openLeads.length}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Valor em pipeline</p><p className="text-2xl font-bold">{money(projection.openLeads.reduce((sum, lead) => sum + Number(lead.value || 0), 0))}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Bônus de missões</p><p className="text-2xl font-bold">{money(projection.missionBonus)}</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {scenarios.map((scenario, index) => (
          <Card key={scenario.label} className={scenario.border}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${scenario.bg} ${scenario.textColor}`}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{scenario.label}</p>
                  <p className="text-[10px] text-muted-foreground">{scenario.desc}</p>
                </div>
                <span className={`shrink-0 text-lg font-bold tabular-nums ${scenario.color}`}>
                  {money(scenario.total)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {projectionRecommendation && (
        <ContextualRecommendationCard recommendation={projectionRecommendation} />
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">Ação x ganho adicional</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Cadastre leads no pipeline para calcular próximos ganhos.</p>
          ) : (
            actions.map((item) => (
              <Link key={`${item.href}-${item.action}`} href={item.href} className="flex items-center justify-between border-b border-border/30 py-2 last:border-0">
                <span className="text-xs text-muted-foreground">{item.action}</span>
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                  +{money(item.gain)}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="flex items-start gap-3 py-4">
          <TrendingUp className="mt-0.5 h-5 w-5 text-blue-500" />
          <div>
            <p className="text-sm font-semibold">Como esta projeção é calculada</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Leads ganhos entram como comissão confirmada. Leads abertos entram ponderados pela probabilidade da etapa atual. O cenário máximo considera todos os leads abertos como ganhos.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Exemplo: um lead de {money(7500)} com 20% de probabilidade e comissão de {commissionRate.toLocaleString('pt-BR')}% projeta {money(commission(7500, commissionRate) * 0.2)}.
            </p>
          </div>
        </CardContent>
      </Card>

      <Link href="/ganhos/comissao">
        <Button variant="outline" size="sm" className="w-full text-xs">
          Ver comissão detalhada <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </Link>
    </div>
  )
}
