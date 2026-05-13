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
import { BookOpenCheck, CheckCircle2, Clock, Dumbbell, ListChecks, MessageSquareText, Sparkles, Swords, Target } from 'lucide-react'

interface PdiApplication {
  id: string
  description: string
  status: string
  plan?: { title?: string | null } | null
  deal?: { title?: string | null } | null
  account?: { name?: string | null } | null
}

interface PdiMission {
  id: string
  title: string
  status: string
  pdi_plan_id?: string | null
  gap_id?: string | null
  progressPct?: number
  current_value?: number | null
  target_value?: number | null
  validationLabel?: string
  pdi_plan?: { id: string; title: string | null; status: string | null } | null
}

interface DealOption {
  id: string
  title: string
  value: number
  stage: string
  next_action_title?: string | null
  account?: { name?: string | null } | null
}

interface AccountOption {
  id: string
  name: string
  segment?: string | null
}

interface TrainingPayload {
  title?: string
  problem_summary?: string
  sales_impact?: string
  quick_concept?: string
  practical_example?: string
  script?: string
  checklist?: string[]
  exercise?: string
  roleplay_prompt?: string | null
  real_case_application?: string
  required_evidence?: string
  validation_criteria?: string
  recommended_deadline_days?: number
  recommended_xp?: number
}

