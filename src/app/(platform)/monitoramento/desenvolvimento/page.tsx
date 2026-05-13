'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { ContextualRecommendationCard, type ContextualRecommendation } from '@/components/performance-os/ContextualRecommendationCard'
import { ImpactSummaryCard } from '@/components/performance-os/ImpactSummaryCard'
import { PdiEvidenceCard } from '@/components/pdi/PdiEvidenceCard'
import { PdiGapCard, type PdiGap } from '@/components/pdi/PdiGapCard'
import { PdiPlanCard, type PdiPlan } from '@/components/pdi/PdiPlanCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Brain, ChartNoAxesCombined, CheckCircle2, Loader2, RefreshCw, Sparkles, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface RoiRow {
  user_id: string
  total_plans: number
  total_applications: number
  total_evidences: number
  avg_kpi_delta: number | null
  active_plans: number
  completed_plans: number
}

interface PdiApplication {
  id: string
  plan_id: string
  description: string
  status: string
  created_at: string
  plan?: { title?: string }
  user?: { name?: string }
  deal?: { title?: string; value?: number }
}

interface SellerOption {
  id: string
  name: string
}

export default function ManagerDevelopmentPage() {
  useRequiredAuth()
  const [gaps, setGaps] = useState<PdiGap[]>([])
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [applications, setApplications] = useState<PdiApplication[]>([])
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([])
  const [roi, setRoi] = useState<RoiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState('')
  const [planAdjustments, setPlanAdjustments] = useState<Record<string, string>>({})
  const [kpiValues, setKpiValues] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [createMissionWithTraining, setCreateMissionWithTraining] = useState(true)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualSellerId, setManualSellerId] = useState('')
  const [manualSkill, setManualSkill] = useState('fechamento')
  const [manualTitle, setManualTitle] = useState('')
  const [manualEvidence, setManualEvidence] = useState('')

  async function load() {
    const [gapsRes, plansRes, appRes, recRes, sellersRes, roiRes] = await Promise.all([
      fetch('/api/pdi/gaps'),
      fetch('/api/pdi/plans'),
      fetch('/api/pdi/applications'),
      fetch('/api/action-recommendations'),
      fetch('/api/team/sellers'),
      fetch('/api/roi/calculate').catch(() => null),
    ])
    const [gapsBody, plansBody, appBody, recBody, sellersBody] = await Promise.all([
      gapsRes.json().catch(() => ({ gaps: [] })),
      plansRes.json().catch(() => ({ plans: [] })),
      appRes.json().catch(() => ({ applications: [] })),
      recRes.json().catch(() => ({ recommendations: [] })),
      sellersRes.json().catch(() => ({ sellers: [] })),
    ])
    const roiBody = roiRes && roiRes.ok ? await roiRes.json().catch(() => ({})) : {}
    setGaps((gapsBody.gaps ?? []) as PdiGap[])
    setPlans((plansBody.plans ?? []) as PdiPlan[])
    setApplications((appBody.applications ?? []) as PdiApplication[])
    setSellers((sellersBody.sellers ?? []) as SellerOption[])
    setRecommendations(((recBody.recommendations ?? []) as ContextualRecommendation[]).filter((item) => ['pdi', 'health'].includes(item.source_module)))
    setRoi((roiBody.pdi_roi ?? roiBody.rows ?? []) as RoiRow[])
    setLoading(false)
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  const updatePlanStatus = async (plan: PdiPlan, status: string) => {
    setSavingId(plan.id)
    try {
      const res = await fetch('/api/pdi/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: plan.id,
          status,
          description: planAdjustments[plan.id]?.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar PDI')
      toast.success(status === 'approved' ? 'PDI aprovado.' : 'PDI atualizado.')
      await load()
    } catch {
      toast.error('Não foi possível atualizar o PDI.')
    } finally {
      setSavingId(null)
    }
  }

  const detectGaps = async () => {
    setDetecting(true)
    try {
      const res = await fetch('/api/pdi/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Erro ao detectar gaps')
      const body = await res.json().catch(() => ({ created: 0, updated: 0 }))
      toast.success(`Deteccao concluida: ${body.created ?? 0} novos, ${body.updated ?? 0} atualizados.`)
      await load()
    } catch {
      toast.error('Não foi possível detectar gaps agora.')
    } finally {
      setDetecting(false)
    }
  }

  const generateTraining = async (gap: PdiGap) => {
    setSavingId(gap.id)
    try {
      const res = await fetch('/api/pdi/generate-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap_id: gap.id, seller_id: gap.user?.id, create_mission: createMissionWithTraining }),
      })
      if (!res.ok) throw new Error('Erro ao gerar treinamento')
      toast.success('Treinamento gerado. Revise e aprove antes de liberar ao vendedor.')
      await load()
    } catch {
      toast.error('Não foi possível gerar treinamento com IA.')
    } finally {
      setSavingId(null)
    }
  }

  const createManualGap = async () => {
    if (!manualSellerId || !manualTitle.trim() || !manualSkill.trim()) return
    setSavingId('manual-gap')
    try {
      const res = await fetch('/api/pdi/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: manualSellerId,
          title: manualTitle,
          skillArea: manualSkill,
          description: manualEvidence,
          detectedFrom: 'manager',
          severity: 'medium',
          confidenceScore: 0.9,
          evidence: { managerObservation: manualEvidence },
        }),
      })
      if (!res.ok) throw new Error('Erro ao criar gap')
      toast.success('Gap manual criado.')
      setManualOpen(false)
      setManualSellerId('')
      setManualSkill('fechamento')
      setManualTitle('')
      setManualEvidence('')
      await load()
    } catch {
      toast.error('Não foi possível criar o gap manual.')
    } finally {
      setSavingId(null)
    }
  }

  const dismissGap = async (gap: PdiGap) => {
    setSavingId(gap.id)
    try {
      const res = await fetch('/api/pdi/gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gap.id, status: 'dismissed' }),
      })
      if (!res.ok) throw new Error('Erro ao dispensar gap')
      toast.success('Gap dispensado.')
      await load()
    } catch {
      toast.error('Não foi possível dispensar o gap.')
    } finally {
      setSavingId(null)
    }
  }

  const regeneratePlan = async (plan: PdiPlan) => {
    setSavingId(plan.id)
    try {
      const res = await fetch(`/api/pdi/plans/${plan.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_notes: planAdjustments[plan.id] ?? '', create_mission: true }),
      })
      if (!res.ok) throw new Error('Erro ao regenerar PDI')
      toast.success('Novo treinamento gerado para revisao.')
      await load()
    } catch {
      toast.error('Não foi possível regenerar o PDI.')
    } finally {
      setSavingId(null)
    }
  }

  const reviewApplication = async (application: PdiApplication, status: 'approved' | 'validated' | 'needs_revision' | 'needs_adjustment' | 'rejected') => {
    setSavingId(application.id)
    try {
      const rawKpiValue = (kpiValues[application.id] ?? '').trim()
      const parsedKpiValue = Number(rawKpiValue)
      const hasKpiValue = rawKpiValue.length > 0 && Number.isFinite(parsedKpiValue)
      const res = await fetch('/api/pdi/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          status,
          reviewNotes,
          currentValue: hasKpiValue ? parsedKpiValue : null,
          kpiEntryValue: hasKpiValue ? parsedKpiValue : null,
        }),
      })
      if (!res.ok) throw new Error('Erro ao validar evidência')
      toast.success(['approved', 'validated'].includes(status) ? 'Evidência validada e ciclo atualizado.' : status === 'rejected' ? 'Evidência reprovada.' : 'Ajuste solicitado.')
      setReviewNotes('')
      await load()
    } catch {
      toast.error('Não foi possível revisar a evidência.')
    } finally {
      setSavingId(null)
    }
  }

  const activePlans = plans.filter((plan) => ['approved', 'active'].includes(plan.status)).length
  const completedPlans = plans.filter((plan) => plan.status === 'completed').length
  const avgDelta = useMemo(() => {
    const values = roi.map((row) => Number(row.avg_kpi_delta || 0)).filter((value) => value !== 0)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  }, [roi])
  const aiReading = useMemo(() => {
    const active = gaps.filter((gap) => ['open', 'in_training', 'in_pdi', 'improving'].includes(gap.status))
    const bySkill = new Map<string, number>()
    for (const gap of active) bySkill.set(gap.skill_area, (bySkill.get(gap.skill_area) ?? 0) + 1)
    const topSkills = [...bySkill.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([skill]) => skill.replace(/_/g, ' '))
    const critical = active.filter((gap) => ['critical', 'high'].includes(gap.severity))
    const topGap = [...active].sort((a, b) => Number(b.impact_value ?? 0) - Number(a.impact_value ?? 0))[0]
    return {
      summary: topSkills.length
        ? `O principal gargalo do time hoje esta em ${topSkills.join(' e ')}.`
        : 'Ainda não há gargalo dominante detectado nos gaps ativos.',
      evidence: topGap
        ? `${topGap.user?.name ?? 'Um vendedor'} tem ${topGap.title.toLowerCase()} com impacto estimado de ${Number(topGap.impact_value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}.`
        : 'A VAMO precisa de mais sinais de CRM, KPI, carteira e simulador para priorizar.',
      priority: critical[0]
        ? `Prioridade recomendada: gerar treinamento aplicado para ${critical[0].user?.name ?? 'o vendedor'} em ${critical[0].skill_area.replace(/_/g, ' ')} e validar aplicação real.`
        : 'Prioridade recomendada: rodar deteccao de gaps e observar padroes comerciais recorrentes.',
    }
  }, [gaps])

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="section-label"><Brain className="h-3.5 w-3.5" />Gestao</div>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Desenvolvimento da Equipe</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Gaps, feedback da VamoAI, PDIs, aplicacoes reais e ROI vistos como decisão comercial do gestor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/monitoramento/roi" />}>
            <ChartNoAxesCombined className="h-4 w-4" />
            Ver ROI
          </Button>
          <Button variant="outline" onClick={() => setManualOpen(true)}>
            Criar gap manual
          </Button>
          <Button onClick={detectGaps} disabled={detecting}>
            {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Detectar gaps
          </Button>
        </div>
      </div>

      <Card className="border-blue-500/25 bg-blue-500/10">
        <CardContent className="space-y-2 p-5">
          <div className="section-label"><Brain className="h-3.5 w-3.5" />Regra de responsabilidade</div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A VamoAI apoia o diagnóstico, mas não decide sozinha. O gestor interpreta gaps, aprova PDI, transforma recomendação em missão prática, valida evidência e acompanha impacto no resultado.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-5">
        <PdiEvidenceCard label="Gaps criticos" value={String(gaps.filter((gap) => ['critical', 'high'].includes(gap.severity)).length)} hint="Priorizados por impacto e confianca" />
        <PdiEvidenceCard label="PDIs para aprovar" value={String(plans.filter((plan) => ['recommended', 'pending_approval'].includes(plan.status)).length)} hint="Gerados pela IA aguardando gestor" />
        <PdiEvidenceCard label="PDIs ativos" value={String(activePlans)} hint="Aguardando treino e aplicação" />
        <PdiEvidenceCard label="PDIs concluidos" value={String(completedPlans)} hint="Com evidência mensurável" />
        <PdiEvidenceCard label="Delta medio KPI" value={avgDelta.toFixed(1)} hint="Baseado na view de ROI" />
      </div>

      <ImpactSummaryCard
        title="Mesmo dado, decisoes diferentes"
        description="O vendedor vê treino, aplicação e progresso. O gestor vê risco, aprovação, evolução por habilidade e impacto no resultado."
        modules={['pdi', 'crm', 'kpi', 'health', 'commission', 'roi']}
      />

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="space-y-3 p-5">
          <div className="section-label"><Sparkles className="h-3.5 w-3.5" />VAMO IA - Desenvolvimento da Equipe</div>
          <p className="text-lg font-bold">{aiReading.summary}</p>
          <p className="text-sm text-muted-foreground">{aiReading.evidence}</p>
          <div className="rounded-lg border border-primary/20 bg-background/70 p-3 text-sm font-medium">{aiReading.priority}</div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={createMissionWithTraining} onChange={(event) => setCreateMissionWithTraining(event.target.checked)} />
            Criar missão vinculada quando gerar treinamento com IA
          </label>
        </CardContent>
      </Card>

      {recommendations.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Decisoes prioritarias</CardTitle></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {recommendations.slice(0, 4).map((recommendation) => (
              <ContextualRecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Gaps por vendedor</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {gaps.length ? gaps.slice(0, 8).map((gap) => (
              <PdiGapCard
                key={gap.id}
                gap={gap}
                context="manager"
                onGenerateTraining={generateTraining}
                onDismiss={dismissGap}
              />
            )) : (
              <p className="text-sm text-muted-foreground">Nenhum gap critico detectado ainda. A VAMO analisara KPIs, CRM, funil, clientes, missões e simulações para identificar pontos de desenvolvimento.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Planos para aprovar ou acompanhar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {plans.length ? plans.slice(0, 8).map((plan) => (
              <div key={plan.id} className="space-y-2">
                <PdiPlanCard plan={plan} context="manager" sellerId={plan.user_id} />
                {['recommended', 'pending_approval'].includes(plan.status) && (
                  <div className="flex justify-end gap-2">
                    <Textarea
                      value={planAdjustments[plan.id] ?? ''}
                      onChange={(event) => setPlanAdjustments((prev) => ({ ...prev, [plan.id]: event.target.value }))}
                      placeholder="Ajuste opcional do gestor antes da aprovação"
                      className="min-h-9 flex-1 text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={() => updatePlanStatus(plan, 'rejected')} disabled={savingId === plan.id}>
                      <XCircle className="h-3.5 w-3.5" />
                      Descartar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => regeneratePlan(plan)} disabled={savingId === plan.id}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Gerar novo
                    </Button>
                    <Button size="sm" onClick={() => updatePlanStatus(plan, 'active')} disabled={savingId === plan.id}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aprovar PDI
                    </Button>
                  </div>
                )}
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Nenhum PDI ativo. Gere um treinamento com IA a partir de um gap ou crie um PDI manualmente para um vendedor.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Aplicacoes aguardando validação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            placeholder="Observação da validação para o vendedor"
          />
          {applications.filter((item) => item.status === 'submitted').length ? (
            applications.filter((item) => item.status === 'submitted').slice(0, 8).map((application) => (
              <div key={application.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{application.plan?.title ?? 'Aplicação de PDI'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{application.description}</p>
                    {application.deal?.title && (
                      <p className="mt-1 text-xs text-muted-foreground">oportunidade: {application.deal.title}</p>
                    )}
                    <Input
                      value={kpiValues[application.id] ?? ''}
                      onChange={(event) => setKpiValues((prev) => ({ ...prev, [application.id]: event.target.value }))}
                      placeholder="Valor de KPI comprovado opcional"
                      inputMode="decimal"
                      className="mt-3 max-w-xs text-xs"
                    />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => reviewApplication(application, 'needs_adjustment')} disabled={savingId === application.id}>
                      Pedir ajuste
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reviewApplication(application, 'rejected' as any)} disabled={savingId === application.id}>
                      Reprovar
                    </Button>
                    <Button size="sm" onClick={() => reviewApplication(application, 'approved' as any)} disabled={savingId === application.id}>
                      Validar
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma aplicação aguardando validação. Quando um vendedor aplicar um treinamento em um caso real, a evidência aparecera aqui.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar gap manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="manual-seller">Vendedor</Label>
              <select id="manual-seller" value={manualSellerId} onChange={(event) => setManualSellerId(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="">Selecione</option>
                {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-skill">Habilidade</Label>
              <select id="manual-skill" value={manualSkill} onChange={(event) => setManualSkill(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                {['prospecção', 'qualificacao', 'diagnostico', 'follow_up', 'proposta', 'negociacao', 'fechamento', 'objecoes', 'construcao_de_valor', 'organizacao_de_pipeline', 'pos_venda', 'expansao', 'retencao', 'relacionamento'].map((skill) => (
                  <option key={skill} value={skill}>{skill.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-title">Título do gap</Label>
              <Input id="manual-title" value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} placeholder="Ex.: Dificuldade em objeção de preço" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-evidence">Evidência observada</Label>
              <Textarea id="manual-evidence" value={manualEvidence} onChange={(event) => setManualEvidence(event.target.value)} placeholder="Descreva a reuniao, comportamento observado, impacto e contexto comercial." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={createManualGap} disabled={!manualSellerId || !manualTitle.trim() || savingId === 'manual-gap'}>Criar gap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
