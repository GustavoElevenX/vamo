'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Brain,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  RefreshCw,
  Sparkles,
  HeartPulse,
  Target,
  Zap,
} from 'lucide-react'
import { BehavioralChart } from '@/components/ai/behavioral-chart'
import { AILoadingSkeleton } from '@/components/ai/loading-skeleton'
import type { BehavioralProfile, BehavioralAnswer, BehavioralQuestion } from '@/types'

// ──────────────────────────────────────────────────────────────
// 24 Questions · 6 Dimensions · 4 questions each
// D = Dominância, I = Influência, S = Estabilidade, C = Conformidade
// E = Engajamento/Bem-estar, A = Autoavaliação de Performance
// ──────────────────────────────────────────────────────────────

const DISC_QUESTIONS: BehavioralQuestion[] = [
  // ── D · Dominância ──────────────────────────────────────────
  {
    id: 1, dimension: 'D',
    question: 'Em uma reunião de vendas, você geralmente...',
    options: [
      { label: 'Vai direto ao ponto e propõe soluções', trait: 'D' },
      { label: 'Cria um ambiente descontraído e conversa bastante', trait: 'I' },
      { label: 'Ouve atentamente e busca entender as necessidades', trait: 'S' },
      { label: 'Apresenta dados e fatos detalhados', trait: 'C' },
    ],
  },
  {
    id: 2, dimension: 'D',
    question: 'Quando enfrenta uma objeção do cliente, você...',
    options: [
      { label: 'Encara como um desafio e argumenta com firmeza', trait: 'D' },
      { label: 'Usa humor e empatia para contornar', trait: 'I' },
      { label: 'Busca encontrar um meio-termo que satisfaça ambos', trait: 'S' },
      { label: 'Responde com dados e evidências concretas', trait: 'C' },
    ],
  },
  {
    id: 3, dimension: 'D',
    question: 'Diante de uma mudança no processo de vendas, você...',
    options: [
      { label: 'Abraça a mudança e lidera a implementação', trait: 'D' },
      { label: 'Vê como uma oportunidade e motiva os colegas', trait: 'I' },
      { label: 'Prefere entender bem antes de mudar', trait: 'S' },
      { label: 'Analisa os prós e contras antes de aceitar', trait: 'C' },
    ],
  },
  {
    id: 4, dimension: 'D',
    question: 'Como você lida com prazos apertados?',
    options: [
      { label: 'Assume o controle e faz acontecer', trait: 'D' },
      { label: 'Engaja a equipe para colaborar e ajudar', trait: 'I' },
      { label: 'Organiza-se metodicamente e mantém a calma', trait: 'S' },
      { label: 'Planeja cada passo e segue o cronograma rigorosamente', trait: 'C' },
    ],
  },

  // ── I · Influência ───────────────────────────────────────────
  {
    id: 5, dimension: 'I',
    question: 'O que mais te motiva no trabalho?',
    options: [
      { label: 'Atingir e superar metas desafiadoras', trait: 'D' },
      { label: 'Reconhecimento e interação com a equipe', trait: 'I' },
      { label: 'Estabilidade e um bom ambiente de trabalho', trait: 'S' },
      { label: 'Fazer um trabalho de alta qualidade e precisão', trait: 'C' },
    ],
  },
  {
    id: 6, dimension: 'I',
    question: 'No follow-up com clientes, você prefere...',
    options: [
      { label: 'Ser rápido e objetivo, focando no fechamento', trait: 'D' },
      { label: 'Manter contato frequente e construir relacionamento', trait: 'I' },
      { label: 'Ser consistente e confiável, cumprindo promessas', trait: 'S' },
      { label: 'Enviar informações detalhadas e personalizadas', trait: 'C' },
    ],
  },
  {
    id: 7, dimension: 'I',
    question: 'Ao apresentar uma proposta comercial, você foca em...',
    options: [
      { label: 'Resultados e ROI que o cliente terá', trait: 'D' },
      { label: 'Benefícios e como vai melhorar a vida do cliente', trait: 'I' },
      { label: 'Confiança e suporte contínuo que oferece', trait: 'S' },
      { label: 'Especificações técnicas e comparativos', trait: 'C' },
    ],
  },
  {
    id: 8, dimension: 'I',
    question: 'Em uma situação de competição com colegas, você...',
    options: [
      { label: 'Quer vencer a qualquer custo', trait: 'D' },
      { label: 'Compete de forma divertida e celebra com todos', trait: 'I' },
      { label: 'Prefere colaborar do que competir', trait: 'S' },
      { label: 'Foca em melhorar seu próprio desempenho', trait: 'C' },
    ],
  },

  // ── S · Estabilidade ─────────────────────────────────────────
  {
    id: 9, dimension: 'S',
    question: 'Quando você comete um erro em uma negociação...',
    options: [
      { label: 'Resolve rapidamente e segue em frente', trait: 'D' },
      { label: 'Conversa abertamente e usa para fortalecer o relacionamento', trait: 'I' },
      { label: 'Pede desculpas sinceramente e se compromete a melhorar', trait: 'S' },
      { label: 'Analisa o que deu errado para nunca repetir', trait: 'C' },
    ],
  },
  {
    id: 10, dimension: 'S',
    question: 'Seu estilo de comunicação por e-mail/mensagem é...',
    options: [
      { label: 'Curto e direto ao ponto', trait: 'D' },
      { label: 'Amigável com tom pessoal e empático', trait: 'I' },
      { label: 'Gentil, educado e bem estruturado', trait: 'S' },
      { label: 'Detalhado com todas as informações necessárias', trait: 'C' },
    ],
  },
  {
    id: 11, dimension: 'S',
    question: 'No final de um dia difícil de vendas, você...',
    options: [
      { label: 'Já está planejando a estratégia do dia seguinte', trait: 'D' },
      { label: 'Liga para um colega para desabafar e rir', trait: 'I' },
      { label: 'Reflete calmamente sobre o que aconteceu', trait: 'S' },
      { label: 'Revisa seus números e identifica padrões', trait: 'C' },
    ],
  },
  {
    id: 12, dimension: 'S',
    question: 'Na relação com seu gestor, você prefere...',
    options: [
      { label: 'Autonomia total para atingir resultados do seu jeito', trait: 'D' },
      { label: 'Feedback frequente e reconhecimento público', trait: 'I' },
      { label: 'Suporte constante e clareza sobre as expectativas', trait: 'S' },
      { label: 'Critérios objetivos e avaliação baseada em dados', trait: 'C' },
    ],
  },

  // ── C · Conformidade ─────────────────────────────────────────
  {
    id: 13, dimension: 'C',
    question: 'Qual ferramenta de vendas é mais importante para você?',
    options: [
      { label: 'Dashboard de resultados e metas', trait: 'D' },
      { label: 'Chat e comunicação com a equipe', trait: 'I' },
      { label: 'CRM para organizar contatos e histórico', trait: 'S' },
      { label: 'Planilhas e relatórios analíticos', trait: 'C' },
    ],
  },
  {
    id: 14, dimension: 'C',
    question: 'Antes de fechar uma venda, você costuma...',
    options: [
      { label: 'Agir rápido para não perder a oportunidade', trait: 'D' },
      { label: 'Criar uma conexão emocional forte com o cliente', trait: 'I' },
      { label: 'Confirmar que o cliente está confortável com tudo', trait: 'S' },
      { label: 'Revisar todos os detalhes do contrato com cuidado', trait: 'C' },
    ],
  },
  {
    id: 15, dimension: 'C',
    question: 'Quando recebe uma meta nova, sua primeira reação é...',
    options: [
      { label: 'Aceitar o desafio e já traçar um plano de ação', trait: 'D' },
      { label: 'Compartilhar com a equipe e criar entusiasmo coletivo', trait: 'I' },
      { label: 'Entender bem o contexto antes de se comprometer', trait: 'S' },
      { label: 'Calcular se a meta é realista com os dados disponíveis', trait: 'C' },
    ],
  },
  {
    id: 16, dimension: 'C',
    question: 'Ao identificar uma falha no processo comercial, você...',
    options: [
      { label: 'Toma uma decisão imediata e implementa a correção', trait: 'D' },
      { label: 'Reúne a equipe para ouvir opiniões e decidir juntos', trait: 'I' },
      { label: 'Sugere a mudança de forma gradual e cuidadosa', trait: 'S' },
      { label: 'Documenta o problema e propõe uma solução estruturada', trait: 'C' },
    ],
  },

  // ── E · Engajamento & Bem-estar ───────────────────────────────
  {
    id: 17, dimension: 'E',
    question: 'Como está seu nível de energia ao começar a semana de trabalho?',
    options: [
      { label: 'Alto — fico animado(a) com novos desafios', trait: 'E', score: 4 },
      { label: 'Bom — estou focado(a) e pronto(a) para agir', trait: 'E', score: 3 },
      { label: 'Médio — depende dos resultados recentes', trait: 'E', score: 2 },
      { label: 'Baixo — tenho sentido cansaço acumulado', trait: 'E', score: 1 },
    ],
  },
  {
    id: 18, dimension: 'E',
    question: 'Você sente que seu trabalho tem propósito e significado?',
    options: [
      { label: 'Sim, claramente — isso me impulsiona todo dia', trait: 'E', score: 4 },
      { label: 'Na maioria das vezes — tenho dias melhores e piores', trait: 'E', score: 3 },
      { label: 'Às vezes — ainda estou buscando esse alinhamento', trait: 'E', score: 2 },
      { label: 'Raramente — sinto desconexão com os objetivos', trait: 'E', score: 1 },
    ],
  },
  {
    id: 19, dimension: 'E',
    question: 'Como você descreveria seu equilíbrio entre trabalho e vida pessoal?',
    options: [
      { label: 'Excelente — consigo separar bem os dois', trait: 'E', score: 4 },
      { label: 'Bom — pequenos ajustes seriam bem-vindos', trait: 'E', score: 3 },
      { label: 'Regular — o trabalho tem invadido o pessoal', trait: 'E', score: 2 },
      { label: 'Ruim — estou sobrecarregado(a) com frequência', trait: 'E', score: 1 },
    ],
  },
  {
    id: 20, dimension: 'E',
    question: 'Quando recebe feedback negativo, sua reação inicial é...',
    options: [
      { label: 'Receber bem e usar como combustível para melhorar', trait: 'E', score: 4 },
      { label: 'Refletir e tentar entender o que pode mudar', trait: 'E', score: 3 },
      { label: 'Sentir-se desmotivado(a) por um tempo, mas se recuperar', trait: 'E', score: 2 },
      { label: 'Ficar impactado(a) de forma mais prolongada', trait: 'E', score: 1 },
    ],
  },
  {
    id: 21, dimension: 'E',
    question: 'Você se sente reconhecido(a) pelo seu esforço e resultados?',
    options: [
      { label: 'Sim — minha contribuição é valorizada e celebrada', trait: 'E', score: 4 },
      { label: 'Em parte — poderia haver mais reconhecimento', trait: 'E', score: 3 },
      { label: 'Raramente — o reconhecimento é esporádico', trait: 'E', score: 2 },
      { label: 'Não — isso tem afetado minha motivação', trait: 'E', score: 1 },
    ],
  },
  {
    id: 22, dimension: 'E',
    question: 'Como está a qualidade das relações com sua equipe?',
    options: [
      { label: 'Ótima — colaboramos bem e nos apoiamos', trait: 'E', score: 4 },
      { label: 'Boa — há espaço para mais integração', trait: 'E', score: 3 },
      { label: 'Regular — existem tensões ocasionais', trait: 'E', score: 2 },
      { label: 'Difícil — há conflitos que impactam o trabalho', trait: 'E', score: 1 },
    ],
  },

  // ── A · Autoavaliação de Performance ─────────────────────────
  {
    id: 23, dimension: 'A',
    question: 'Como você avalia sua taxa de conversão nos últimos 30 dias?',
    options: [
      { label: 'Acima da meta — estou num momento excelente', trait: 'A', score: 4 },
      { label: 'Na meta — entregando o que foi combinado', trait: 'A', score: 3 },
      { label: 'Abaixo — identifico pontos de melhoria claros', trait: 'A', score: 2 },
      { label: 'Muito abaixo — preciso de apoio para reverter', trait: 'A', score: 1 },
    ],
  },
  {
    id: 24, dimension: 'A',
    question: 'Você acredita que domina bem as etapas do seu processo de vendas?',
    options: [
      { label: 'Sim — tenho clareza e executo com consistência', trait: 'A', score: 4 },
      { label: 'Em sua maioria — algumas etapas merecem atenção', trait: 'A', score: 3 },
      { label: 'Parcialmente — tenho dificuldades em etapas específicas', trait: 'A', score: 2 },
      { label: 'Não — ainda estou aprendendo o processo', trait: 'A', score: 1 },
    ],
  },
  {
    id: 25, dimension: 'A',
    question: 'Como você se sente em relação ao seu uso das ferramentas de vendas (CRM, etc.)?',
    options: [
      { label: 'Ótimo — uso de forma eficiente e consistente', trait: 'A', score: 4 },
      { label: 'Bom — uso regularmente com alguns gaps', trait: 'A', score: 3 },
      { label: 'Regular — poderia usar melhor as ferramentas', trait: 'A', score: 2 },
      { label: 'Fraco — tenho dificuldade com as ferramentas', trait: 'A', score: 1 },
    ],
  },
  {
    id: 26, dimension: 'A',
    question: 'Você consegue manter um pipeline saudável e bem qualificado?',
    options: [
      { label: 'Sim — meu funil tem volume e qualidade consistentes', trait: 'A', score: 4 },
      { label: 'Na maioria — às vezes falta volume ou qualidade', trait: 'A', score: 3 },
      { label: 'Raramente — meu pipeline oscila bastante', trait: 'A', score: 2 },
      { label: 'Não — este é um desafio constante para mim', trait: 'A', score: 1 },
    ],
  },
]