export default function SellerPdiPage() {
  const { user } = useRequiredAuth()
  const [gaps, setGaps] = useState<PdiGap[]>([])
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [applications, setApplications] = useState<PdiApplication[]>([])
  const [missions, setMissions] = useState<PdiMission[]>([])
  const [deals, setDeals] = useState<DealOption[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([])
  const [planId, setPlanId] = useState('')
  const [dealId, setDealId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [gapsRes, plansRes, appRes, recRes, dealsRes, accountsRes, missionsRes] = await Promise.all([
      fetch('/api/pdi/gaps'),
      fetch('/api/pdi/plans'),
      fetch('/api/pdi/applications'),
      fetch('/api/action-recommendations'),
      fetch('/api/crm/deals'),
      fetch('/api/crm/accounts'),
      fetch('/api/missions/my'),
    ])
    const [gapsBody, plansBody, appBody, recBody, dealsBody, accountsBody, missionsBody] = await Promise.all([
      gapsRes.json().catch(() => ({ gaps: [] })),
      plansRes.json().catch(() => ({ plans: [] })),
      appRes.json().catch(() => ({ applications: [] })),
      recRes.json().catch(() => ({ recommendations: [] })),
      dealsRes.json().catch(() => ({ deals: [] })),
      accountsRes.json().catch(() => ({ accounts: [] })),
      missionsRes.json().catch(() => ({ missions: [] })),
    ])
    setGaps((gapsBody.gaps ?? []) as PdiGap[])
    setPlans((plansBody.plans ?? []) as PdiPlan[])
    setApplications((appBody.applications ?? []) as PdiApplication[])
    setDeals(((dealsBody.deals ?? []) as DealOption[]).filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage)))
    setAccounts((accountsBody.accounts ?? []) as AccountOption[])
    setRecommendations(((recBody.recommendations ?? []) as ContextualRecommendation[]).filter((item) => item.source_module === 'pdi'))
    setMissions((missionsBody.missions ?? []) as PdiMission[])
    setLoading(false)
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!planId && plans[0]?.id) setPlanId(plans[0].id)
  }, [planId, plans])

  const activePlan = useMemo(() => plans.find((plan) => plan.id === planId) ?? plans[0] ?? null, [planId, plans])
  const training = activePlan?.metadata?.trainingPayload as TrainingPayload | undefined
  const linkedMissions = useMemo(() => {
    if (!activePlan) return []
    return missions.filter((mission) => (
      mission.pdi_plan_id === activePlan.id ||
      mission.pdi_plan?.id === activePlan.id ||
      (activePlan as PdiPlan & { gap?: { id?: string | null } | null }).gap?.id === mission.gap_id
    ))
  }, [activePlan, missions])
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
          accountId: accountId || null,
        },
        account_id: accountId || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setDescription('')
      setDealId('')
      setAccountId('')
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
            Seu PDI e definido pelo gestor com apoio da VamoAI e deve ser aplicado em situacoes reais de venda.
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary">Performance OS</Badge>
      </div>

      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 text-sm text-muted-foreground">
          <strong className="text-foreground">PDI desenvolve.</strong> PDI desenvolve habilidade; missao forca aplicacao pratica. A logica aqui e sempre: gap real, microtreino, evidencia, validacao do gestor e evolucao acompanhada.
        </CardContent>
      </Card>

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

      {activePlan && (
        <Card>
          <CardHeader>
            <CardTitle>Microtreino aplicado liberado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {training ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-border/60 p-3">
                    <Clock className="mb-2 h-4 w-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Prazo recomendado</p>
                    <p className="font-bold">{training.recommended_deadline_days ?? 7} dias</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <Sparkles className="mb-2 h-4 w-4 text-primary" />
                    <p className="text-xs text-muted-foreground">XP recomendado</p>
                    <p className="font-bold">+{training.recommended_xp ?? 120} XP</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Evidencia exigida</p>
                    <p className="text-sm font-medium">{training.required_evidence}</p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <TrainingBlock icon={BookOpenCheck} title="Conceito rapido" body={training.quick_concept} />
                  <TrainingBlock icon={MessageSquareText} title="Script" body={training.script} />
                  <TrainingBlock icon={Dumbbell} title="Exercicio" body={training.exercise} />
                  <TrainingBlock icon={Sparkles} title="Roleplay" body={training.roleplay_prompt || 'Roleplay opcional conforme orientacao do gestor.'} />
                </div>

                <div className="rounded-lg border border-border/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    <p className="font-bold">Checklist de aplicacao</p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {(training.checklist ?? []).map((item) => (
                      <div key={item} className="flex items-start gap-2 rounded-lg border border-border/60 p-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <TrainingBlock icon={Target} title="Aplicacao real" body={training.real_case_application} />
                  <TrainingBlock icon={CheckCircle2} title="Criterio de validacao" body={training.validation_criteria} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Este plano ainda nao tem treinamento detalhado gerado pela IA.</p>
            )}

            {activePlan.items?.length ? (
              <div className="rounded-lg border border-border/60 p-4">
                <p className="mb-3 font-bold">Itens do PDI</p>
                <div className="space-y-2">
                  {activePlan.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                      </div>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {activePlan && (
        <Card>
          <CardHeader><CardTitle>Missoes praticas vinculadas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {linkedMissions.length ? linkedMissions.map((mission) => (
              <div key={mission.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{mission.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Esta missao transforma o PDI em aplicacao pratica. Concluir a missao nao conclui o PDI automaticamente quando houver validacao humana; envie evidencia para o gestor validar sua evolucao.
                    </p>
                  </div>
                  <Badge variant="outline">{mission.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{Number(mission.current_value || 0).toLocaleString('pt-BR')} / {Number(mission.target_value || 0).toLocaleString('pt-BR')}</span>
                  <span>{mission.progressPct ?? 0}%</span>
                  {mission.validationLabel && <span>{mission.validationLabel}</span>}
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
                Este PDI ainda nao tem missao pratica vinculada. O gestor pode criar uma missao relacionada para forcar a aplicacao em oportunidades reais.
              </div>
            )}
            <Button variant="outline" size="sm" render={<Link href="/performance/missoes" />}>
              <Swords className="h-4 w-4" />
              Ver missoes ativas
            </Button>
          </CardContent>
        </Card>
      )}

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
              <Label htmlFor="account">Selecionar cliente/carteira</Label>
              <select id="account" value={accountId} onChange={(event) => setAccountId(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="">Sem cliente vinculado</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}{account.segment ? ` | ${account.segment}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="evidence">Evidencia aplicada</Label>
              <Textarea id="evidence" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva o que treinou, deal ou cliente usado, resposta do cliente, proximo passo criado e resultado preliminar." />
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
              accountName={item.account?.name ?? null}
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

function TrainingBlock({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof BookOpenCheck
  title: string
  body?: string | null
}) {
  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="font-bold">{title}</p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{body || 'Aguardando conteudo do treinamento.'}</p>
    </div>
  )
}
