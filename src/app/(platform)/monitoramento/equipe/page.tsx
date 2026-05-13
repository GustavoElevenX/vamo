'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Bell,
  Bot,
  Brain,
  Briefcase,
  LineChart,
  Medal,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type SellerStatus = 'accelerating' | 'selling_with_risk' | 'executing_not_converting' | 'low_execution'
type NudgeType = 'risk' | 'execution' | 'coaching' | 'recognition' | 'focus'

interface SellerPerformance {
  id: string
  name: string
  avatar_url: string | null
  revenue_won: number
  individual_goal: number
  goal_pct: number
  forecast_weighted: number
  open_pipeline: number
  pipeline_at_risk: number
  deals_without_next_action: number
  overdue_followups: number
  won_deals_count: number
  avg_ticket: number
  conversion_rate: number
  activities_count: number
  kpi_execution_pct: number
  followups_done: number
  meetings_booked: number
  proposals_sent: number
  deals_updated: number
  missions_active: number
  missions_completed: number
  missions_overdue: number
  xp: number
  streak: number
  checkin_energy: number | null
  commercial_score: number
  commercial_score_label: string
  status: SellerStatus
  status_label: string
  status_message: string
  recommended_action: {
    type: NudgeType
    label: string
    reason: string
    href: string
  }
}

interface ActionQueueItem {
  id: string
  seller_id: string
  seller_name: string
  type: NudgeType
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  reason: string
  impact_value: number
  suggested_action: string
  message: string
  cta: { label: string; action: string; href: string }
  context: Record<string, unknown>
}

interface PerformanceData {
  period: { label: string; key: string; start: string; end: string }
  summary: {
    monthly_goal: number
    revenue_won: number
    forecast_weighted: number
    gap_to_goal: number
    gap_real: number
    avg_ticket: number
    won_deals_count: number
    open_pipeline: number
    pipeline_at_risk: number
    deals_without_next_action: number
    overdue_followups: number
    stalled_deals: number
    pending_receipts: number
  }
  ai_reading: {
    title: string
    summary: string
    goal: string
    risk: string
    opportunity: string
    attention: string
    recognition: string
    priority: string
  }
  sellers: SellerPerformance[]
  action_queue: ActionQueueItem[]
  execution: Array<{ event: string; label: string; done: number; target: number; pct: number | null; leader: string | null; lagging: string | null }>
  missions: { active: number; completed: number; overdue: number; estimated_pipeline_impact: number; critical: ActionQueueItem | null }
  risks: { deals_without_next_action: number; overdue_followups: number; stalled_deals: number; pipeline_at_risk: number; top_risk_seller: { id: string; name: string; value: number } | null }
  gamification: { total_xp: number; avg_streak: number; engagement_ranking: Array<{ id: string; name: string; xp: number; streak: number; energy: number | null }> }
}

const STATUS_STYLE: Record<SellerStatus, string> = {
  accelerating: 'bg-emerald-500/10 text-emerald-600 border-0',
  selling_with_risk: 'bg-amber-500/10 text-amber-600 border-0',
  executing_not_converting: 'bg-blue-500/10 text-blue-600 border-0',
  low_execution: 'bg-red-500/10 text-red-600 border-0',
}

const PRIORITY_STYLE = {
  critical: 'bg-red-500/10 text-red-600 border-0',
  high: 'bg-amber-500/10 text-amber-600 border-0',
  medium: 'bg-blue-500/10 text-blue-600 border-0',
  low: 'bg-muted text-muted-foreground border-0',
}

