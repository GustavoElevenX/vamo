'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { AiSuggestionCard } from '@/components/crm/ai-suggestion-card'
import { DealActivitySheet } from '@/components/crm/deal-activity-sheet'
import { PlaybookChecklist } from '@/components/crm/playbook-checklist'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ACTIVITY_LABELS, STAGE_LABELS, type CrmDeal } from '@/types/crm'
import { ArrowLeft, CalendarDays, DollarSign } from 'lucide-react'

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DealDetailPage() {
  const { user } = useRequiredAuth()
  const params = useParams<{ id: string }>()
  const [deal, setDeal] = useState<CrmDeal | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/crm/deals/${params.id}`)
    const body = await res.json().catch(() => ({}))
    setDeal(body.deal ?? null)
    setLoading(false)
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [params.id])

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>
  if (!deal) return <div className="space-y-3"><p>Deal nao encontrado.</p><Link href="/crm"><Button variant="outline">Voltar</Button></Link></div>

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
            <CardHeader><CardTitle>Informacoes do deal</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Valor</p><p className="flex items-center gap-1 text-xl font-bold"><DollarSign className="h-4 w-4" />{money(deal.value)}</p></div>
              <div><p className="text-xs text-muted-foreground">Probabilidade</p><p className="text-xl font-bold">{deal.probability}%</p></div>
              <div><p className="text-xs text-muted-foreground">Fechamento esperado</p><p className="flex items-center gap-1 text-sm"><CalendarDays className="h-4 w-4" />{deal.expected_close || 'Sem data'}</p></div>
            </CardContent>
          </Card>

          <PlaybookChecklist dealId={deal.id} stage={deal.stage} currentUserId={user.id} role={user.role} />

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
        </div>
        <AiSuggestionCard dealId={deal.id} auto />
      </div>
    </div>
  )
}
