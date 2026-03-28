// VAMO IA — Prompts de VAMO IA para análise comercial e gamificação
import type { DiagnosticArea } from '@/types'
import { DIAGNOSTIC_AREAS } from '@/lib/constants'
import type { BehavioralAnswer } from './types'

interface DiagnosticQuestionAnswer {
  question_text: string
  area: DiagnosticArea
  selected_option_label: string
  score: number
  max_score: number
  notes?: string | null
}

interface DiagnosticData {
  health_pct: number
  quadrant: string
  area_scores: Record<DiagnosticArea, { score: number; max: number; pct: number }>
  respondent_name: string
  qa?: DiagnosticQuestionAnswer[]
}

const SALES_CONSULTANT_SYSTEM = `Voce e um consultor senior especializado em performance de equipes comerciais com mais de 15 anos de experiencia em diagnostico e desenvolvimento de times de vendas. Voce analisa dados detalhados de diagnostico e gera insights cirurgicos e acionaveis. Sempre responda em portugues brasileiro com linguagem profissional e direta.`

const QUADRANT_LABELS: Record<string, string> = {
  critical: 'Critico',
  at_risk: 'Em Risco',
  developing: 'Em Desenvolvimento',
  optimized: 'Otimizado',
}

export function buildDiagnosticAnalysisPrompt(data: DiagnosticData) {
  const areaLabels: Record<DiagnosticArea, string> = {
    lead_generation: 'Geracao de Leads',
    sales_process: 'Processo de Vendas',
    team_management: 'Gestao de Equipe',
    tools_technology: 'Ferramentas e Tecnologia',
  }

  // Build area summary
  const areaSummary = Object.entries(data.area_scores)
    .sort(([, a], [, b]) => a.pct - b.pct)
    .map(([area, scores]) => {
      const label = DIAGNOSTIC_AREAS[area as DiagnosticArea]
      const status = scores.pct >= 75 ? 'Otimizado' : scores.pct >= 50 ? 'Em Desenvolvimento' : scores.pct >= 25 ? 'Em Risco' : 'Critico'
      return `  ${label}: ${scores.pct}% [${status}] (${scores.score}/${scores.max} pts)`
    })
    .join('\n')

  // Build detailed Q&A by area (if available)
  let detailedQA = ''
  if (data.qa && data.qa.length > 0) {
    const byArea = data.qa.reduce((acc, qa) => {
      if (!acc[qa.area]) acc[qa.area] = []
      acc[qa.area].push(qa)
      return acc
    }, {} as Record<DiagnosticArea, DiagnosticQuestionAnswer[]>)

    detailedQA = '\n\nRESPOSTAS DETALHADAS POR AREA:\n'
    for (const [area, qas] of Object.entries(byArea)) {
      const areaScore = data.area_scores[area as DiagnosticArea]
      detailedQA += `\n--- ${areaLabels[area as DiagnosticArea]} (${areaScore?.pct ?? 0}%) ---\n`
      for (const qa of qas) {
        const scorePct = Math.round((qa.score / qa.max_score) * 100)
        detailedQA += `• "${qa.question_text}"\n  Resposta: "${qa.selected_option_label}" (${qa.score}/${qa.max_score} pts = ${scorePct}%)\n`
        if (qa.notes?.trim()) {
          detailedQA += `  Observacao: "${qa.notes.trim()}"\n`
        }
      }
    }
  }

  const quadrantLabel = QUADRANT_LABELS[data.quadrant] ?? data.quadrant

  return {
    system: `${SALES_CONSULTANT_SYSTEM}

Analise o diagnostico comercial detalhado abaixo e gere uma analise impecavel e personalizada.

Responda EXCLUSIVAMENTE com JSON valido no seguinte formato (sem markdown, sem texto fora do JSON):
{
  "executive_summary": "Resumo executivo em 2-3 frases descrevendo o estado atual da operacao comercial, os principais riscos e o potencial de melhoria. Seja especifico ao respondente e aos dados.",
  "bottlenecks": [
    "Gargalo especifico identificado nas respostas, nao generico. Ex: 'Ausencia de processo sistematizado de prospeccao: a equipe depende exclusivamente de indicacoes, limitando o crescimento previsivel de pipeline'"
  ],
  "strengths": [
    "Ponto forte especifico baseado nas areas/respostas com maior pontuacao"
  ],
  "weaknesses": [
    "Fraqueza especifica identificada nas respostas, com contexto do porque impacta o resultado"
  ],
  "financial_implications": "Descricao em 2-3 frases do impacto financeiro estimado dos gargalos identificados. Mencione perda de oportunidades, ciclo de vendas longo, churn ou baixa conversao conforme os dados indicarem.",
  "priority_actions": [
    {
      "action": "Acao especifica, pratica e implementavel em ate 30 dias. Nao teorica.",
      "area": "Nome da area relacionada",
      "impact": "alto"
    }
  ]
}

Regras obrigatorias:
- executive_summary: 2-3 frases, direto ao ponto, especifico ao respondente
- bottlenecks: 2-4 gargalos ESPECIFICOS baseados nas respostas de menor pontuacao, nunca genericos
- strengths: 2-3 pontos fortes ESPECIFICOS das areas/respostas de maior pontuacao
- weaknesses: 2-3 fraquezas especificas com contexto de impacto
- financial_implications: impacto financeiro realista baseado nos gargalos identificados
- priority_actions: 3-5 acoes PRATICAS e ESPECIFICAS, ordenadas por impacto (alto/medio/baixo)
- Use os dados das respostas individuais para personalizar tudo - nunca escreva analises genericas`,

    user: `DIAGNOSTICO COMERCIAL
Respondente: ${data.respondent_name}
Score Geral: ${data.health_pct}% | Quadrante: ${quadrantLabel}

PONTUACAO POR AREA (ordenado do pior para o melhor):
${areaSummary}
${detailedQA}

Gere uma analise completa, especifica e acionavel baseada em TODOS os dados acima.`,
  }
}