function currency(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

export default function MonitoramentoEquipePage() {
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PerformanceData | null>(null)
  const [nudgeTarget, setNudgeTarget] = useState<ActionQueueItem | null>(null)
  const [nudgeMode, setNudgeMode] = useState<'message' | 'mission' | 'one_on_one'>('message')
  const [nudgeMessage, setNudgeMessage] = useState('')
  const [sendingNudge, setSendingNudge] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/team/commercial-performance?period=${period}`, { credentials: 'same-origin' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao carregar desempenho comercial')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar desempenho comercial')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openNudge = (item: ActionQueueItem) => {
    setNudgeTarget(item)
    setNudgeMode(item.type === 'risk' || item.type === 'execution' ? 'mission' : item.type === 'coaching' ? 'one_on_one' : 'message')
    setNudgeMessage(item.message)
  }

  const sendNudge = async () => {
    if (!nudgeTarget || !nudgeMessage.trim()) return
    setSendingNudge(true)
    try {
      const res = await fetch('/api/team/nudges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          seller_id: nudgeTarget.seller_id,
          type: nudgeTarget.type === 'risk' ? 'risk' : nudgeTarget.type === 'execution' ? 'execution' : nudgeTarget.type === 'coaching' ? 'coaching' : nudgeTarget.type === 'recognition' ? 'recognition' : 'focus',
          mode: nudgeMode,
          message: nudgeMessage,
          context: {
            ...nudgeTarget.context,
            metric: nudgeTarget.type,
            value_at_risk: nudgeTarget.impact_value,
          },
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erro ao enviar nudge')
      toast.success(nudgeMode === 'mission' ? 'Nudge enviado e missão criada' : nudgeMode === 'one_on_one' ? 'Nudge enviado é pauta criada' : 'Nudge enviado')
      setNudgeTarget(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar nudge')
    } finally {
      setSendingNudge(false)
    }
  }

  const generatePdiFromAction = async (item: ActionQueueItem) => {
    try {
      const gapRes = await fetch('/api/pdi/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          userId: item.seller_id,
          title: item.title,
          skillArea: item.type === 'coaching' ? 'fechamento' : item.type === 'risk' ? 'organizacao_de_pipeline' : 'disciplina_comercial',
          description: item.reason,
          detectedFrom: 'commercial_performance',
          severity: item.priority === 'critical' ? 'critical' : item.priority === 'high' ? 'high' : 'medium',
          confidenceScore: 0.82,
          impactValue: item.impact_value,
          evidence: item.context,
        }),
      })
      const gapBody = await gapRes.json()
      if (!gapRes.ok) throw new Error(gapBody.error || 'Erro ao criar gap')

      const trainingRes = await fetch('/api/pdi/generate-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ gap_id: gapBody.gap.id, seller_id: item.seller_id, create_mission: true }),
      })
      const trainingBody = await trainingRes.json()
      if (!trainingRes.ok) throw new Error(trainingBody.error || 'Erro ao gerar PDI')
      toast.success('PDI gerado para revisao em Desenvolvimento da Equipe.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar PDI')
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Não foi possível carregar a desempenho comercial.</CardContent>
      </Card>
    )
  }

  const summary = data.summary
  const goalPct = summary.monthly_goal ? Math.round(summary.revenue_won / summary.monthly_goal * 100) : 0
  const projectedPct = summary.monthly_goal ? Math.round((summary.revenue_won + summary.forecast_weighted) / summary.monthly_goal * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        label="Monitoramento"
        labelIcon={<LineChart className="h-3 w-3" />}
        title={<>Desempenho Comercial da <TitleHighlight>Equipe</TitleHighlight></>}
        description="Acompanhe vendas, previsão, execução e riscos comerciais por vendedor."
        actions={(
          <Select value={period} onValueChange={(value) => value && setPeriod(value)}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes atual</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
            </SelectContent>
          </Select>
        )}
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Meta do mes</p><p className="mt-1 text-xl font-semibold">{currency(summary.monthly_goal)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Vendido</p><p className="mt-1 text-xl font-semibold">{currency(summary.revenue_won)}</p><p className="text-xs text-muted-foreground">{goalPct}% da meta</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Previsão provavel</p><p className="mt-1 text-xl font-semibold">{currency(summary.forecast_weighted)}</p><p className="text-xs text-muted-foreground">Projeta {projectedPct}% da meta</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Gap para meta</p><p className="mt-1 text-xl font-semibold">{currency(summary.gap_to_goal)}</p><p className="text-xs text-muted-foreground">Gap real {currency(summary.gap_real)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Funil em risco</p><p className="mt-1 text-xl font-semibold">{currency(summary.pipeline_at_risk)}</p><p className="text-xs text-muted-foreground">{summary.deals_without_next_action} sem próxima ação</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Ticket medio</p><p className="mt-1 text-xl font-semibold">{currency(summary.avg_ticket)}</p><p className="text-xs text-muted-foreground">{summary.won_deals_count} vendas ganhas</p></CardContent></Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{data.ai_reading.title}</p>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <p>{data.ai_reading.summary}</p>
            <p>{data.ai_reading.goal}</p>
            <p>{data.ai_reading.risk}</p>
            <p>{data.ai_reading.attention}</p>
          </div>
          <div className="rounded-md border border-primary/20 bg-background/70 p-3 text-sm">
            <span className="font-semibold text-primary">Prioridade de hoje: </span>{data.ai_reading.priority}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking comercial por vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.sellers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nenhum vendedor ativo para analisar.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Vendedor</th>
                    <th className="py-2 pr-3">Vendido</th>
                    <th className="py-2 pr-3">% meta</th>
                    <th className="py-2 pr-3">Previsão</th>
                    <th className="py-2 pr-3">Funil</th>
                    <th className="py-2 pr-3">Risco</th>
                    <th className="py-2 pr-3">Vendas</th>
                    <th className="py-2 pr-3">Ticket</th>
                    <th className="py-2 pr-3">Conversão</th>
                    <th className="py-2 pr-3">Execução</th>
                    <th className="py-2 pr-3">Missões</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sellers.map((seller) => (
                    <tr key={seller.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials(seller.name)}</AvatarFallback></Avatar>
                          <div>
                            <Link href={`/equipe/${seller.id}`} className="font-medium hover:underline">{seller.name}</Link>
                            <p className="text-[11px] text-muted-foreground">{seller.commercial_score_label} · score {seller.commercial_score}</p>
                            <p className="text-[11px] text-muted-foreground">XP {seller.xp.toLocaleString('pt-BR')} · streak {seller.streak}d · energia {seller.checkin_energy ?? '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-medium">{currency(seller.revenue_won)}</td>
                      <td className="py-3 pr-3">
                        <div className="w-24"><Progress value={Math.min(100, seller.goal_pct)} className="h-2" /></div>
                        <span className="text-xs text-muted-foreground">{seller.goal_pct}%</span>
                      </td>
                      <td className="py-3 pr-3">{currency(seller.forecast_weighted)}</td>
                      <td className="py-3 pr-3">{currency(seller.open_pipeline)}</td>
                      <td className="py-3 pr-3 text-amber-600">{currency(seller.pipeline_at_risk)}</td>
                      <td className="py-3 pr-3">{seller.won_deals_count}</td>
                      <td className="py-3 pr-3">{currency(seller.avg_ticket)}</td>
                      <td className="py-3 pr-3">{seller.conversion_rate}%</td>
                      <td className="py-3 pr-3">{seller.kpi_execution_pct}%</td>
                      <td className="py-3 pr-3">{seller.missions_completed}/{seller.missions_active + seller.missions_completed}</td>
                      <td className="py-3 pr-3"><Badge className={STATUS_STYLE[seller.status]}>{seller.status_label}</Badge></td>
                      <td className="py-3 pr-3">
                        <Button size="sm" variant="outline" render={<Link href={seller.recommended_action.href} />}>{seller.recommended_action.label}</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Onde agir hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.action_queue.length === 0 ? (
              <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                Nenhuma intervencao critica no momento. Continue acompanhando previsão e próximas ações.
              </div>
            ) : data.action_queue.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={PRIORITY_STYLE[item.priority]}>{item.priority}</Badge>
                      <p className="font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Impacto: {item.impact_value > 0 ? currency(item.impact_value) : 'sem impacto financeiro direto'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['coaching', 'risk', 'execution'].includes(item.type) && (
                      <Button size="sm" variant="outline" onClick={() => generatePdiFromAction(item)}>
                        <Brain className="mr-2 h-4 w-4" />
                        Gerar PDI com IA
                      </Button>
                    )}
                    <Button size="sm" onClick={() => openNudge(item)}>
                      <Bell className="mr-2 h-4 w-4" />
                      Enviar nudge
                    </Button>
                    <Button size="sm" variant="outline" render={<Link href={item.cta.href} />}>{item.cta.label}</Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-primary" />Execução comercial</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.execution.map((item) => (
                <div key={item.event} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{item.label}</span>
                    <span className="font-medium">{item.done.toLocaleString('pt-BR')}{item.target ? `/${item.target.toLocaleString('pt-BR')}` : ''}</span>
                  </div>
                  <Progress value={item.pct ?? Math.min(100, item.done * 5)} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">Líder: {item.leader ?? '-'} · abaixo: {item.lagging ?? '-'}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4 text-violet-500" />Missões comerciais</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">Ativas</p><p className="text-2xl font-semibold">{data.missions.active}</p></div>
              <div><p className="text-xs text-muted-foreground">Concluídas</p><p className="text-2xl font-semibold">{data.missions.completed}</p></div>
              <div><p className="text-xs text-muted-foreground">Atrasadas</p><p className="text-2xl font-semibold">{data.missions.overdue}</p></div>
              <div><p className="text-xs text-muted-foreground">Impacto funil</p><p className="text-2xl font-semibold">{currency(data.missions.estimated_pipeline_impact)}</p></div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Briefcase className="h-4 w-4 text-red-500" />Riscos comerciais</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">oportunidades sem próxima ação</p><p className="text-2xl font-semibold">{data.risks.deals_without_next_action}</p></div>
            <div><p className="text-xs text-muted-foreground">retornos atrasados</p><p className="text-2xl font-semibold">{data.risks.overdue_followups}</p></div>
            <div><p className="text-xs text-muted-foreground">oportunidades parados</p><p className="text-2xl font-semibold">{data.risks.stalled_deals}</p></div>
            <div><p className="text-xs text-muted-foreground">Maior concentracao</p><p className="text-sm font-semibold">{data.risks.top_risk_seller ? `${data.risks.top_risk_seller.name} · ${currency(data.risks.top_risk_seller.value)}` : 'Sem concentracao'}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Medal className="h-4 w-4 text-amber-500" />Gamificacao secundaria</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs text-muted-foreground">XP total</p><p className="text-2xl font-semibold">{data.gamification.total_xp.toLocaleString('pt-BR')}</p></div>
              <div><p className="text-xs text-muted-foreground">Streak medio</p><p className="text-2xl font-semibold">{data.gamification.avg_streak}d</p></div>
            </div>
            <div className="space-y-2">
              {data.gamification.engagement_ranking.map((seller, index) => (
                <div key={seller.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{index + 1}. {seller.name}</span>
                  <span className="text-muted-foreground">{seller.xp.toLocaleString('pt-BR')} XP · {seller.streak}d</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.won_deals_count === 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 py-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Nenhuma venda ganha neste período ainda.</p>
            <p>Comece analisando oportunidades em proposta, retornos atrasados e vendedores sem ação comercial hoje.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!nudgeTarget} onOpenChange={(open) => !open && setNudgeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar nudge contextual</DialogTitle>
          </DialogHeader>
          {nudgeTarget && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{nudgeTarget.seller_name}</p>
                <p className="mt-1 text-muted-foreground">{nudgeTarget.reason}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Fluxo</label>
                <Select value={nudgeMode} onValueChange={(value) => value && setNudgeMode(value as typeof nudgeMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">Apenas enviar mensagem</SelectItem>
                    <SelectItem value="mission">Mensagem + criar missão</SelectItem>
                    <SelectItem value="one_on_one">Mensagem + abrir pauta de 1:1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
                <Textarea value={nudgeMessage} onChange={(event) => setNudgeMessage(event.target.value)} rows={5} />
              </div>
              <Button onClick={sendNudge} disabled={sendingNudge} className="w-full">
                {sendingNudge ? 'Enviando...' : 'Enviar nudge'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
