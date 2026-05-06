'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, MessageSquare, Phone, Send, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Deal = {
  id: string
  title: string
  value: number
  stage: string
  account?: { id: string; name: string } | null
}

const ACTIONS = [
  { value: 'crm_activity_call', label: 'Ligacao', activityType: 'call', icon: Phone },
  { value: 'crm_activity_whatsapp', label: 'WhatsApp', activityType: 'whatsapp', icon: MessageSquare },
  { value: 'crm_activity_email', label: 'E-mail', activityType: 'email', icon: Send },
  { value: 'crm_activity_follow_up', label: 'Follow-up', activityType: 'follow_up', icon: CheckCircle2 },
  { value: 'crm_activity_meeting', label: 'Reuniao', activityType: 'meeting', icon: Target },
  { value: 'crm_activity_proposal_sent', label: 'Proposta enviada', activityType: 'proposal_sent', icon: Send },
] as const

export default function RegistrarAcaoComercialPage() {
  const router = useRouter()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loadingDeals, setLoadingDeals] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    action: 'crm_activity_follow_up',
    dealId: 'none',
    title: '',
    outcome: '',
    notes: '',
    value: '1',
    occurredAt: new Date().toISOString().slice(0, 16),
    nextActionTitle: '',
    nextActionDueAt: '',
  })

  useEffect(() => {
    let cancelled = false
    const loadDeals = async () => {
      try {
        const res = await fetch('/api/crm/deals', { credentials: 'same-origin' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar oportunidades')
        if (!cancelled) setDeals((data.deals ?? []).filter((deal: Deal) => !['closed_won', 'closed_lost'].includes(deal.stage)))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar oportunidades')
      } finally {
        if (!cancelled) setLoadingDeals(false)
      }
    }
    loadDeals()
    return () => { cancelled = true }
  }, [])

  const selectedAction = useMemo(() => ACTIONS.find((action) => action.value === form.action) ?? ACTIONS[0], [form.action])
  const selectedDeal = deals.find((deal) => deal.id === form.dealId)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.outcome.trim()) {
      toast.error('Descreva o que aconteceu')
      return
    }

    setSubmitting(true)
    try {
      if (form.dealId !== 'none') {
        const res = await fetch(`/api/crm/deals/${form.dealId}/activities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            type: selectedAction.activityType,
            title: form.title || selectedAction.label,
            outcome: form.outcome,
            notes: form.notes || null,
            occurred_at: form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
            next_action_title: form.nextActionTitle || undefined,
            next_action_due_at: form.nextActionDueAt ? new Date(form.nextActionDueAt).toISOString() : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao registrar acao')
      } else {
        const res = await fetch('/api/execution/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            type: form.action,
            value: Number(form.value || 1),
            occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : undefined,
            source: 'manual',
            metadata: {
              title: form.title || selectedAction.label,
              outcome: form.outcome,
              notes: form.notes || null,
              description: form.outcome,
            },
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao registrar acao')
      }

      toast.success('Acao comercial registrada')
      router.push('/performance/missoes')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar acao')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Registrar acao comercial</h1>
          <p className="text-sm text-muted-foreground">A acao alimenta KPIs, missoes, XP e cockpit pelo evento de execucao.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dados da acao</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de acao</Label>
                <Select value={form.action} onValueChange={(value) => value && setForm({ ...form, action: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((action) => (
                      <SelectItem key={action.value} value={action.value}>{action.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Oportunidade vinculada</Label>
                <Select value={form.dealId} onValueChange={(value) => value && setForm({ ...form, dealId: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um deal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem deal vinculado</SelectItem>
                    {deals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>{deal.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loadingDeals && <p className="text-xs text-muted-foreground">Carregando oportunidades...</p>}
              </div>
            </div>

            {selectedDeal && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {selectedDeal.account?.name ? `${selectedDeal.account.name} - ` : null}
                {Number(selectedDeal.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Titulo</Label>
                <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={selectedAction.label} />
              </div>
              <div className="space-y-2">
                <Label>Quando aconteceu</Label>
                <Input type="datetime-local" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resultado da acao</Label>
              <Textarea value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })} placeholder="Descreva objetivamente o que aconteceu com o cliente." />
            </div>

            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Contexto adicional, objeções, combinados ou proximos passos." />
            </div>

            {form.dealId === 'none' ? (
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Proxima acao no deal</Label>
                  <Input value={form.nextActionTitle} onChange={(event) => setForm({ ...form, nextActionTitle: event.target.value })} placeholder="Ex: Enviar proposta revisada" />
                </div>
                <div className="space-y-2">
                  <Label>Prazo da proxima acao</Label>
                  <Input type="datetime-local" value={form.nextActionDueAt} onChange={(event) => setForm({ ...form, nextActionDueAt: event.target.value })} />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Registrando...' : 'Registrar acao'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
