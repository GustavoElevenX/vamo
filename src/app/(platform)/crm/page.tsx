'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AiSuggestionCard } from '@/components/crm/ai-suggestion-card'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import {
  FORECAST_LABELS,
  NEXT_ACTION_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  STAGE_STUCK_DAYS,
  type CrmDeal,
  type DealStage,
  type ForecastCategory,
  type NextActionType,
} from '@/types/crm'
import { AlertTriangle, CalendarClock, Filter, Pencil, Plus, Sparkles, Target, UserRound } from 'lucide-react'

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function daysSince(value: string | null) {
  if (!value) return 999
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
}

function dueLabel(value: string | null) {
  if (!value) return 'sem prazo'
  const date = new Date(value)
  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000)
  if (diffDays < 0) return `${Math.abs(diffDays)}d atrasado`
  if (diffDays === 0) return 'vence hoje'
  if (diffDays === 1) return 'vence amanhã'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function isActionOverdue(value: string | null) {
  return !!value && new Date(value).getTime() < Date.now()
}

function hasOpenNextAction(deal: CrmDeal) {
  return !!deal.next_action_title && deal.next_action_status === 'open'
}

const actionTypes: NextActionType[] = ['follow_up', 'call', 'email', 'proposal', 'meeting', 'review', 'other']
const forecastCategories: ForecastCategory[] = ['pipeline', 'best_case', 'commit']

