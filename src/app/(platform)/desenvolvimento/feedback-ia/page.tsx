'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
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

const DISC_FEEDBACK: Record<string, { strengths: string[]; opportunities: string[]; insight: string; mission: string }> = {
  D: {
    strengths: [
      'Sua taxa de fechamento em primeira reuniao e 20% acima da media da equipe',
      'Alta capacidade de superar objecoes com firmeza e argumentos diretos',
      'Voce e referencia em velocidade de resposta e follow-up rapido',
    ],
    opportunities: [
      'Ticket medio abaixo do potencial — perfil D tende a ir direto ao preco sem construir valor suficiente',
      'Aprender a fazer perguntas consultivas antes de apresentar a solucao pode aumentar seu ticket em 15-20%',
    ],
    insight: 'A IA detectou que seu engajamento aumenta o resultado coletivo quando voce lidera desafios de time. Experimente as missoes coletivas.',
    mission: 'Missao sugerida: Liderar desafio de time de fechamento — bonus estimado: +R$ 800',
  },
  I: {
    strengths: [
      'Sua taxa de conversao em Primeira Reuniao e 20% acima da media da equipe',
      'Perfil Influenciador cria rapport rapidamente — voce conquista confianca do cliente em poucos minutos',
      'Voce tem o maior indice de indicacoes da equipe',
    ],
    opportunities: [
      'Ticket medio abaixo do potencial — perfil I tem alta capacidade para vendas consultivas de maior valor',
      'Identificar oportunidades de upsell pode aumentar seu ticket em 15-20%',
    ],
    insight: 'A IA detectou que seu engajamento sobe o engajamento medio coletivo quando voce esta ativo em missoes colaborativas.',
    mission: 'Missao sugerida: Campanha de indicacoes com clientes ativos — bonus estimado: +R$ 500',
  },
  S: {
    strengths: [
      'Voce tem a maior taxa de retencao de clientes da equipe',
      'Sua consistencia no CRM e a mais alta — dados sempre organizados e atualizados',
      'Clientes antigos confiam em voce para expansao — maior LTV medio',
    ],
    opportunities: [
      'Metas de volume alto podem gerar estresse — prefira metas de qualidade que se alinham ao seu estilo',
      'Prospeccao ativa (frio) e o ponto de desenvolvimento — seu ponto forte e relacionamento com clientes existentes',
    ],
    insight: 'A IA sugere missoes de upsell em clientes existentes — area onde seu perfil S tem 3x mais chances de sucesso.',
    mission: 'Missao sugerida: Upsell em base de clientes ativos — bonus estimado: +R$ 600',
  },
  C: {
    strengths: [
      'Sua taxa de conversao em propostas tecnicas e a mais alta da equipe',
      'Voce prepara as apresentacoes mais completas e bem fundamentadas',
      'Sua analise de dados antes de cada reuniao e um diferencial percebido pelos clientes',
    ],
    opportunities: [
      'Ciclo de vendas acima da media — perfil C tende a analisar demais antes de avancar',
      'Estabelecer criterios claros de quando avancar no funil pode reduzir seu ciclo em 25-30%',
    ],
    insight: 'A IA detectou que voce fecha mais quando tem acesso a dados e comparativos. Peca estudos de caso antes de cada proposta.',
    mission: 'Missao sugerida: Criar banco de estudos de caso — bonus estimado: +R$ 400',
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
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [discProfile, setDiscProfile] = useState<BehavioralProfile | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/ai/behavioral-profile')
        if (res.ok) {
          const data = await res.json()
          if (data.profile) setDiscProfile(data.profile)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }

    fetchProfile()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  // No profile — CTA
  if (!discProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Feedback da IA</h2>
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
                Complete a avaliacao DISC para receber feedback personalizado da IA sobre seus pontos fortes, oportunidades e missoes ideais.
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
          <h2 className="text-xl font-semibold tracking-tight">Feedback da IA</h2>
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
            Pontos Fortes Confirmados pelos Dados
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {feedback.strengths.map((s, i) => (
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
            {feedback.opportunities.map((o, i) => (
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
              <p className="text-xs font-semibold text-blue-600 mb-1">Insight Coletivo</p>
              <p className="text-xs text-muted-foreground">{feedback.insight}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Mission */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Missao Sugerida</p>
              <p className="text-xs text-muted-foreground mt-0.5">{feedback.mission}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
