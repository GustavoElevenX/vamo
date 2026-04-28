'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft, Sparkles, AlertTriangle, CheckCircle, TrendingDown, DollarSign, FileText,
  Rocket, Brain, Target, Users, ArrowRight, HeartPulse, TrendingUp, Calendar, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { DIAGNOSTIC_AREAS, DIAGNOSTIC_QUADRANTS } from '@/lib/constants'
import { AIAnalysisCard, AIActionsCard } from '@/components/ai/ai-analysis-card'
import { AILoadingSkeleton } from '@/components/ai/loading-skeleton'
import type { DiagnosticSession, DiagnosticArea, AIAnalysisResult } from '@/types'

const MISSION_TEMPLATES: Record<DiagnosticArea, { title: string; description: string; impact: 'alto' | 'medio' | 'baixo' }> = {
  lead_generation: {
    title: 'Aumentar volume de leads qualificados',
    description: 'Criar uma rotina de prospecção com meta diária e revisão semanal de qualidade dos leads.',
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

// Roadmap 30/60/90 by quadrant
const ROADMAP: Record<string, { d30: string[]; d60: string[]; d90: string[] }> = {
  critical: {
    d30: ['Estabilizar o processo de vendas com missões corretivas', 'Convocar reunião 1:1 com todo o time', 'Mapear os 2 maiores gargalos financeiros'],
    d60: ['Lançar missões gamificadas focadas em conversão e follow-up', 'Implementar script de proposta e follow-up padronizado', 'Revisão semanal de pipeline com todo o time'],
    d90: ['Medir ROI das intervenções vs. perda inicial identificada', 'Definir metas individuais para o próximo ciclo', 'Iniciar programa de desenvolvimento comportamental'],
  },
  at_risk: {
    d30: ['Priorizar correção dos 3 principais gargalos identificados', 'Lançar missões de atividade intensa com recompensa imediata', 'Avaliar engajamento e identificar riscos de burnout'],
    d60: ['Missões em sequência de dificuldade crescente (nível 1→2→3)', 'Implementar reconhecimento público semanal', 'Automatizar cálculo de comissão para transparência'],
    d90: ['Revisão completa das metas com base nos resultados das missões', 'Expandir gamificação para missões coletivas', 'Calcular ROI da plataforma e apresentar ao time'],
  },
  developing: {
    d30: ['Escalar o que já funciona bem no processo', 'Criar desafios progressivos para manter engajamento', 'Missões de upsell e ticket médio para vendedores top'],
    d60: ['Lançar missões coletivas para fortalecer cultura de equipe', 'Implementar programa de mentoria interna', 'Revisar comissionamento para incluir bônus de qualidade'],
    d90: ['Documentar e replicar as melhores práticas identificadas', 'Expandir para novos KPIs e métricas avançadas', 'Definir metas de Temporada de Alta Performance (90 dias)'],
  },
  optimized: {
    d30: ['Manter ritmo e engajamento com novas missões desafiadoras', 'Identificar próximos níveis de crescimento', 'Introduzir missões de liderança para vendedores sênior'],
    d60: ['Criar programa de embaixadores internos', 'Explorar novos mercados e segmentos com a equipe', 'Implementar coaching peer-to-peer entre vendedores'],
    d90: ['Medir impacto da gamificação no churn de vendedores', 'Expandir modelo para outros times da empresa', 'Documentar case de sucesso para uso em vendas'],
  },
}

export default function RelatorioPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useRequiredAuth()
  const router = useRouter()

  const [session, setSession] = useState<DiagnosticSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const generateAnalysis = async (signal?: AbortSignal) => {
    setAiLoading(true)
    setAiError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)
    try {
      const res = await fetch('/api/ai/diagnostic-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
        signal: signal ?? controller.signal,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar análise')
      }
      const data = await res.json()
      setAiAnalysis(data.analysis)
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        setAiError(error.message)
      }
    } finally {
      clearTimeout(timeout)
      setAiLoading(false)
    }
  }

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
      if (cancelled) return
      setSession(data)
      setLoading(false)
      if (data?.status === 'completed') {
        generateAnalysis()
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
        <h2 className="text-2xl font-bold">Relatório não encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/diagnostico')}>Voltar</Button>
      </div>
    )
  }

  const quadrant = session.quadrant ? DIAGNOSTIC_QUADRANTS[session.quadrant] : null
  const areas = Object.entries(session.area_scores || {}) as [DiagnosticArea, { score: number; max: number; pct: number }][]

  const estimatedMonthlyRevenue = parseMonthlyGoal((session.company_context as Record<string, unknown> | null)?.meta_mensal)
  const estimatedLoss = estimatedMonthlyRevenue
    ? Math.round(estimatedMonthlyRevenue * ((100 - session.health_pct) / 100) * 0.3)
    : null
  const recoveryPotential = estimatedLoss ? Math.round(estimatedLoss * 0.65) : null
  const roadmap = ROADMAP[session.quadrant ?? 'at_risk']
  const missionSuggestions = getMissionSuggestions(session)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/diagnostico')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">Etapa 1 · Parecer Final</Badge>
            {quadrant && (
              <Badge variant="secondary" className="text-[10px]" style={{ color: quadrant.color }}>
                {quadrant.label}
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Relatório de Diagnóstico</h2>
          <p className="text-sm text-muted-foreground">{session.respondent_name}</p>
        </div>
        <Button variant="outline" size="sm" render={<Link href={`/diagnostico/${id}/parecer`} />} className="ml-auto">
          <Brain className="mr-2 h-4 w-4" />
          Parecer final da IA
        </Button>
      </div>

      {/* ── MOMENTO UAU — Financial Impact ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-red-500/80">Perda Estimada</p>
                <p className="text-2xl font-bold text-red-500 mt-0.5">
                  {estimatedLoss ? (
                    <>R$ {estimatedLoss.toLocaleString('pt-BR')}<span className="text-sm font-normal">/mês</span></>
                  ) : (
                    'Sem meta mensal'
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {estimatedLoss ? 'nos gargalos identificados' : 'preencha a meta mensal no diagnóstico'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">Potencial de Recuperação</p>
                <p className="text-2xl font-bold text-emerald-500 mt-0.5">
                  {recoveryPotential ? (
                    <>R$ {recoveryPotential.toLocaleString('pt-BR')}<span className="text-sm font-normal">/mês</span></>
                  ) : (
                    'A calcular'
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">com plano gamificado em 90 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Geral */}
      <Card className="border-border/50">
        <CardContent className="pt-5">
          <div className="flex items-center gap-6">
            <div className="relative flex h-24 w-24 items-center justify-center shrink-0">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" className="text-muted" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={quadrant?.color ?? '#6b7280'}
                  strokeWidth="10"
                  strokeDasharray={`${(session.health_pct / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-xl font-bold">{session.health_pct}%</span>
            </div>
            <div>
              {quadrant && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: quadrant.color }} />
                  <span className="text-lg font-bold">{quadrant.label}</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">
                {session.total_score} / {session.max_score} pontos
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(session.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leitura real por área */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Áreas do Diagnóstico — prioridade de ação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {areas
            .sort(([, a], [, b]) => a.pct - b.pct)
            .map(([area, scores]) => (
            <div key={area}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{DIAGNOSTIC_AREAS[area]}</span>
                <span className={scores.pct < 50 ? 'text-xs font-medium text-red-500' : 'text-xs font-medium text-emerald-500'}>
                  {Math.round(scores.pct)}%
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`absolute inset-0 rounded-full transition-all ${
                    scores.pct < 50 ? 'bg-red-400' : scores.pct < 75 ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${scores.pct}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 pt-1 text-[10px] text-muted-foreground">
            <span>Fonte: respostas do diagnóstico concluído em {new Date(session.completed_at ?? session.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Parecer Final VAMO IA */}
      <Card className={`border-2 ${
        session.health_pct >= 75 ? 'border-emerald-500/40 bg-emerald-500/5' :
        session.health_pct >= 50 ? 'border-blue-500/40 bg-blue-500/5' :
        session.health_pct >= 25 ? 'border-amber-500/40 bg-amber-500/5' :
        'border-red-500/40 bg-red-500/5'
      }`}>
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              session.health_pct >= 50 ? 'bg-emerald-500/10' : 'bg-red-500/10'
            }`}>
              <Brain className={`h-5 w-5 ${session.health_pct >= 50 ? 'text-emerald-500' : 'text-red-500'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold">Parecer da VAMO IA — Recomendação para 90 dias</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {session.health_pct >= 75
                  ? `O time de ${session.respondent_name} está em boa forma. O principal foco dos próximos 90 dias deve ser escalar o que já funciona bem e criar desafios progressivos para manter o engajamento.`
                  : session.health_pct >= 50
                  ? `O time de ${session.respondent_name} tem base sólida mas gargalos claros no funil. Nos próximos 90 dias, missões focadas em conversão e follow-up têm o maior potencial de retorno financeiro.`
                  : session.health_pct >= 25
                  ? `${session.respondent_name} enfrenta perdas financeiras significativas. Prioridade imediata: estabilizar o processo de vendas com missões corretivas e acompanhamento semanal da equipe.`
                  : `Situação crítica detectada em ${session.respondent_name}. Ação urgente necessária: intervenção direta nos 3 principais gargalos antes de qualquer expansão.`}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="text-[10px]">
                  <Target className="h-2.5 w-2.5 mr-1" />
                  {missionSuggestions.length} ações priorizadas
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  <Users className="h-2.5 w-2.5 mr-1" />
                  Plano individual disponível
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown por Área */}
      <div className="grid gap-4 md:grid-cols-2">
        {areas.map(([area, scores]) => {
          const areaLabel = DIAGNOSTIC_AREAS[area]
          const areaQuadrant = scores.pct >= 75 ? 'optimized' : scores.pct >= 50 ? 'developing' : scores.pct >= 25 ? 'at_risk' : 'critical'
          const areaColor = DIAGNOSTIC_QUADRANTS[areaQuadrant].color

          return (
            <Card key={area} className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{areaLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold" style={{ color: areaColor }}>
                      {scores.pct}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {scores.score}/{scores.max}
                    </span>
                  </div>
                  <Progress value={scores.pct} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Roadmap 30/60/90 */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">Recomendação de Foco — Plano 30 / 60 / 90 dias</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: '30 dias', sublabel: 'Impacto rápido', items: roadmap.d30, color: 'red' },
              { label: '60 dias', sublabel: 'Desenvolvimento de hábito', items: roadmap.d60, color: 'amber' },
              { label: '90 dias', sublabel: 'Transformação de performance', items: roadmap.d90, color: 'emerald' },
            ].map((period) => (
              <div key={period.label} className={`rounded-lg border border-${period.color}-500/20 bg-${period.color}-500/5 p-3`}>
                <p className={`text-xs font-semibold text-${period.color}-500 mb-0.5`}>{period.label}</p>
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
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis — auto-loaded */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Análise Aprofundada da VAMO IA
          </h3>
          {aiError && (
            <Button size="sm" variant="outline" onClick={() => generateAnalysis()}>
              Tentar novamente
            </Button>
          )}
        </div>

        {aiLoading && <AILoadingSkeleton />}

        {aiError && (
          <Card className="border-destructive/30">
            <CardContent className="pt-4 text-center text-sm text-muted-foreground">
              {aiError}
            </CardContent>
          </Card>
        )}

        {aiAnalysis && (
          <>
            {aiAnalysis.executive_summary && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Resumo Executivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{aiAnalysis.executive_summary}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <AIAnalysisCard
                title="Gargalos Identificados"
                items={aiAnalysis.bottlenecks}
                icon={AlertTriangle}
                variant="danger"
              />
              <AIAnalysisCard
                title="Pontos Fortes"
                items={aiAnalysis.strengths}
                icon={CheckCircle}
                variant="success"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AIAnalysisCard
                title="Áreas de Melhoria"
                items={aiAnalysis.weaknesses}
                icon={TrendingDown}
                variant="warning"
              />
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="h-4 w-4 text-purple-500" />
                    Impacto Financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{aiAnalysis.financial_implications}</p>
                </CardContent>
              </Card>
            </div>

            <AIActionsCard actions={aiAnalysis.priority_actions} />
          </>
        )}
      </div>

      {missionSuggestions.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-medium">Ações para Transformar em Missões</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 border-0">
                Fonte: diagnóstico
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
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-2 text-xs" render={<Link href="/objetivos/plano-acao" />}>
              Criar missões no plano de ação <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Alerta de burnout */}
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <HeartPulse className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-500">Antes de lançar — verifique a equipe</p>
              <p className="text-xs text-muted-foreground mt-1">
                Acesse <strong>Saúde da Equipe</strong> e confirme que nenhum vendedor está em risco de burnout.
                Gamificação de volume sobre alguém sobrecarregado piora o problema — converse individualmente primeiro.
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

      {/* CTA — Etapa 2 */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Rocket className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-semibold">Pronto para iniciar a Etapa 2?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina objetivos para empresa, time e indivíduo. Configure missões com 1 clique e lance a gamificação.
              </p>
            </div>
            <Link href="/objetivos">
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