export function buildBehavioralProfilePrompt(answers: BehavioralAnswer[]) {
  const traitCounts = { D: 0, I: 0, S: 0, C: 0 }
  for (const a of answers) {
    if (a.selected_option === 'D' || a.selected_option === 'I' || a.selected_option === 'S' || a.selected_option === 'C') {
      traitCounts[a.selected_option]++
    }
  }
  const total = answers.length

  return {
    system: `${SALES_CONSULTANT_SYSTEM}

Voce e especialista em perfis comportamentais DISC aplicados a vendas. Analise as respostas do questionario e gere um perfil detalhado.

Os 4 perfis DISC:
- D (Dominancia): Direto, decisivo, competitivo, orientado a resultados
- I (Influencia): Comunicativo, entusiasta, persuasivo, orientado a pessoas
- S (Estabilidade): Paciente, confiavel, cooperativo, orientado a equipe
- C (Conformidade): Analitico, preciso, meticuloso, orientado a qualidade

Responda EXCLUSIVAMENTE com JSON valido no seguinte formato:
{
  "dominant_profile": "D",
  "profile_name": "nome do perfil em portugues",
  "profile_description": "descricao detalhada do perfil em 2-3 frases",
  "scores": {"D": 0, "I": 0, "S": 0, "C": 0},
  "selling_strengths": ["forca 1", "forca 2", "forca 3"],
  "development_areas": ["area de desenvolvimento 1", "area 2"],
  "communication_style": "descricao do estilo de comunicacao",
  "ideal_sales_role": "tipo de venda ideal para este perfil"
}

NAO inclua markdown, explicacoes ou texto fora do JSON.`,

    user: `Resultados do questionario DISC (${total} perguntas):
- Dominancia (D): ${traitCounts.D} respostas (${Math.round((traitCounts.D / total) * 100)}%)
- Influencia (I): ${traitCounts.I} respostas (${Math.round((traitCounts.I / total) * 100)}%)
- Estabilidade (S): ${traitCounts.S} respostas (${Math.round((traitCounts.S / total) * 100)}%)
- Conformidade (C): ${traitCounts.C} respostas (${Math.round((traitCounts.C / total) * 100)}%)

Gere o perfil comportamental detalhado para vendas.`,
  }
}

