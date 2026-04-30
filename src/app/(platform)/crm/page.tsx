'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AiSuggestionCard } from '@/components/crm/ai-suggestion-card'
import { STAGE_LABELS, STAGE_ORDER, STAGE_STUCK_DAYS, type CrmDeal, type DealStage } from '@/types/crm'
import { DollarSign, Filter, Plus, UserRound } from 'lucide-react'

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function daysSince(value: string | null) {
  if (!value) return 999
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
}

export default function CrmPipelinePage() {
  const { user } = useRequiredAuth()
  const [deals, setDeals] = useState<CrmDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/crm/deals')
    const body = await res.json().catch(() => ({}))
    setDeals(body.deals ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  const activeDeals = deals.filter((deal) => deal.stage !== 'closed_lost')
  const openDeals = activeDeals.filter((deal) => deal.stage !== 'closed_won')
  const totalOpen = openDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0)
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
      body: JSON.stringify({ title, value: Number(value || 0), stage: 'prospecting' }),
    })
    if (res.ok) {
      setTitle('')
      setValue('')
      setOpen(false)
      await load()
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
            <Badge variant="secondary">CRM</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Oportunidades ativas, proximo passo e risco de inatividade.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button />}>
            <Plus className="h-4 w-4" />
            Novo deal
          </SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>Novo deal</SheetTitle></SheetHeader>
            <div className="space-y-3 px-4">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulo ou cliente" />
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor" inputMode="decimal" />
            </div>
            <SheetFooter>
              <Button onClick={createDeal} disabled={!title.trim()}>Criar deal</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total em aberto</p><p className="text-2xl font-bold">{money(totalOpen)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Deals ativos</p><p className="text-2xl font-bold">{openDeals.length}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Conversao geral</p><p className="text-2xl font-bold">{conversion}%</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>
      ) : (
        <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-5">
          {STAGE_ORDER.map((stage) => {
            const columnDeals = grouped.get(stage) ?? []
            return (
              <section key={stage} className="min-w-72 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                  <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
                  <Badge variant="outline">{columnDeals.length}</Badge>
                </div>
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
                          <span className="flex items-center gap-1 font-medium"><DollarSign className="h-3.5 w-3.5" />{money(deal.value)}</span>
                          {user.role !== 'seller' && <span className="flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="h-3.5 w-3.5" />{deal.owner?.name || 'Sem dono'}</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={isStuck ? 'destructive' : 'secondary'}>
                            {deal.last_activity_at ? `${stuckDays}d sem atividade` : 'sem atividade'}
                          </Badge>
                          <Badge variant="outline"><Filter className="h-3 w-3" />{deal.probability}%</Badge>
                        </div>
                        <AiSuggestionCard dealId={deal.id} />
                      </CardContent>
                    </Card>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
