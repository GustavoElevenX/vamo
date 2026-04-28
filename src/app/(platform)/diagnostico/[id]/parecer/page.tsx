'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft, DollarSign, AlertTriangle, TrendingDown, Sparkles, Rocket,
  ArrowRight, Calendar, Target, Printer, Zap, Brain, HeartPulse, CheckCircle,
} from 'lucide-react'
import Link from 'next/link'
import { DIAGNOSTIC_AREAS, DIAGNOSTIC_QUADRANTS } from '@/lib/constants'
import type { DiagnosticSession, DiagnosticArea } from '@/types'

const MISSION_TEMPLATES: Record<DiagnosticArea, { title: string; description: string; impact: 'alto' | 'medio' | 'baixo' }> = {
  lead_generation: {
    title: 'Aumentar volume de leads qualificados',
    description: 'Criar rotina de prospecção com meta diária e revisão semanal da qualidade dos leads.',
    impact: 'alto',
  },
  sales_process: {
    title: 'Reduzir perda em proposta e follow-up',
    description: 'Padronizar retorno em até 24h para propostas abertas e medir conversão por etapa.',
    impact: 'alto',
  },
  team_management: {
    title: 'Elevar aderência do time às metas',
    description: 'Criar check-ins curtos por vendedor e missão coletiva com reconhecimento semanal.',
    impact: 'medio',
  },
  tools_technology: {
    title: 'Melhorar qualidade dos dados no CRM',
    description: 'Garantir atualização de oportunidades no mesmo dia para dar visibilidade real ao funil.',
    impact: 'medio',
  },
}

function getMissionSuggestions(session: DiagnosticSession) {
  return (Object.entries(session.area_scores ?? {}) as [DiagnosticArea, { pct: number }][])
    .filter(([, score]) => typeof score?.pct === 'number')
    .sort(([, a], [, b]) => a.pct - b.pct)
    .slice(0, 4)
    .map(([area, score]) => ({
      ...MISSION_TEMPLATES[area],
      area,
      areaLabel: DIAGNOSTIC_AREAS[area],
      scorePct: Math.round(score.pct),
    }))
}

function parseMonthlyGoal(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (normalized.includes('abaixo') && normalized.includes('50')) return 50_000
  if (normalized.includes('50') && normalized.includes('200')) return 125_000
  if (normalized.includes('200') && normalized.includes('500')) return 350_000
  if (normalized.includes('500') && normalized.includes('2m')) return 1_250_000
  if (normalized.includes('2m')) return 2_000_000
  return null
}

const ROADMAP: Record<string, { d30: string[]; d60: string[]; d90: string[] }> = {
  critical: {
    d30: ['Estabilizar o processo de vendas com missoes corretivas', 'Convocar reuniao 1:1 com todo o time', 'Mapear os 2 maiores gargalos financeiros'],
    d60: ['Lancar missoes gamificadas focadas em conversao e follow-up', 'Implementar script de proposta e follow-up padronizado', 'Revisao semanal de pipeline com todo o time'],
    d90: ['Medir ROI das intervencoes vs. perda inicial identificada', 'Definir metas individuais para o proximo ciclo', 'Iniciar programa de desenvolvimento comportamental'],
  },
  at_risk: {
    d30: ['Priorizar correcao dos 3 principais gargalos identificados', 'Lancar missoes de atividade intensa com recompensa imediata', 'Avaliar engajamento e identificar riscos de burnout'],
    d60: ['Missoes em sequencia de dificuldade crescente (nivel 1-2-3)', 'Implementar reconhecimento publico semanal', 'Automatizar calculo de comissao para transparencia'],
    d90: ['Revisao completa das metas com base nos resultados das missoes', 'Expandir gamificacao para missoes coletivas', 'Calcular ROI da plataforma e apresentar ao time'],
  },
  developing: {
    d30: ['Escalar o que ja funciona bem no processo', 'Criar desafios progressivos para manter engajamento', 'Missoes de upsell e ticket medio para vendedores top'],
    d60: ['Lancar missoes coletivas para fortalecer cultura de equipe', 'Implementar programa de mentoria interna', 'Revisar comissionamento para incluir bonus de qualidade'],
    d90: ['Documentar e replicar as melhores praticas identificadas', 'Expandir para novos KPIs e metricas avancadas', 'Definir metas de Temporada de Alta Performance (90 dias)'],
  },
  optimized: {
    d30: ['Manter ritmo e engajamento com novas missoes desafiadoras', 'Identificar proximos niveis de crescimento', 'Introduzir missoes de lideranca para vendedores senior'],
    d60: ['Criar programa de embaixadores internos', 'Explorar novos mercados e segmentos com a equipe', 'Implementar coaching peer-to-peer entre vendedores'],
    d90: ['Medir impacto da gamificacao no churn de vendedores', 'Expandir modelo para outros times da empresa', 'Documentar case de sucesso para uso em vendas'],
  },
}

