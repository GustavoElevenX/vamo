'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { ContextualRecommendationCard, type ContextualRecommendation } from '@/components/performance-os/ContextualRecommendationCard'
import { NextBestActionCard } from '@/components/performance-os/NextBestActionCard'
import { PdiApplicationCard } from '@/components/pdi/PdiApplicationCard'
import { PdiEvidenceCard } from '@/components/pdi/PdiEvidenceCard'
import { PdiGapCard, type PdiGap } from '@/components/pdi/PdiGapCard'
import { PdiPlanCard, type PdiPlan } from '@/components/pdi/PdiPlanCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BookOpenCheck, Sparkles } from 'lucide-react'

interface PdiApplication {
  id: string
  description: string
  status: string
  plan?: { title?: string | null } | null
  deal?: { title?: string | null } | null
}

interface DealOption {
  id: string
  title: string
  value: number
  stage: string
  next_action_title?: string | null
  account?: { name?: string | null } | null
}

export default function SellerPdiPage() {
  const { user } = useRequiredAuth()
  const [gaps, setGaps] = useState<PdiGap[]>([])
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [applications, setApplications] = useState<PdiApplication[]>([])
  const [deals, setDeals] = useState<DealOption[]>([])
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([])
  const [planId, setPlanId] = useState('')
  const [dealId, setDealId] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [gapsRes, plansRes, appRes, recRes, dealsRes] = await Promise.all([
      fetch('/api/pdi/gaps'),
      fetch('/api/pdi/plans'),
      fetch('/api/pdi/applications'),
      fetch('/api/action-recommendations'),
      fetch('/api/crm/deals'),
    ])
    const [gapsBody, plansBody, appBody, recBody, dealsBody] = await Promise.all([
      gapsRes.json().catch(() => ({ gaps: [] })),
      plansRes.json().catch(() => ({ plans: [] })),
      appRes.json().catch(() => ({ applications: [] })),
      recRes.json().catch(() => ({ recommendations: [] })),
      dealsRes.json().catch(() => ({ deals: [] })),
    ])
    setGaps((gapsBody.gaps ?? []) as PdiGap[])
    setPlans((plansBody.plans ?? []) as PdiPlan[])
    setApplications((appBody.applications ?? []) as PdiApplication[])
    setDeals(((dealsBody.deals ?? []) as DealOption[]).filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage)))
    setRecommendations(((recBody.recommendations ?? []) as ContextualRecommendation[]).filter((item) => item.source_module === 'pdi'))
    setLoading(false)
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!planId && plans[0]?.id) setPlanId(plans[0].id)
  }, [planId, plans])

  const activePlan = useMemo(() => plans.find((plan) => plan.id === planId) ?? plans[0] ?? null, [planId, plans])
  const completedApplications = applications.filter((item) => ['validated', 'approved'].includes(item.status)).length

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activePlan || !description.trim()) return
    setSaving(true)
    const res = await fetch('/api/pdi/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: activePlan.id,
        dealId: dealId || null,
        applicationType: dealId ? 'deal' : 'simulation',
        description,
        evidence: {
          submittedBy: user.id,
          note: description,
          dealId: dealId || null,
        },
      }),
    })
    setSaving(false)
    if (res.ok) {
      setDescription('')
      setDealId('')
      await load()
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="section-label"><BookOpenCheck className="h-3.5 w-3.5" />Evoluir</div>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Meu PDI aplicado</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Seu desenvolvimento nasce de gaps reais e precisa voltar para uma aplicacao em deal, follow-up, proposta ou simulacao.
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary">Performance OS</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <PdiEvidenceCard label="Gaps abertos" value={String(gaps.length)} hint="Diagnostico vindo de KPI, CRM ou gestor" />
        <PdiEvidenceCard label="PDIs ativos" value={String(plans.filter((plan) => ['approved', 'active'].includes(plan.status)).length)} hint="Treinos curtos com aplicacao real" />
        <PdiEvidenceCard label="Aplicacoes validadas" value={String(completedApplications)} hint="Evidencias praticas aceitas" />
      </div>

      {recommendations[0] && (
        <ContextualRecommendationCard recommendation={recommendations[0]} />
      )}

      {activePlan ? (
        <NextBestActionCard
          title="Seu proximo salto"
          description={`Aplique "${activePlan.title}" em um caso real e registre evidencia para provar evolucao.`}
          href="#aplicacao-real"
          actionLabel="Registrar evidencia"
        />
      ) : (
        <NextBestActionCard
          title="Ainda sem PDI ativo"
          description="Quando um gap real for detectado, a VAMO IA e seu gestor transformam isso em treino curto e aplicacao pratica."
          href="/chat-ia"
          actionLabel="Conversar com IA"
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Gaps detectados</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {gaps.length ? gaps.map((gap) => <PdiGapCard key={gap.id} gap={gap} />) : (
              <p className="text-sm text-muted-foreground">Nenhum gap ativo. Continue registrando CRM e KPIs para gerar diagnostico real.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Planos em andamento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {plans.length ? plans.map((plan) => <PdiPlanCard key={plan.id} plan={plan} context="seller" />) : (
              <p className="text-sm text-muted-foreground">Voce ainda nao possui um PDI ativo. Quando a VAMO identificar uma oportunidade de evolucao, seu gestor podera liberar um plano para voce.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="aplicacao-real">
        <CardHeader><CardTitle>Aplicacao real</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[240px_1fr]" onSubmit={submitApplication}>
            <div className="space-y-2">
              <Label htmlFor="plan">PDI</Label>
              <select id="plan" value={planId} onChange={(event) => setPlanId(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal">Selecionar oportunidade</Label>
              <select id="deal" value={dealId} onChange={(event) => setDealId(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="">Sem oportunidade vinculada</option>
                {deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.title} | {deal.account?.name ?? 'Sem conta'} | {deal.stage} | {Number(deal.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} | {deal.next_action_title ?? 'sem proxima acao'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="evidence">Evidencia aplicada</Label>
              <Textarea id="evidence" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva o que treinou, onde aplicou e que comportamento mudou." />
            </div>
            <div className="md:col-span-2">
              <Button disabled={!activePlan || !description.trim() || saving}>
                <Sparkles className="h-4 w-4" />
                {saving ? 'Registrando...' : 'Registrar aplicacao'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historico de aplicacoes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {applications.length ? applications.map((item) => (
            <PdiApplicationCard
              key={item.id}
              title={item.plan?.title || item.deal?.title || 'Aplicacao de PDI'}
              description={item.description}
              status={item.status}
            />
          )) : (
            <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
              Nenhuma aplicacao ainda. Abra um deal em <Link className="text-primary underline-offset-4 hover:underline" href="/crm">Vender</Link> e traga evidencia para ca.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
