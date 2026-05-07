'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { AiSuggestionCard } from '@/components/crm/ai-suggestion-card'
import { DealActivitySheet } from '@/components/crm/deal-activity-sheet'
import { PlaybookChecklist } from '@/components/crm/playbook-checklist'
import { CommissionTraceCard } from '@/components/commission/CommissionTraceCard'
import { PerformanceEventTimeline, type PerformanceEventTimelineItem } from '@/components/performance-os/PerformanceEventTimeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ACTIVITY_LABELS,
  FORECAST_LABELS,
  NEXT_ACTION_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  type CrmDeal,
  type DealStage,
  type ForecastCategory,
  type NextActionType,
} from '@/types/crm'
import { ArrowLeft, CalendarClock, CalendarDays, DollarSign, Save } from 'lucide-react'

const actionTypes: NextActionType[] = ['follow_up', 'call', 'email', 'proposal', 'meeting', 'review', 'other']
const forecastCategories: ForecastCategory[] = ['pipeline', 'best_case', 'commit', 'closed']
const lostReasons = ['Preco', 'Sem orcamento', 'Concorrente', 'Sem resposta', 'Proposta fraca', 'Timing', 'Nao viu valor', 'Nao era perfil', 'Outro']

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dueText(value: string | null) {
  if (!value) return 'Sem prazo definido'
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatMoneyInput(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function DealDetailPage() {
  const { user } = useRequiredAuth()
  const params = useParams<{ id: string }>()
  const [deal, setDeal] = useState<CrmDeal | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editStage, setEditStage] = useState<DealStage>('prospecting')
  const [editProbability, setEditProbability] = useState('')
  const [editNextActionTitle, setEditNextActionTitle] = useState('')
  const [editNextActionDueAt, setEditNextActionDueAt] = useState('')
  const [editNextActionType, setEditNextActionType] = useState<NextActionType>('follow_up')
  const [editForecastCategory, setEditForecastCategory] = useState<ForecastCategory>('pipeline')
  const [editLostReason, setEditLostReason] = useState('')
  const [timeline, setTimeline] = useState<PerformanceEventTimelineItem[]>([])
  const [commissionTrace, setCommissionTrace] = useState<{
    expectedCommission: number
    releasedCommission: number
    pendingCommission: number
    blockedCommission: number
    reason: string
  } | null>(null)

  const fillForm = (nextDeal: CrmDeal) => {
    setEditTitle(nextDeal.title)
    setEditValue(formatMoneyInput(Number(nextDeal.value || 0)))
    setEditStage(nextDeal.stage)
    setEditProbability(String(nextDeal.probability ?? 0))
    setEditNextActionTitle(nextDeal.next_action_title ?? '')
    setEditNextActionDueAt(nextDeal.next_action_due_at ? nextDeal.next_action_due_at.slice(0, 16) : '')
    setEditNextActionType(nextDeal.next_action_type ?? 'follow_up')
    setEditForecastCategory(nextDeal.forecast_category ?? 'pipeline')
    setEditLostReason(nextDeal.lost_reason ?? '')
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/crm/deals/${params.id}`)
    const body = await res.json().catch(() => ({}))
    const nextDeal = body.deal ?? null
    setDeal(nextDeal)
    if (nextDeal) fillForm(nextDeal)
    if (nextDeal) {
      const [timelineRes, traceRes] = await Promise.all([
        fetch(`/api/performance-events?entityType=crm_deal&entityId=${nextDeal.id}`),
        fetch(`/api/commission/trace?dealId=${nextDeal.id}`),
      ])
      const timelineBody = await timelineRes.json().catch(() => ({ timeline: [] }))
      const traceBody = await traceRes.json().catch(() => ({ trace: null }))
      setTimeline((timelineBody.timeline ?? []) as PerformanceEventTimelineItem[])
      setCommissionTrace(traceBody.trace ?? null)
    }
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => setLoading(false))
  }, [load])

  async function saveDeal() {
    if (!deal) return
    if (editStage === 'closed_lost' && !editLostReason) return
    setSaving(true)
    const res = await fetch(`/api/crm/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle,
        value: editValue,
        stage: editStage,
        probability: Number(editProbability || 0),
        next_action_title: editNextActionTitle || null,
        next_action_due_at: editNextActionDueAt || null,
        next_action_type: editNextActionType,
        forecast_category: editForecastCategory,
        lost_reason: editStage === 'closed_lost' ? editLostReason : null,
      }),
    })
    setSaving(false)
    if (res.ok) await load()
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>
  }

  if (!deal) {
    return <div className="space-y-3"><p>Lead não encontrado.</p><Link href="/crm"><Button variant="outline">Voltar</Button></Link></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/crm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Pipeline
          </Link>
          <h1 className="text-2xl font-bold">{deal.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge>{STAGE_LABELS[deal.stage]}</Badge>
            {deal.account?.name && <Badge variant="secondary">{deal.account.name}</Badge>}
            <Badge variant="outline">{deal.owner?.name}</Badge>
          </div>
        </div>
        <DealActivitySheet dealId={deal.id} onSaved={load} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Informações do lead</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Valor</p><p className="flex items-center gap-1 text-xl font-bold"><DollarSign className="h-4 w-4" />{money(deal.value)}</p></div>
              <div><p className="text-xs text-muted-foreground">Probabilidade</p><p className="text-xl font-bold">{deal.probability}%</p></div>
              <div><p className="text-xs text-muted-foreground">Fechamento esperado</p><p className="flex items-center gap-1 text-sm"><CalendarDays className="h-4 w-4" />{deal.expected_close || 'Sem data'}</p></div>
              <div><p className="text-xs text-muted-foreground">Forecast</p><p className="text-xl font-bold">{FORECAST_LABELS[deal.forecast_category] ?? 'Pipeline'}</p></div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Próxima ação</p>
                <p className="flex items-center gap-1 text-sm"><CalendarClock className="h-4 w-4 text-primary" />{deal.next_action_title || 'Nenhuma ação definida'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{deal.next_action_type ? NEXT_ACTION_LABELS[deal.next_action_type] : 'Follow-up'} - {dueText(deal.next_action_due_at)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Editar e avançar no funil</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deal-title">Título</Label>
                  <Input id="deal-title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-value">Valor</Label>
                  <Input id="deal-value" value={editValue} onChange={(event) => setEditValue(event.target.value)} inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-stage">Etapa</Label>
                  <select id="deal-stage" value={editStage} onChange={(event) => setEditStage(event.target.value as DealStage)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                    {[...STAGE_ORDER, 'closed_lost' as DealStage].map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-probability">Probabilidade (%)</Label>
                  <Input id="deal-probability" value={editProbability} onChange={(event) => setEditProbability(event.target.value)} inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-next-action">Próxima ação</Label>
                  <Input id="deal-next-action" value={editNextActionTitle} onChange={(event) => setEditNextActionTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-action-due">Prazo</Label>
                  <Input id="deal-action-due" type="datetime-local" value={editNextActionDueAt} onChange={(event) => setEditNextActionDueAt(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-action-type">Tipo da ação</Label>
                  <select id="deal-action-type" value={editNextActionType} onChange={(event) => setEditNextActionType(event.target.value as NextActionType)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                    {actionTypes.map((type) => <option key={type} value={type}>{NEXT_ACTION_LABELS[type]}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal-forecast">Forecast</Label>
                  <select id="deal-forecast" value={editForecastCategory} onChange={(event) => setEditForecastCategory(event.target.value as ForecastCategory)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                    {forecastCategories.map((category) => <option key={category} value={category}>{FORECAST_LABELS[category]}</option>)}
                  </select>
                </div>
                {editStage === 'closed_lost' && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="deal-lost-reason">Motivo da perda</Label>
                    <select id="deal-lost-reason" value={editLostReason} onChange={(event) => setEditLostReason(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                      <option value="">Selecione um motivo</option>
                      {lostReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <Button onClick={saveDeal} disabled={saving || !editTitle.trim() || (editStage === 'closed_lost' && !editLostReason)}>
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar lead'}
              </Button>
            </CardContent>
          </Card>

          <PlaybookChecklist dealId={deal.id} stage={deal.stage} currentUserId={user.id} role={user.role} />

          {commissionTrace && (
            <CommissionTraceCard
              expected={commissionTrace.expectedCommission}
              released={commissionTrace.releasedCommission}
              pending={commissionTrace.pendingCommission}
              blocked={commissionTrace.blockedCommission}
              reason={commissionTrace.reason}
            />
          )}

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {deal.activities?.length ? deal.activities.map((activity) => (
                <div key={activity.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{ACTIVITY_LABELS[activity.type]} - {activity.title}</p>
                    <span className="text-xs text-muted-foreground">{new Date(activity.occurred_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {activity.outcome && <p className="mt-2 text-sm text-muted-foreground">{activity.outcome}</p>}
                  {activity.notes && <p className="mt-1 text-xs text-muted-foreground">{activity.notes}</p>}
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Consequencias operacionais</CardTitle></CardHeader>
            <CardContent>
              <PerformanceEventTimeline events={timeline} />
            </CardContent>
          </Card>
        </div>
        <AiSuggestionCard dealId={deal.id} auto />
      </div>
    </div>
  )
}
