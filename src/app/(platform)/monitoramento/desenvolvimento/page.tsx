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
import { Input } from '@/components/ui/input'
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

export default function ManagerDevelopmentPage() {
  useRequiredAuth()
  const [gaps, setGaps] = useState<PdiGap[]>([])
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [applications, setApplications] = useState<PdiApplication[]>([])
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([])
  const [roi, setRoi] = useState<RoiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState('')
  const [planAdjustments, setPlanAdjustments] = useState<Record<string, string>>({})
  const [kpiValues, setKpiValues] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)

  async function load() {
    const [gapsRes, plansRes, appRes, recRes, roiRes] = await Promise.all([
      fetch('/api/pdi/gaps'),
      fetch('/api/pdi/plans'),
      fetch('/api/pdi/applications'),
      fetch('/api/action-recommendations'),
      fetch('/api/roi/calculate').catch(() => null),
    ])
    const [gapsBody, plansBody, appBody, recBody] = await Promise.all([
      gapsRes.json().catch(() => ({ gaps: [] })),
      plansRes.json().catch(() => ({ plans: [] })),
      appRes.json().catch(() => ({ applications: [] })),
      recRes.json().catch(() => ({ recommendations: [] })),
    ])
    const roiBody = roiRes && roiRes.ok ? await roiRes.json().catch(() => ({})) : {}
    setGaps((gapsBody.gaps ?? []) as PdiGap[])
    setPlans((plansBody.plans ?? []) as PdiPlan[])
    setApplications((appBody.applications ?? []) as PdiApplication[])
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
      toast.error('Nao foi possivel atualizar o PDI.')
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
      toast.error('Nao foi possivel detectar gaps agora.')
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
        body: JSON.stringify({ gap_id: gap.id, seller_id: gap.user?.id, create_mission: true }),
      })
      if (!res.ok) throw new Error('Erro ao gerar treinamento')
      toast.success('Treinamento gerado. Revise e aprove antes de liberar ao vendedor.')
      await load()
    } catch {
      toast.error('Nao foi possivel gerar treinamento com IA.')
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
      toast.error('Nao foi possivel dispensar o gap.')
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
      toast.error('Nao foi possivel regenerar o PDI.')
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
      if (!res.ok) throw new Error('Erro ao validar evidencia')
      toast.success(['approved', 'validated'].includes(status) ? 'Evidencia validada e ciclo atualizado.' : status === 'rejected' ? 'Evidencia reprovada.' : 'Ajuste solicitado.')
      setReviewNotes('')
      await load()
    } catch {
      toast.error('Nao foi possivel revisar a evidencia.')
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
            Gaps, PDIs, aplicacoes reais e ROI do desenvolvimento vistos como decisao comercial, nao biblioteca de cursos.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/monitoramento/roi" />}>
          <ChartNoAxesCombined className="h-4 w-4" />
          Ver ROI
        </Button>
        <Button onClick={detectGaps} disabled={detecting}>
          {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Detectar gaps
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <PdiEvidenceCard label="Gaps criticos" value={String(gaps.filter((gap) => ['critical', 'high'].includes(gap.severity)).length)} hint="Priorizados por impacto e confianca" />
        <PdiEvidenceCard label="PDIs para aprovar" value={String(plans.filter((plan) => ['recommended', 'pending_approval'].includes(plan.status)).length)} hint="Gerados pela IA aguardando gestor" />
        <PdiEvidenceCard label="PDIs ativos" value={String(activePlans)} hint="Aguardando treino e aplicacao" />
        <PdiEvidenceCard label="PDIs concluidos" value={String(completedPlans)} hint="Com evidencia mensuravel" />
        <PdiEvidenceCard label="Delta medio KPI" value={avgDelta.toFixed(1)} hint="Baseado na view de ROI" />
      </div>

      <ImpactSummaryCard
        title="Mesmo dado, decisoes diferentes"
        description="O vendedor ve treino, aplicacao e progresso. O gestor ve risco, aprovacao, evolucao por habilidade e impacto no resultado."
        modules={['pdi', 'crm', 'kpi', 'health', 'commission', 'roi']}
      />

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
              <p className="text-sm text-muted-foreground">Nenhum gap critico detectado ainda. A VAMO analisara KPIs, CRM, pipeline, clientes, missoes e simulacoes para identificar pontos de desenvolvimento.</p>
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
                      placeholder="Ajuste opcional do gestor antes da aprovacao"
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
        <CardHeader><CardTitle>Aplicacoes aguardando validacao</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            placeholder="Observacao da validacao para o vendedor"
          />
          {applications.filter((item) => item.status === 'submitted').length ? (
            applications.filter((item) => item.status === 'submitted').slice(0, 8).map((application) => (
              <div key={application.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold">{application.plan?.title ?? 'Aplicacao de PDI'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{application.description}</p>
                    {application.deal?.title && (
                      <p className="mt-1 text-xs text-muted-foreground">Deal: {application.deal.title}</p>
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
            <p className="text-sm text-muted-foreground">Nenhuma aplicacao aguardando validacao. Quando um vendedor aplicar um treinamento em um caso real, a evidencia aparecera aqui.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
