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

const DISC_FEEDBACK: Record<string, { strengths: string[]; opportunities: string[]; insight: string; collectiveImpact: string; mission: string; missionBonus: number }> = {
  D: {
    strengths: [
      'Sua taxa de fechamento em 1a reuniao e 78% — 18pp acima da media da equipe (60%)',
      'Alta capacidade de superar objecoes: voce converte 3 de cada 4 objecoes, media da equipe e 2 de 4',
      'Velocidade de resposta: seu tempo medio de follow-up e 2h, media da equipe e 6h',
    ],
    opportunities: [
      'Ticket medio R$ 7.200 vs potencial de R$ 9.500 — perfil D tende a ir direto ao preco sem construir valor suficiente',
      'Perguntas consultivas antes de apresentar solucao podem aumentar ticket em 15-20% (~R$ 1.100/venda)',
    ],
    insight: 'A IA detectou que seu engajamento aumenta o resultado coletivo quando voce lidera desafios de time. Nas ultimas 3 missoes coletivas que voce participou, o time bateu a meta 2x mais rapido.',
    collectiveImpact: 'Quando voce completa missoes, o engajamento medio da equipe sobe 12%. Voce e uma referencia de ritmo para o time.',
    mission: 'Liderar desafio de time de fechamento',
    missionBonus: 800,
  },
  I: {
    strengths: [
      'Sua conversao em 1a reuniao e 78% — 18pp acima da media da equipe. Seu perfil I cria rapport rapidamente',
      'Maior indice de indicacoes da equipe: 8 indicacoes/mes vs media de 3',
      'NPS dos seus clientes: 92 vs media da equipe de 78',
    ],
    opportunities: [
      'Ticket medio R$ 6.800 vs potencial de R$ 9.500 — perfil I tem alta capacidade para vendas consultivas de maior valor',
      'Identificar oportunidades de upsell pode aumentar ticket em 15-20% (~R$ 1.300/venda)',
    ],
    insight: 'A IA detectou que seu engajamento sobe o engajamento medio coletivo quando voce esta ativo em missoes colaborativas. O time performa 15% melhor nos meses em que voce participa de desafios coletivos.',
    collectiveImpact: 'Suas indicacoes geraram R$ 24.000 em pipeline para o time nos ultimos 60 dias. Voce e o maior conector da equipe.',
    mission: 'Campanha de indicacoes com clientes ativos',
    missionBonus: 500,
  },
  S: {
    strengths: [
      'Maior taxa de retencao de clientes da equipe: 94% vs media de 82%',
      'Consistencia no CRM: 95% atualizado vs media de 68% — dados sempre organizados',
      'Maior LTV medio: R$ 18.500/cliente vs media de R$ 12.000',
    ],
    opportunities: [
      'Metas de volume alto podem gerar estresse — prefira metas de qualidade que se alinham ao seu perfil S',
      'Prospeccao ativa (frio) e o ponto de desenvolvimento — taxa de conversao em cold calls 12% vs 22% do time',
    ],
    insight: 'A IA sugere missoes de upsell em clientes existentes — area onde seu perfil S tem 3x mais chances de sucesso do que prospeccao fria.',
    collectiveImpact: 'Sua retencao de clientes economiza R$ 8.000/mes para a empresa em custo de reposicao. Voce estabiliza a receita recorrente do time.',
    mission: 'Upsell em base de clientes ativos',
    missionBonus: 600,
  },
  C: {
    strengths: [
      'Taxa de conversao em propostas tecnicas: 68% — a mais alta da equipe (media 45%)',
      'Apresentacoes mais completas: taxa de aceite pos-proposta 72% vs 55% da media',
      'Analise pre-reuniao: seus clientes reportam 90% de satisfacao com preparacao tecnica',
    ],
    opportunities: [
      'Ciclo de vendas 42 dias vs media de 28 — perfil C tende a analisar demais antes de avancar',
      'Estabelecer criterios claros de quando avancar pode reduzir ciclo em 25-30% (10-12 dias)',
    ],
    insight: 'A IA detectou que voce fecha mais quando tem acesso a dados e comparativos. Suas conversoes sobem 35% quando voce usa estudos de caso.',
    collectiveImpact: 'Suas propostas detalhadas elevam a qualidade media das propostas do time. Colegas que usam seus templates convertem 20% mais.',
    mission: 'Criar banco de estudos de caso',
    missionBonus: 400,
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
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
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

      {/* Collective Impact */}
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-600 mb-1">Seu Impacto no Time</p>
              <p className="text-xs text-muted-foreground">{feedback.collectiveImpact}</p>
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
                {feedback.mission} — bonus estimado: <strong className="text-emerald-500">+R$ {feedback.missionBonus}</strong>
              </p>
              <Button size="sm" className="h-7 text-xs mt-2 gap-1.5" render={<Link href="/performance/missoes" />}>
                <Sparkles className="h-3 w-3" />
                Aceitar Missao
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