const TOTAL_Q = DISC_QUESTIONS.length // 26

const DIMENSION_INFO: Record<string, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  D: { label: 'Dominância', icon: <Zap className="h-4 w-4" />, color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', description: 'Direto, decisivo, competitivo' },
  I: { label: 'Influência', icon: <Sparkles className="h-4 w-4" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', description: 'Comunicativo, entusiasta, persuasivo' },
  S: { label: 'Estabilidade', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', description: 'Paciente, confiável, cooperativo' },
  C: { label: 'Conformidade', icon: <Brain className="h-4 w-4" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', description: 'Analítico, preciso, meticuloso' },
  E: { label: 'Engajamento', icon: <HeartPulse className="h-4 w-4" />, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', description: 'Bem-estar, motivação e equilíbrio' },
  A: { label: 'Autoavaliação', icon: <Target className="h-4 w-4" />, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300', description: 'Percepção de performance e domínio técnico' },
}

// Group questions into blocks of 4 for the progress indicator
const DIMENSION_ORDER = ['D', 'I', 'S', 'C', 'E', 'A'] as const
const Q_BY_DIMENSION: Record<string, BehavioralQuestion[]> = {}
DISC_QUESTIONS.forEach((q) => {
  if (!Q_BY_DIMENSION[q.dimension]) Q_BY_DIMENSION[q.dimension] = []
  Q_BY_DIMENSION[q.dimension].push(q)
})

export default function PerfilComportamentalPage() {
  const { user } = useAuth()
  const [step, setStep] = useState(0) // 0 = intro, 1..TOTAL_Q = questions, TOTAL_Q+1 = result
  const [answers, setAnswers] = useState<BehavioralAnswer[]>([])
  const [profile, setProfile] = useState<BehavioralProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/ai/behavioral-profile')
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setProfile(data.profile)
            setStep(TOTAL_Q + 1)
          }
        }
      } catch {
        // No existing profile, that's fine
      }
      setLoading(false)
    }
    loadProfile()
  }, [user])

  const handleSelectOption = (questionId: number, trait: BehavioralAnswer['selected_option']) => {
    setAnswers((prev) => {
      const filtered = prev.filter((a) => a.question_id !== questionId)
      return [...filtered, { question_id: questionId, selected_option: trait }]
    })
  }

  const handleSubmit = async () => {
    setAnalyzing(true)
    setError(null)
    setStep(TOTAL_Q + 1)

    try {
      const res = await fetch('/api/ai/behavioral-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao analisar perfil')
      }
      const data = await res.json()
      setProfile(data.profile)
    } catch (error: any) {
      setError(error.message)
      setStep(TOTAL_Q) // go back to last question
    } finally {
      setAnalyzing(false)
    }
  }

  const handleRetake = () => {
    setProfile(null)
    setAnswers([])
    setStep(0)
    setError(null)
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const currentQuestion = step >= 1 && step <= TOTAL_Q ? DISC_QUESTIONS[step - 1] : null
  const currentAnswer = currentQuestion ? answers.find((a) => a.question_id === currentQuestion.id) : null
  const progress = step === 0 ? 0 : Math.min((step / TOTAL_Q) * 100, 100)
  const currentDim = currentQuestion ? DIMENSION_INFO[currentQuestion.dimension] : null

  // ── Intro ────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Perfil Comportamental</h2>
          <p className="text-muted-foreground">Descubra seu estilo de vendas e bem-estar — 6 dimensões, {TOTAL_Q} perguntas</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <Brain className="h-12 w-12 text-primary" />
              <div className="max-w-lg space-y-2">
                <h3 className="text-lg font-semibold">Diagnóstico DISC Completo + Bem-estar</h3>
                <p className="text-sm text-muted-foreground">
                  Responda {TOTAL_Q} perguntas sobre seu estilo de trabalho, nível de engajamento e autoavaliação de performance.
                  A VAMO IA gerará um perfil personalizado com insights acionáveis para sua evolução comercial.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {DIMENSION_ORDER.map((dim) => (
                    <Badge key={dim} variant="secondary" className={DIMENSION_INFO[dim].color}>
                      {dim} · {DIMENSION_INFO[dim].label}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-left">
                  {DIMENSION_ORDER.map((dim) => (
                    <div key={dim} className="rounded-lg border border-border/50 p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{dim}</p>
                      <p className="text-xs font-medium mt-0.5">{DIMENSION_INFO[dim].label}</p>
                      <p className="text-[10px] text-muted-foreground">{DIMENSION_INFO[dim].description}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="mt-2" onClick={() => setStep(1)}>
                Iniciar Questionário
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Result ───────────────────────────────────────────────────
  if (step > TOTAL_Q) {
    if (analyzing) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Perfil Comportamental</h2>
          <Card>
            <CardContent className="pt-6">
              <AILoadingSkeleton />
            </CardContent>
          </Card>
        </div>
      )
    }

    if (profile) {
      // Compute E and A scores from answers
      const eAnswers = answers.filter((a) => {
        const q = DISC_QUESTIONS.find((q) => q.id === a.question_id)
        return q?.dimension === 'E'
      })
      const aAnswers = answers.filter((a) => {
        const q = DISC_QUESTIONS.find((q) => q.id === a.question_id)
        return q?.dimension === 'A'
      })
      const computeScore = (dimAnswers: BehavioralAnswer[], dim: 'E' | 'A') => {
        const total = dimAnswers.reduce((sum, a) => {
          const q = DISC_QUESTIONS.find((q) => q.id === a.question_id)
          const opt = q?.options.find((o) => o.trait === dim)
          return sum + (opt?.score ?? 0)
        }, 0)
        const max = dimAnswers.length * 4
        return max > 0 ? Math.round((total / max) * 100) : 0
      }
      const eScore = profile.scores.E ?? computeScore(eAnswers, 'E')
      const aScore = profile.scores.A ?? computeScore(aAnswers, 'A')

      const wellbeingLabel = eScore >= 75 ? 'Excelente' : eScore >= 50 ? 'Bom' : eScore >= 25 ? 'Em Atenção' : 'Crítico'
      const wellbeingColor = eScore >= 75 ? 'text-emerald-600' : eScore >= 50 ? 'text-blue-600' : eScore >= 25 ? 'text-amber-600' : 'text-red-600'
      const perfLabel = aScore >= 75 ? 'Alta Confiança' : aScore >= 50 ? 'Boa Base' : aScore >= 25 ? 'Desenvolvimento' : 'Precisa Apoio'
      const perfColor = aScore >= 75 ? 'text-emerald-600' : aScore >= 50 ? 'text-blue-600' : aScore >= 25 ? 'text-amber-600' : 'text-red-600'

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Seu Perfil Comportamental</h2>
              <p className="text-muted-foreground">Análise DISC completa com Engajamento e Autoavaliação</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetake}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Refazer
            </Button>
          </div>

          {/* DISC Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                {profile.profile_name}
                <Badge className={DIMENSION_INFO[profile.dominant_profile]?.color}>
                  {profile.dominant_profile} · {DIMENSION_INFO[profile.dominant_profile]?.label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{profile.profile_description}</p>
            </CardContent>
          </Card>

          {/* DISC Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição DISC</CardTitle>
            </CardHeader>
            <CardContent>
              <BehavioralChart scores={profile.scores} />
            </CardContent>
          </Card>

          {/* Wellbeing + Performance */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-pink-200 dark:border-pink-900">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <HeartPulse className="h-4 w-4 text-pink-500" />
                  Engajamento & Bem-estar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className={`text-3xl font-bold ${wellbeingColor}`}>{eScore}%</span>
                  <Badge variant="outline" className={wellbeingColor.replace('text-', 'border-').replace('600', '400') + ' ' + wellbeingColor}>
                    {wellbeingLabel}
                  </Badge>
                </div>
                <Progress value={eScore} className={`h-2 ${eScore >= 75 ? '[&>div]:bg-emerald-500' : eScore >= 50 ? '[&>div]:bg-blue-500' : eScore >= 25 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`} />
                <p className="text-xs text-muted-foreground">
                  {profile.wellbeing_insight ?? (eScore >= 75
                    ? 'Você está em ótimo estado de energia e motivação. Continue cultivando esse equilíbrio.'
                    : eScore >= 50
                    ? 'Bom nível de bem-estar com oportunidades de melhoria no equilíbrio e reconhecimento.'
                    : eScore >= 25
                    ? 'Sinais de desgaste detectados. Converse com seu gestor sobre ajustes de carga e expectativas.'
                    : 'Risco de burnout identificado. É importante priorizar seu bem-estar agora.')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-violet-200 dark:border-violet-900">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-violet-500" />
                  Autoavaliação de Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className={`text-3xl font-bold ${perfColor}`}>{aScore}%</span>
                  <Badge variant="outline" className={perfColor.replace('text-', 'border-').replace('600', '400') + ' ' + perfColor}>
                    {perfLabel}
                  </Badge>
                </div>
                <Progress value={aScore} className={`h-2 ${aScore >= 75 ? '[&>div]:bg-emerald-500' : aScore >= 50 ? '[&>div]:bg-blue-500' : aScore >= 25 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`} />
                <p className="text-xs text-muted-foreground">
                  {profile.performance_insight ?? (aScore >= 75
                    ? 'Alta confiança em suas capacidades comerciais. Você está dominando bem o processo.'
                    : aScore >= 50
                    ? 'Boa base de domínio com lacunas pontuais que as missões ativas estão endereçando.'
                    : aScore >= 25
                    ? 'Oportunidade de desenvolvimento técnico importante. Foque nas missões de capacitação.'
                    : 'Identificamos gaps técnicos significativos. Um plano de desenvolvimento estruturado é recomendado.')}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Strengths */}
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Forças em Vendas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {profile.selling_strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Development Areas */}
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Áreas de Desenvolvimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {profile.development_areas.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Estilo de Comunicação</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{profile.communication_style}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Papel Ideal em Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{profile.ideal_sales_role}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    return null
  }

  // ── Question Step ────────────────────────────────────────────
  const dimProgress = DIMENSION_ORDER.map((dim) => ({
    dim,
    info: DIMENSION_INFO[dim],
    total: Q_BY_DIMENSION[dim]?.length ?? 0,
    answered: answers.filter((a) => DISC_QUESTIONS.find((q) => q.id === a.question_id)?.dimension === dim).length,
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Perfil Comportamental</h2>
          <p className="text-muted-foreground text-sm">
            {currentDim && (
              <span>
                Dimensão: <strong>{currentDim.label}</strong> ·{' '}
              </span>
            )}
            Pergunta {step} de {TOTAL_Q}
          </p>
        </div>
        {currentQuestion && (
          <Badge className={DIMENSION_INFO[currentQuestion.dimension].color}>
            {currentQuestion.dimension} · {DIMENSION_INFO[currentQuestion.dimension].label}
          </Badge>
        )}
      </div>

      {/* Overall progress */}
      <Progress value={progress} className="h-1.5" />

      {/* Dimension progress pills */}
      <div className="flex flex-wrap gap-1.5">
        {dimProgress.map(({ dim, info, total, answered }) => (
          <div
            key={dim}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
              answered === total && total > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                : currentQuestion?.dimension === dim
                ? `${info.color} border-current/30`
                : 'bg-muted/50 border-border/40 text-muted-foreground'
            }`}
          >
            {answered === total && total > 0 ? <CheckCircle className="h-2.5 w-2.5" /> : null}
            {dim} {answered}/{total}
          </div>
        ))}
      </div>

      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {currentQuestion && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className={`rounded-md p-1.5 ${DIMENSION_INFO[currentQuestion.dimension].color}`}>
                {DIMENSION_INFO[currentQuestion.dimension].icon}
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {DIMENSION_INFO[currentQuestion.dimension].label}
              </span>
            </div>
            <CardTitle className="text-base leading-snug">{currentQuestion.question}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.trait + (option.score ?? '')}
                  onClick={() => handleSelectOption(currentQuestion.id, option.trait)}
                  className={`w-full rounded-lg border p-3.5 text-left text-sm transition-colors ${
                    currentAnswer?.selected_option === option.trait
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step <= 1}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>

        {step < TOTAL_Q ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!currentAnswer}
          >
            Próxima
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={answers.length < TOTAL_Q}
          >
            <Sparkles className="mr-1 h-4 w-4" />
            Analisar Perfil
          </Button>
        )}
      </div>
    </div>
  )
}