export default function ParecerPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useRequiredAuth()
  const router = useRouter()

  const [session, setSession] = useState<DiagnosticSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    let cancelled = false

    const load = async () => {
      const request = fetch(`/api/diagnostics/${id}`).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar diagnóstico')
        return data as { session: DiagnosticSession }
      })

      const timeout = new Promise<{ session: DiagnosticSession }>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 20_000)
      )

      const { session: data } = await Promise.race([request, timeout])
      if (!cancelled) {
        setSession(data)
        setLoading(false)
      }
    }

    load().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [user, id])


  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Parecer nao encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/diagnostico')}>Voltar</Button>
      </div>
    )
  }

  const quadrant = session.quadrant ? DIAGNOSTIC_QUADRANTS[session.quadrant] : null
  const estimatedMonthlyRevenue = parseMonthlyGoal((session.company_context as Record<string, unknown> | null)?.meta_mensal)
  const estimatedLoss = estimatedMonthlyRevenue
    ? Math.round(estimatedMonthlyRevenue * ((100 - session.health_pct) / 100) * 0.3)
    : null
  const roadmap = ROADMAP[session.quadrant ?? 'at_risk']
  const missionSuggestions = getMissionSuggestions(session)

  // Top bottlenecks by financial impact
  const areas = Object.entries(session.area_scores || {}) as [DiagnosticArea, { score: number; max: number; pct: number }][]
  const sortedAreas = [...areas].sort((a, b) => a[1].pct - b[1].pct)
  const topBottlenecks = sortedAreas.slice(0, Math.min(5, sortedAreas.length)).map((entry) => {
    const [area, scores] = entry
    const impactWeight = (100 - scores.pct) / 100
    const lossValue = estimatedLoss ? Math.round(estimatedLoss * impactWeight * 0.6) : null
    return {
      area,
      label: DIAGNOSTIC_AREAS[area],
      pct: scores.pct,
      lossValue,
    }
  })

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/diagnostico/${id}/relatorio`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
              Etapa 1
            </Badge>
            {quadrant && (
              <Badge variant="secondary" className="text-[10px]" style={{ color: quadrant.color }}>
                {quadrant.label}
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Parecer Final da VAMO IA</h2>
          <p className="text-sm text-muted-foreground">{session.respondent_name}</p>
        </div>
      </div>

      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <HeartPulse className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-500">Antes de lançar missões, valide a saúde da equipe</p>
              <p className="text-xs text-muted-foreground mt-1">
                O diagnóstico comercial aponta gargalos de performance, mas risco de burnout precisa vir dos check-ins e da tela de saúde da equipe.
              </p>
              <Link href="/saude-equipe">
                <Button variant="outline" size="sm" className="mt-2 text-xs h-7">
                  Verificar Saúde da Equipe <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Total Estimated Loss */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-7 w-7 text-red-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-red-500/80">
                Perda Total Estimada
              </p>
              <p className="text-3xl font-bold text-red-500 mt-0.5">
                {estimatedLoss ? (
                  <>R$ {estimatedLoss.toLocaleString('pt-BR')}<span className="text-base font-normal">/mes</span></>
                ) : (
                  'Sem meta mensal'
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {estimatedLoss ? 'Baseado nos gargalos identificados no diagnostico' : 'Preencha a meta mensal no diagnóstico para calcular impacto financeiro'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Top Bottlenecks */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold">Gargalos Priorizados por Impacto Financeiro</h3>
        </div>
        <div className="space-y-3">
          {topBottlenecks.map((bottleneck, i) => (
            <Card key={bottleneck.area} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-red-500">#{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{bottleneck.label}</p>
                      <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30">
                        {bottleneck.lossValue ? `-R$ ${bottleneck.lossValue.toLocaleString('pt-BR')}/mes` : `${Math.round(bottleneck.pct)}%`}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={bottleneck.pct} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground">{bottleneck.pct}%</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 text-[11px] h-7" render={<Link href="/objetivos/plano-acao" />}>
                    <Target className="h-3 w-3 mr-1" />
                    Criar Missão
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Section 3: Roadmap 30/60/90 */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">Recomendacao Estruturada — Plano 30 / 60 / 90 dias</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline connector line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-500 via-amber-500 to-emerald-500 hidden sm:block" />

            <div className="space-y-6">
              {[
                { label: '30 dias', sublabel: 'Impacto imediato', items: roadmap.d30, color: 'red', icon: Zap },
                { label: '60 dias', sublabel: 'Desenvolvimento', items: roadmap.d60, color: 'amber', icon: TrendingDown },
                { label: '90 dias', sublabel: 'Transformacao', items: roadmap.d90, color: 'emerald', icon: Rocket },
              ].map((period) => (
                <div key={period.label} className="flex gap-4">
                  <div className={`relative z-10 h-8 w-8 rounded-full bg-${period.color}-500/10 border-2 border-${period.color}-500 flex items-center justify-center shrink-0 hidden sm:flex`}>
                    <period.icon className={`h-3.5 w-3.5 text-${period.color}-500`} />
                  </div>
                  <div className={`flex-1 rounded-lg border border-${period.color}-500/20 bg-${period.color}-500/5 p-4`}>
                    <p className={`text-sm font-semibold text-${period.color}-500`}>{period.label}</p>
                    <p className="text-[10px] text-muted-foreground mb-2">{period.sublabel}</p>
                    <ul className="space-y-1.5">
                      {period.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className={`mt-0.5 h-1.5 w-1.5 rounded-full bg-${period.color}-500 shrink-0`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {missionSuggestions.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-medium">Missões Recomendadas pelo Diagnóstico</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 border-0">
                Fonte: áreas com menor score
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {missionSuggestions.map((mission, i) => (
              <div
                key={mission.area}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-500/10 bg-background/60"
              >
                <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-amber-500">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{mission.title}</p>
                  <p className="text-[11px] text-muted-foreground">{mission.description}</p>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {mission.areaLabel}: {mission.scorePct}%
                </Badge>
                <Badge variant="secondary" className="text-[9px] shrink-0">
                  Impacto {mission.impact}
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" render={<Link href="/objetivos/plano-acao" />}>
                  Criar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 5 & 6: Actions */}
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        {/* PDF Export */}
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>

        {/* Advance to Stage 2 */}
        <Link href="/objetivos/metas" className="flex-1">
          <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
            Avancar para Etapa 2
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* CTA Card — Etapa 2 */}
      <Card className="border-emerald-500/30 bg-emerald-500/5 print:hidden">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Rocket className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-semibold">Pronto para definir metas e lancar missoes?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Na Etapa 2, voce define objetivos para empresa, time e individuo. Configure missoes com 1 clique.
              </p>
            </div>
            <Link href="/objetivos/metas">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0">
                Iniciar Etapa 2
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