interface MissionGenerationData {
  health_pct: number
  quadrant: string
  area_scores: Record<DiagnosticArea, { score: number; max: number; pct: number }>
  behavioralProfile?: {
    dominant_profile: string
    selling_strengths: string[]
    development_areas: string[]
  }
}

export function buildMissionGenerationPrompt(data: MissionGenerationData) {
  const areaDetails = Object.entries(data.area_scores)
    .map(([area, scores]) => {
      const label = DIAGNOSTIC_AREAS[area as DiagnosticArea]
      return `- ${label} (${area}): ${scores.pct}%`
    })
    .join('\n')

  const profileInfo = data.behavioralProfile
    ? `\nPerfil DISC: ${data.behavioralProfile.dominant_profile}
Forcas: ${data.behavioralProfile.selling_strengths.join(', ')}
Areas de desenvolvimento: ${data.behavioralProfile.development_areas.join(', ')}`
    : ''

  return {
    system: `${SALES_CONSULTANT_SYSTEM}

Com base nos dados de diagnostico, gere missoes gamificadas personalizadas para melhorar a performance comercial.

Responda EXCLUSIVAMENTE com JSON valido no seguinte formato:
[
  {
    "title": "titulo curto da missao",
    "description": "descricao detalhada do que fazer e por que",
    "area": "lead_generation",
    "difficulty": 1,
    "xp_reward": 50,
    "resources": [{"title": "nome do recurso", "url": ""}]
  }
]

Regras:
- Gere 4-5 missoes
- Foque nas areas com menor pontuacao (maior necessidade de melhoria)
- area DEVE ser uma dessas: lead_generation, sales_process, team_management, tools_technology
- difficulty: 1 (facil), 2 (medio), 3 (dificil)
- xp_reward: 30-50 (facil), 60-100 (medio), 120-200 (dificil)
- Cada missao deve ter 1-2 recursos sugeridos (podem ser genericos)
- Missoes devem ser praticas e acionaveis, nao teoricas
- Se houver perfil DISC, personalize as missoes ao estilo do vendedor
- NAO inclua markdown, explicacoes ou texto fora do JSON`,

    user: `Dados do diagnostico:
Score Geral: ${data.health_pct}% (${data.quadrant})

Pontuacao por area:
${areaDetails}
${profileInfo}

Gere missoes gamificadas personalizadas focando nas areas mais fracas.`,
  }
}

export function buildCoachTipPrompt(context: {
  userName: string
  level: number
  streak: number
  totalXp: number
  recentKpiCount: number
  latestDiagnosticQuadrant?: string
  latestDiagnosticHealthPct?: number
}) {
  return {
    system: `${SALES_CONSULTANT_SYSTEM}

Voce e um coach de vendas motivacional. Gere uma dica curta e personalizada para o vendedor com base no contexto.

Responda EXCLUSIVAMENTE com JSON valido no seguinte formato:
{
  "tip": "texto da dica em 1-2 frases, maximo 150 caracteres",
  "category": "motivacional"
}

category deve ser: motivacional, tecnica, comportamental ou estrategica.
A dica deve ser especifica ao contexto do usuario, nao generica.
NAO inclua markdown, explicacoes ou texto fora do JSON.`,

    user: `Contexto do vendedor:
- Nome: ${context.userName}
- Nivel: ${context.level}
- XP Total: ${context.totalXp}
- Streak atual: ${context.streak} dias
- KPIs registrados hoje: ${context.recentKpiCount}
${context.latestDiagnosticQuadrant ? `- Ultimo diagnostico: ${context.latestDiagnosticHealthPct}% (${context.latestDiagnosticQuadrant})` : '- Sem diagnostico recente'}

Gere uma dica personalizada e motivacional.`,
  }
}
