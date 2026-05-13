import { callOpenRouterJSON, isOpenRouterConfigured } from './openrouter.service'

export type CheckinQuestion = {
  id: string
  type: 'energy' | 'single_choice' | 'text'
  title: string
  description?: string
  options?: string[]
  required?: boolean
}

export type CheckinQuestionContext = {
  seller: {
    id: string
    name: string
  }
  dailyKpi: null | {
    id: string
    name: string
    current: number
    target: number
    unit: string
  }
  overdueDeals: Array<{
    id: string
    title: string
    value: number
    next_action_title: string | null
  }>
  noActionDeals: Array<{
    id: string
    title: string
    value: number
  }>
  missions: Array<{
    id: string
    title: string
    description: string | null
  }>
  pdiGaps: Array<{
    id: string
    skill_area: string
    severity: string | null
  }>
  lastCheckin: null | {
    energy_level: number
    intention: string | null
    obstacle: string | null
    checkin_date: string
  }
  managerNudges?: Array<{
    id: string
    title: string | null
    message: string
  }>
}

type AiQuestionResponse = {
  questions?: CheckinQuestion[]
}

const ENERGY_QUESTION: CheckinQuestion = {
  id: 'energy_level',
  type: 'energy',
  title: 'Como esta sua energia para executar hoje?',
  required: true,
}

function uniqueOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return []
  return [...new Set(options.map((option) => String(option || '').trim()).filter(Boolean))].slice(0, 5)
}

function sanitizeQuestions(questions: unknown): CheckinQuestion[] {
  if (!Array.isArray(questions)) return []

  const sanitized = questions
    .map((question) => {
      const item = question as Partial<CheckinQuestion>
      const type = item.type === 'energy' || item.type === 'single_choice' || item.type === 'text'
        ? item.type
        : null
      const title = String(item.title || '').trim()
      if (!type || !title) return null

      const output: CheckinQuestion = {
        id: String(item.id || type).trim().replace(/[^a-zA-Z0-9_-]/g, '_') || type,
        type,
        title,
        required: Boolean(item.required),
      }

      if (item.description) output.description = String(item.description)
      if (type === 'single_choice') output.options = uniqueOptions(item.options)

      return output
    })
    .filter((question): question is CheckinQuestion => Boolean(question))
    .slice(0, 3)

  const first = sanitized[0]
  if (!first || first.type !== 'energy') return [ENERGY_QUESTION, ...sanitized.filter((q) => q.type !== 'energy')].slice(0, 3)

  const normalizedFirst: CheckinQuestion = {
    ...first,
    id: 'energy_level',
    type: 'energy',
    required: true,
  }

  return [normalizedFirst, ...sanitized.slice(1)].slice(0, 3)
}

export function buildFallbackQuestions(context: CheckinQuestionContext): CheckinQuestion[] {
  const questions: CheckinQuestion[] = [ENERGY_QUESTION]

  if (context.overdueDeals.length > 0) {
    questions.push({
      id: 'priority_focus',
      type: 'single_choice',
      title: 'Qual pendencia você vai destravar primeiro?',
      options: context.overdueDeals.slice(0, 3).map((deal) => deal.title),
      required: false,
    })
  } else if (context.dailyKpi) {
    questions.push({
      id: 'priority_focus',
      type: 'single_choice',
      title: `Qual acao vai te aproximar do KPI "${context.dailyKpi.name}" hoje?`,
      options: [
        'Registrar uma nova atividade comercial',
        'Avancar uma oportunidade aberta',
        'Atualizar próximos passos no CRM',
      ],
      required: false,
    })
  } else if (context.noActionDeals.length > 0) {
    questions.push({
      id: 'priority_focus',
      type: 'single_choice',
      title: 'Qual oportunidade vai ganhar uma próxima ação hoje?',
      options: context.noActionDeals.slice(0, 3).map((deal) => deal.title),
      required: false,
    })
  } else {
    questions.push({
      id: 'priority_focus',
      type: 'single_choice',
      title: 'Qual será seu foco comercial principal hoje?',
      options: [
        'Criar novas oportunidades',
        'Fazer retorno',
        'Atualizar CRM',
        'Avancar proposta',
      ],
      required: false,
    })
  }

  const blockerTitle = context.pdiGaps[0]
    ? `Existe algo em ${context.pdiGaps[0].skill_area} que pode travar sua execucao hoje?`
    : 'Existe algo que pode travar sua execução hoje?'

  questions.push({
    id: 'blocker',
    type: 'text',
    title: blockerTitle,
    description: 'Responda em uma frase. Se não tiver, pode deixar em branco.',
    required: false,
  })

  return questions
}

export async function generateCheckinQuestions(context: CheckinQuestionContext) {
  const fallback = buildFallbackQuestions(context)

  if (!isOpenRouterConfigured()) {
    return { questions: fallback, source: 'fallback' as const }
  }

  const systemPrompt = `
Você é a IA da Vamo dentro do Copiloto Diario.
Sua funcao e gerar um check-in curto, util e contextual para um vendedor.
Não repita perguntas genericas se houver dados concretos no contexto.
Use no maximo 3 perguntas.
A primeira pergunta sempre deve medir energia de 1 a 5.
As outras perguntas devem se conectar a KPI, funil, missão, PDI ou risco real do dia.
Retorne apenas JSON válido.
`

  const userPrompt = `
Contexto do vendedor:
${JSON.stringify(context)}

Retorne no formato:
{
  "questions": [
    {
      "id": "energy_level",
      "type": "energy",
      "title": "...",
      "description": "...",
      "required": true
    }
  ]
}
`

  try {
    const { data } = await callOpenRouterJSON<AiQuestionResponse>({
      systemPrompt,
      userPrompt,
      temperature: 0.25,
      maxTokens: 900,
    })
    const questions = sanitizeQuestions(data.questions)
    return { questions: questions.length > 0 ? questions : fallback, source: questions.length > 0 ? 'ai' as const : 'fallback' as const }
  } catch (error) {
    console.error('Check-in question generation error:', error)
    return { questions: fallback, source: 'fallback' as const }
  }
}
