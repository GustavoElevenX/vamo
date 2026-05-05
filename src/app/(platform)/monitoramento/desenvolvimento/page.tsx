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
import { Brain, ChartNoAxesCombined } from 'lucide-react'

interface RoiRow {
  user_id: string
  total_plans: number
  total_applications: number
  total_evidences: number
  avg_kpi_delta: number | null
  active_plans: number
  completed_plans: number
}

export default function ManagerDevelopmentPage() {
  const { user } = useRequiredAuth()
  const [gaps, setGaps] = useState<PdiGap[]>([])
  const [plans, setPlans] = useState<PdiPlan[]>([])
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([])
  const [roi, setRoi] = useState<RoiRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [gapsRes, plansRes, recRes, roiRes] = await Promise.all([
        fetch('/api/pdi/gaps'),
        fetch('/api/pdi/plans'),
        fetch('/api/action-recommendations'),
        fetch('/api/roi/calculate').catch(() => null),
      ])
      const [gapsBody, plansBody, recBody] = await Promise.all([
        gapsRes.json().catch(() => ({ gaps: [] })),
        plansRes.json().catch(() => ({ plans: [] })),
        recRes.json().catch(() => ({ recommendations: [] })),
      ])
      const roiBody = roiRes && roiRes.ok ? await roiRes.json().catch(() => ({})) : {}
      setGaps((gapsBody.gaps ?? []) as PdiGap[])
      setPlans((plansBody.plans ?? []) as PdiPlan[])
      setRecommendations(((recBody.recommendations ?? []) as ContextualRecommendation[]).filter((item) => ['pdi', 'health'].includes(item.source_module)))
      setRoi((roiBody.pdi_roi ?? roiBody.rows ?? []) as RoiRow[])
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [])

  const activePlans = plans.filter((plan) => ['recommended', 'approved', 'active'].includes(plan.status)).length
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
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <PdiEvidenceCard label="Gaps detectados" value={String(gaps.length)} hint="CRM, KPI, simulacao ou gestor" />
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
            {gaps.length ? gaps.slice(0, 8).map((gap) => <PdiGapCard key={gap.id} gap={gap} />) : (
              <p className="text-sm text-muted-foreground">Sem gaps ativos. Conforme CRM e KPIs gerarem padroes, eles entram aqui.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Planos para aprovar ou acompanhar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {plans.length ? plans.slice(0, 8).map((plan) => <PdiPlanCard key={plan.id} plan={plan} />) : (
              <p className="text-sm text-muted-foreground">Nenhum PDI recomendado no momento.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
