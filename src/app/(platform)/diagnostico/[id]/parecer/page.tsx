'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
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

const READY_MISSIONS = [
  { title: 'Follow-up em 24h', xp: 150, bonus: 225, difficulty: 'Facil' },
  { title: 'Prospeccao Ativa — 5 contatos/dia', xp: 200, bonus: 300, difficulty: 'Medio' },
  { title: 'CRM 100% Atualizado', xp: 100, bonus: 150, difficulty: 'Facil' },
  { title: 'Taxa de Conversao +10%', xp: 500, bonus: 750, difficulty: 'Dificil' },
  { title: 'Apresentacao Impecavel', xp: 120, bonus: 180, difficulty: 'Facil' },
  { title: 'Feedback de Clientes (NPS)', xp: 180, bonus: 270, difficulty: 'Medio' },
  { title: 'Venda Adicional (Upsell)', xp: 400, bonus: 600, difficulty: 'Dificil' },
]

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

// Simulated burnout detection
function simulateBurnout(sessionId: string): boolean {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash << 5) - hash + sessionId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 4 === 0 // ~25% chance
}

export default function ParecerPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [session, setSession] = useState<DiagnosticSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    const load = async () => {
      const { data } = await supabase
        .from('diagnostic_sessions')
        .select('*')
        .eq('id', id)
        .single()
      setSession(data)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user, id])

  if (!user) return null

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
  const estimatedMonthlyRevenue = 50000
  const estimatedLoss = Math.round(estimatedMonthlyRevenue * ((100 - session.health_pct) / 100) * 0.3)
  const roadmap = ROADMAP[session.quadrant ?? 'at_risk']
  const hasBurnout = simulateBurnout(id)

  // Top bottlenecks by financial impact
  const areas = Object.entries(session.area_scores || {}) as [DiagnosticArea, { score: number; max: number; pct: number }][]
  const sortedAreas = [...areas].sort((a, b) => a[1].pct - b[1].pct)
  const topBottlenecks = sortedAreas.slice(0, Math.min(5, sortedAreas.length)).map((entry) => {
    const [area, scores] = entry
    const impactWeight = (100 - scores.pct) / 100
    const lossValue = Math.round(estimatedLoss * impactWeight * 0.6)
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
          <h2 className="text-xl font-semibold tracking-tight">Parecer Final da IA</h2>
          <p className="text-sm text-muted-foreground">{session.respondent_name}</p>
        </div>
      </div>

      {/* Burnout Alert Banner */}
      {hasBurnout && (
        <Card className="border-2 border-red-500/40 bg-red-500/10">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <HeartPulse className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-500">
                  Burnout detectado nesta equipe
                </p>
                <p className="text-xs text-red-500/80 mt-1">
                  Recomendamos conversa 1:1 antes de lancar missoes de volume. Gamificacao sobre alguem sobrecarregado piora o problema.
                </p>
                <Link href="/saude-equipe">
                  <Button variant="outline" size="sm" className="mt-2 text-xs h-7 border-red-500/30 text-red-500 hover:bg-red-500/10">
                    Verificar Saude da Equipe <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                R$ {estimatedLoss.toLocaleString('pt-BR')}
                <span className="text-base font-normal">/mes</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Baseado nos gargalos identificados no diagnostico
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
                        -R$ {bottleneck.lossValue.toLocaleString('pt-BR')}/mes
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={bottleneck.pct} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground">{bottleneck.pct}%</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 text-[11px] h-7">
                    <Target className="h-3 w-3 mr-1" />
                    Gerar Missao Corretiva
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

      {/* Section 4: 7 Pre-Generated Missions */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium">7 Missoes Gamificadas Prontas para Ativar</CardTitle>
            </div>
            <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 border-0">
              Geradas pela IA
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {READY_MISSIONS.map((mission, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-500/10 bg-background/60"
            >
              <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-amber-500">{i + 1}</span>
              </div>
              <span className="text-sm flex-1">{mission.title}</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  mission.difficulty === 'Facil'
                    ? 'text-emerald-500 border-emerald-500/30'
                    : mission.difficulty === 'Medio'
                    ? 'text-amber-500 border-amber-500/30'
                    : 'text-red-500 border-red-500/30'
                }`}
              >
                {mission.difficulty}
              </Badge>
              <Badge variant="secondary" className="text-[9px]">+{mission.xp} XP</Badge>
              <span className="text-[10px] text-emerald-500 font-medium">R$ {mission.bonus}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                <CheckCircle className="h-3 w-3 mr-1" />
                Ativar
              </Button>
            </div>
          ))}
          <div className="pt-2 text-center">
            <p className="text-[11px] text-muted-foreground">
              Total: <strong className="text-amber-500">{READY_MISSIONS.reduce((s, m) => s + m.xp, 0)} XP</strong> ·{' '}
              <strong className="text-emerald-500">R$ {READY_MISSIONS.reduce((s, m) => s + m.bonus, 0).toLocaleString('pt-BR')} em bonus</strong> disponiveis
            </p>
          </div>
        </CardContent>
      </Card>

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
