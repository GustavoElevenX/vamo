'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { getCached, setCache } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import type { BehavioralProfile } from '@/types'

const DISC_FEEDBACK: Record<string, { strengths: string[]; opportunities: string[]; insight: string; collectiveImpact: string; mission: string }> = {
  D: {
    strengths: [
      'Tende a agir rápido, assumir responsabilidade e buscar resultado direto.',
      'Costuma lidar bem com metas claras, pressão e negociação objetiva.',
      'Pode ser uma boa referência para missões que exigem ritmo e tomada de decisão.',
    ],
    opportunities: [
      'Antes de apresentar preço, valide dor, impacto financeiro e critério de decisão.',
      'Use perguntas consultivas para não acelerar uma venda sem construir valor suficiente.',
    ],
    insight: 'Com base no perfil DISC, missões de fechamento, priorização e decisão tendem a gerar mais aderência para este perfil.',
    collectiveImpact: 'Pode ajudar o time quando assume metas claras e compartilha critérios objetivos de avanço.',
    mission: 'Liderar desafio de time de fechamento',
  },
  I: {
    strengths: [
      'Tende a criar conexão com facilidade e manter conversas comerciais mais leves.',
      'Costuma ter força em relacionamento, indicação e abertura de portas.',
      'Pode contribuir em missões que dependem de rapport e influência positiva.',
    ],
    opportunities: [
      'Estruture próximos passos para não perder oportunidades por falta de follow-up.',
      'Formalize critérios de compra depois de criar conexão com o cliente.',
    ],
    insight: 'Com base no perfil DISC, missões de indicação, relacionamento e reativação de clientes tendem a ter melhor encaixe.',
    collectiveImpact: 'Pode fortalecer o time compartilhando abordagens, mensagens e boas práticas de conexão.',
    mission: 'Campanha de indicacoes com clientes ativos',
  },
  S: {
    strengths: [
      'Tende a ser consistente, confiável e cuidadoso no relacionamento com clientes.',
      'Costuma performar melhor em rotinas com clareza, previsibilidade e acompanhamento.',
      'Pode sustentar missões de qualidade, retenção e cadência de relacionamento.',
    ],
    opportunities: [
      'Evite metas de volume sem contexto; combine cadência realista com critérios de qualidade.',
      'Trabalhe scripts simples para prospecção ativa sem perder o estilo consultivo.',
    ],
    insight: 'Com base no perfil DISC, missões com clientes ativos, retenção e expansão consultiva tendem a ter melhor encaixe.',
    collectiveImpact: 'Pode estabilizar o time quando ajuda a manter processos, cadência e qualidade no atendimento.',
    mission: 'Upsell em base de clientes ativos',
  },
  C: {
    strengths: [
      'Tende a se preparar bem, analisar detalhes e construir argumentos consistentes.',
      'Costuma ter força em propostas, diagnóstico técnico e comparação de opções.',
      'Pode contribuir em missões que exigem precisão, documentação e padrão de qualidade.',
    ],
    opportunities: [
      'Defina critérios objetivos para avançar sem alongar demais o ciclo comercial.',
      'Use checklists para decidir quando a análise está suficiente para propor o próximo passo.',
    ],
    insight: 'Com base no perfil DISC, missões de proposta, estudo de caso e melhoria de processo tendem a ter melhor encaixe.',
    collectiveImpact: 'Pode elevar a qualidade do time quando transforma boas análises em templates e checklists reutilizáveis.',
    mission: 'Criar banco de estudos de caso',
  },
}

const DISC_COLORS: Record<string, string> = {
  D: 'bg-red-500',
  I: 'bg-yellow-500',
  S: 'bg-green-500',
  C: 'bg-blue-500',
}

const DISC_NAMES: Record<string, string> = {
  D: 'Dominancia',
  I: 'Influencia',
  S: 'Estabilidade',
  C: 'Conformidade',
}

export default function FeedbackIAPage() {
  const { user } = useRequiredAuth()
  const cachedProfile = useRef(getCached<BehavioralProfile>('disc-profile'))
  const [loading, setLoading] = useState(!cachedProfile.current)
  const [discProfile, setDiscProfile] = useState<BehavioralProfile | null>(cachedProfile.current)

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/ai/behavioral-profile', { signal: controller.signal })
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setDiscProfile(data.profile)
            setCache('disc-profile', data.profile, 10 * 60 * 1000)
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
      }
      setLoading(false)
    }

    fetchProfile().catch(() => setLoading(false)).finally(() => clearTimeout(timeout))

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [user])


  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  // No profile — CTA
  if (!discProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Feedback da VAMO IA</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Insights personalizados baseados no seu perfil DISC</p>
        </div>

        <Card className="border-border/50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                <Brain className="h-7 w-7 text-blue-500" />
              </div>
              <h3 className="text-base font-semibold">Descubra seu perfil comportamental</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Complete a avaliacao DISC para receber feedback personalizado da VAMO IA sobre seus pontos fortes, oportunidades e missoes ideais.
              </p>
              <Link href="/perfil-comportamental">
                <Button className="mt-4 text-xs">
                  Fazer avaliacao DISC <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const feedback = DISC_FEEDBACK[discProfile.dominant_profile] ?? DISC_FEEDBACK['I']
  const strengths = discProfile.selling_strengths?.length ? discProfile.selling_strengths : feedback.strengths
  const opportunities = discProfile.development_areas?.length ? discProfile.development_areas : feedback.opportunities
  const performanceInsight = discProfile.performance_insight || feedback.insight
  const wellbeingInsight = discProfile.wellbeing_insight || feedback.collectiveImpact
  const scores: Record<string, number> = {
    D: discProfile.scores?.D ?? 0,
    I: discProfile.scores?.I ?? 0,
    S: discProfile.scores?.S ?? 0,
    C: discProfile.scores?.C ?? 0,
  }
  const maxScore = Math.max(...Object.values(scores), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Feedback da VAMO IA</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Insights personalizados baseados nos seus dados</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Perfil {discProfile.dominant_profile} · {discProfile.profile_name}
        </Badge>
      </div>

      {/* DISC Bars */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Perfil DISC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {['D', 'I', 'S', 'C'].map((key) => {
            const pct = Math.round((scores[key] / maxScore) * 100)
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">
                    {key} — {DISC_NAMES[key]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{scores[key]}</span>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${DISC_COLORS[key]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Strengths */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardHeader className="pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
            Pontos fortes do perfil
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Opportunities */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader className="pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
            Oportunidades de Desenvolvimento
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {opportunities.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                {o}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Collective Insight */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-600 mb-1">Insight de performance</p>
              <p className="text-xs text-muted-foreground">{performanceInsight}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collective Impact */}
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-600 mb-1">Ritmo e bem-estar</p>
              <p className="text-xs text-muted-foreground">{wellbeingInsight}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Mission with Accept Button */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Missao Sugerida</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {feedback.mission}. A recompensa deve ser definida no plano de ação conforme meta, dificuldade e retorno esperado.
              </p>
              <Button size="sm" className="h-7 text-xs mt-2 gap-1.5" render={<Link href="/objetivos/plano-acao" />}>
                <Sparkles className="h-3 w-3" />
                Criar Missão
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