function formatMoneyInput(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function CrmPipelinePage() {
  const { user } = useRequiredAuth()
  const [deals, setDeals] = useState<CrmDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [nextActionTitle, setNextActionTitle] = useState('')
  const [nextActionDueAt, setNextActionDueAt] = useState('')
  const [nextActionType, setNextActionType] = useState<NextActionType>('follow_up')
  const [forecastCategory, setForecastCategory] = useState<ForecastCategory>('pipeline')
  const [editingDeal, setEditingDeal] = useState<CrmDeal | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editStage, setEditStage] = useState<DealStage>('prospecting')
  const [editProbability, setEditProbability] = useState('')
  const [editNextActionTitle, setEditNextActionTitle] = useState('')
  const [editNextActionDueAt, setEditNextActionDueAt] = useState('')
  const [editNextActionType, setEditNextActionType] = useState<NextActionType>('follow_up')
  const [editForecastCategory, setEditForecastCategory] = useState<ForecastCategory>('pipeline')
  const [savingDealId, setSavingDealId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/crm/deals')
    const body = await res.json().catch(() => ({}))
    setDeals(body.deals ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => setLoading(false))
  }, [load])

  const activeDeals = useMemo(() => deals.filter((deal) => deal.stage !== 'closed_lost'), [deals])
  const openDeals = useMemo(() => activeDeals.filter((deal) => deal.stage !== 'closed_won'), [activeDeals])
  const totalOpen = openDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0)
  const forecastLikely = openDeals.reduce((sum, deal) => sum + (Number(deal.value || 0) * Number(deal.probability || 0)) / 100, 0)
  const overdueActions = openDeals.filter((deal) => hasOpenNextAction(deal) && isActionOverdue(deal.next_action_due_at)).length
  const withoutNextAction = openDeals.filter((deal) => !hasOpenNextAction(deal)).length
  const won = deals.filter((deal) => deal.stage === 'closed_won').length
  const conversion = deals.length ? Math.round((won / deals.length) * 100) : 0

  const grouped = useMemo(() => {
    const map = new Map<DealStage, CrmDeal[]>()
    for (const stage of STAGE_ORDER) map.set(stage, [])
    for (const deal of activeDeals) {
      map.set(deal.stage, [...(map.get(deal.stage) ?? []), deal])
    }
    return map
  }, [activeDeals])

  async function createDeal() {
    const res = await fetch('/api/crm/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        value,
        stage: 'prospecting',
        next_action_title: nextActionTitle || null,
        next_action_type: nextActionType,
        next_action_due_at: nextActionDueAt || null,
        forecast_category: forecastCategory,
        probability: forecastCategory === 'commit' ? 75 : forecastCategory === 'best_case' ? 45 : 20,
      }),
    })
    if (res.ok) {
      setTitle('')
      setValue('')
      setNextActionTitle('')
      setNextActionDueAt('')
      setNextActionType('follow_up')
      setForecastCategory('pipeline')
      setOpen(false)
      await load()
    }
  }

  function openEdit(deal: CrmDeal) {
    setEditingDeal(deal)
    setEditTitle(deal.title)
    setEditValue(formatMoneyInput(Number(deal.value || 0)))
    setEditStage(deal.stage)
    setEditProbability(String(deal.probability ?? 0))
    setEditNextActionTitle(deal.next_action_title ?? '')
    setEditNextActionDueAt(deal.next_action_due_at ? deal.next_action_due_at.slice(0, 16) : '')
    setEditNextActionType(deal.next_action_type ?? 'follow_up')
    setEditForecastCategory(deal.forecast_category ?? 'pipeline')
  }

  async function updateDeal(id: string, patch: Record<string, unknown>) {
    setSavingDealId(id)
    const res = await fetch(`/api/crm/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    setSavingDealId(null)
    if (res.ok) await load()
    return res.ok
  }

  async function saveEdit() {
    if (!editingDeal) return
    const ok = await updateDeal(editingDeal.id, {
      title: editTitle,
      value: editValue,
      stage: editStage,
      probability: Number(editProbability || 0),
      next_action_title: editNextActionTitle || null,
      next_action_type: editNextActionType,
      next_action_due_at: editNextActionDueAt || null,
      forecast_category: editForecastCategory,
    })
    if (ok) setEditingDeal(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          label={user.role === 'seller' ? 'Vender' : 'CRM'}
          title={<>{user.role === 'seller' ? 'Pipeline de ' : 'Pipeline '}<TitleHighlight>ações</TitleHighlight></>}
          description="Oportunidades ativas, próximo passo, follow-up atrasado e impacto no forecast."
        />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button />}>
            <Plus className="h-4 w-4" />
            Novo lead
          </SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Novo lead</SheetTitle></SheetHeader>
            <div className="space-y-3 px-4">
              <div className="space-y-2">
                <Label htmlFor="deal-title">Título ou cliente</Label>
                <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Proposta ACME" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-value">Valor estimado</Label>
                <Input id="deal-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor" inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next-action">Próxima ação</Label>
                <Input id="next-action" value={nextActionTitle} onChange={(e) => setNextActionTitle(e.target.value)} placeholder="Ex.: Ligar para confirmar decisor" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="next-action-type">Tipo</Label>
                  <select
                    id="next-action-type"
                    value={nextActionType}
                    onChange={(e) => setNextActionType(e.target.value as NextActionType)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    {actionTypes.map((item) => <option key={item} value={item}>{NEXT_ACTION_LABELS[item]}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forecast-category">Forecast</Label>
                  <select
                    id="forecast-category"
                    value={forecastCategory}
                    onChange={(e) => setForecastCategory(e.target.value as ForecastCategory)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  >
                    {forecastCategories.map((item) => <option key={item} value={item}>{FORECAST_LABELS[item]}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="next-action-due">Prazo da ação</Label>
                <Input id="next-action-due" type="datetime-local" value={nextActionDueAt} onChange={(e) => setNextActionDueAt(e.target.value)} />
              </div>
            </div>
            <SheetFooter>
              <Button onClick={createDeal} disabled={!title.trim()}>Criar lead</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <Sheet open={!!editingDeal} onOpenChange={(nextOpen) => !nextOpen && setEditingDeal(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>Editar lead</SheetTitle></SheetHeader>
          <div className="space-y-3 px-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-value">Valor estimado</Label>
              <Input id="edit-value" value={editValue} onChange={(e) => setEditValue(e.target.value)} inputMode="decimal" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-stage">Etapa do funil</Label>
                <select
                  id="edit-stage"
                  value={editStage}
                  onChange={(e) => setEditStage(e.target.value as DealStage)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {[...STAGE_ORDER, 'closed_lost' as DealStage].map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-probability">Probabilidade (%)</Label>
                <Input id="edit-probability" value={editProbability} onChange={(e) => setEditProbability(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-next-action">Próxima ação</Label>
              <Input id="edit-next-action" value={editNextActionTitle} onChange={(e) => setEditNextActionTitle(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-action-type">Tipo</Label>
                <select
                  id="edit-action-type"
                  value={editNextActionType}
                  onChange={(e) => setEditNextActionType(e.target.value as NextActionType)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {actionTypes.map((item) => <option key={item} value={item}>{NEXT_ACTION_LABELS[item]}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-forecast">Forecast</Label>
                <select
                  id="edit-forecast"
                  value={editForecastCategory}
                  onChange={(e) => setEditForecastCategory(e.target.value as ForecastCategory)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {[...forecastCategories, 'closed' as ForecastCategory].map((item) => <option key={item} value={item}>{FORECAST_LABELS[item]}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-action-due">Prazo da ação</Label>
              <Input id="edit-action-due" type="datetime-local" value={editNextActionDueAt} onChange={(e) => setEditNextActionDueAt(e.target.value)} />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={saveEdit} disabled={!editingDeal || savingDealId === editingDeal.id || !editTitle.trim()}>
              {editingDeal && savingDealId === editingDeal.id ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total em aberto</p><p className="text-2xl font-bold">{money(totalOpen)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Forecast provável</p><p className="text-2xl font-bold">{money(forecastLikely)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Ações atrasadas</p><p className="text-2xl font-bold">{overdueActions}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Sem próxima ação</p><p className="text-2xl font-bold">{withoutNextAction}</p><p className="text-[10px] text-muted-foreground">Conversão geral: {conversion}%</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>
      ) : (
        <div className="space-y-4">
          {activeDeals.length === 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">Seu pipeline ainda está vazio</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cadastre um lead com próxima ação para a VAMO priorizar follow-ups, forecast e ganho potencial.
                    </p>
                  </div>
                </div>
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Novo lead
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-5">
            {STAGE_ORDER.map((stage) => {
              const columnDeals = grouped.get(stage) ?? []
              return (
                <section key={stage} className="min-w-[240px] rounded-2xl border border-border/60 bg-card/35 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{STAGE_LABELS[stage]}</span>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border/70 px-2 text-xs font-bold text-muted-foreground">
                      {columnDeals.length}
                    </span>
                  </div>

                  {columnDeals.length === 0 ? (
                    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/35 px-4 text-center">
                      <CalendarClock className="mb-2 h-6 w-6 text-muted-foreground/45" />
                      <p className="text-xs font-semibold text-muted-foreground">Nenhum lead nesta etapa</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
                        Quando houver uma oportunidade aqui, a próxima ação aparecerá no cartão.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {columnDeals.map((deal) => {
                        const stuckDays = daysSince(deal.last_activity_at)
                        const isStuck = stuckDays > STAGE_STUCK_DAYS[deal.stage]
                        return (
                          <Card key={deal.id} className="transition-colors hover:ring-primary/30">
                            <CardContent className="space-y-3 py-4">
                              <Link href={`/crm/${deal.id}`} className="block space-y-1">
                                <p className="font-semibold leading-snug">{deal.account?.name || deal.title}</p>
                                {deal.account?.name && <p className="text-xs text-muted-foreground">{deal.title}</p>}
                              </Link>
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold tabular-nums">{money(deal.value)}</span>
                                {user.role !== 'seller' && <span className="flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="h-3.5 w-3.5" />{deal.owner?.name || 'Sem dono'}</span>}
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`stage-${deal.id}`} className="text-[10px] text-muted-foreground">Avançar no funil</Label>
                                <select
                                  id={`stage-${deal.id}`}
                                  value={deal.stage}
                                  disabled={savingDealId === deal.id}
                                  onChange={(event) => updateDeal(deal.id, { stage: event.target.value })}
                                  className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs"
                                >
                                  {[...STAGE_ORDER, 'closed_lost' as DealStage].map((stageOption) => (
                                    <option key={stageOption} value={stageOption}>{STAGE_LABELS[stageOption]}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={isStuck ? 'destructive' : 'secondary'}>
                                  {deal.last_activity_at ? `${stuckDays}d sem atividade` : 'sem atividade'}
                                </Badge>
                                <Badge variant="outline"><Filter className="h-3 w-3" />{deal.probability}%</Badge>
                                <Badge variant="outline">{FORECAST_LABELS[deal.forecast_category] ?? 'Pipeline'}</Badge>
                              </div>
                              <div className={`rounded-lg border p-2.5 text-xs ${hasOpenNextAction(deal) && isActionOverdue(deal.next_action_due_at) ? 'border-amber-500/30 bg-amber-500/10' : 'border-border/50 bg-muted/25'}`}>
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1 font-semibold">
                                    {hasOpenNextAction(deal) && isActionOverdue(deal.next_action_due_at) ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <CalendarClock className="h-3.5 w-3.5 text-primary" />}
                                    Próxima ação
                                  </span>
                                  <span className="text-muted-foreground">{hasOpenNextAction(deal) ? dueLabel(deal.next_action_due_at) : 'sem ação aberta'}</span>
                                </div>
                                <p className="text-muted-foreground">
                                  {hasOpenNextAction(deal) ? deal.next_action_title : 'Defina uma ação para este lead não ficar parado.'}
                                </p>
                                {hasOpenNextAction(deal) && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 h-7 w-full text-[11px]"
                                    disabled={savingDealId === deal.id}
                                    onClick={() => updateDeal(deal.id, { next_action_status: 'done' })}
                                  >
                                    Marcar ação como feita
                                  </Button>
                                )}
                                {deal.ai_priority_score > 0 && (
                                  <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-primary">
                                    <Sparkles className="h-3 w-3" />
                                    Prioridade IA {deal.ai_priority_score}/100
                                  </p>
                                )}
                              </div>
                              <AiSuggestionCard dealId={deal.id} />
                              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => openEdit(deal)}>
                                <Pencil className="h-3.5 w-3.5" />
                                Editar lead
                              </Button>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
