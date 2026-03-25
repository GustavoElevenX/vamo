// VAMO IA — Geração de perguntas diagnósticas via OpenAI
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenAIJSON, isOpenAIConfigured } from '@/lib/services/openai.service'

interface CompanyContext {
  respondent_name: string
  segmento: string
  subnicho: string
  num_funcionarios: string
  num_vendedores: string
  tempo_empresa: string
  modelo_vendas: string
  ticket_medio: string
  ciclo_vendas: string
  crm: string
  meta_mensal: string
  receita_atual: string
  canal_leads: string[]
  tem_gestor: boolean
}

export interface AIQuestion {
  id: number
  question: string
  area: 'lead_generation' | 'sales_process' | 'team_management' | 'tools_technology'
  options: { label: string; value: number }[]
}

export async function POST(request: Request) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: 'IA não configurada' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { companyContext }: { companyContext: CompanyContext } = await request.json()
  if (!companyContext?.segmento) {
    return NextResponse.json({ error: 'companyContext é obrigatório' }, { status: 400 })
  }

  const systemPrompt = `Você é um especialista em diagnóstico de equipes comerciais de alta performance no Brasil.
Gere um questionário de diagnóstico personalizado com base no perfil da empresa.

ÁREAS A COBRIR (3 perguntas por área, total 12):
- lead_generation: Geração de Leads e Prospecção
- sales_process: Processo de Vendas e Conversão
- team_management: Gestão da Equipe Comercial
- tools_technology: Ferramentas, CRM e Tecnologia

REGRAS:
- Cada pergunta: 4 opções de resposta, valor 1 (pior) a 4 (melhor prática)
- Adapte ao segmento, modelo de vendas e porte da empresa
- Português brasileiro, linguagem direta e profissional
- Retorne APENAS o JSON válido e completo, sem texto adicional

FORMATO:
{
  "questions": [
    {
      "id": 1,
      "question": "texto da pergunta adaptado ao contexto",
      "area": "lead_generation",
      "options": [
        { "label": "Descrição do pior cenário", "value": 1 },
        { "label": "Descrição do cenário básico", "value": 2 },
        { "label": "Descrição do bom cenário", "value": 3 },
        { "label": "Descrição da melhor prática", "value": 4 }
      ]
    }
  ]
}`

  const userPrompt = `PERFIL DA EMPRESA:
- Empresa: ${companyContext.respondent_name}
- Segmento: ${companyContext.segmento} | Nicho: ${companyContext.subnicho || 'Geral'}
- Funcionários: ${companyContext.num_funcionarios} | Vendedores: ${companyContext.num_vendedores}
- Tempo de mercado: ${companyContext.tempo_empresa}
- Modelo de vendas: ${companyContext.modelo_vendas}
- Ticket médio: ${companyContext.ticket_medio}
- Ciclo de vendas: ${companyContext.ciclo_vendas}
- CRM: ${companyContext.crm}
- Meta mensal: ${companyContext.meta_mensal}
- Atingimento atual: ${companyContext.receita_atual}
- Canais de leads: ${companyContext.canal_leads.join(', ')}
- Gestor comercial dedicado: ${companyContext.tem_gestor ? 'Sim' : 'Não'}

Gere 12 perguntas diagnósticas (3 por área) específicas para este perfil.`

  try {
    const { data } = await callOpenAIJSON<{ questions: AIQuestion[] }>({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 4000,
    })

    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error('Formato inválido')
    }

    const questions = data.questions
      .filter((q) => q.question && q.area && Array.isArray(q.options) && q.options.length >= 2)
      .slice(0, 20)
      .map((q, i) => ({
        id: i + 1,
        question: q.question,
        area: q.area,
        options: q.options.slice(0, 4).map((o, idx) => ({
          label: o.label,
          value: typeof o.value === 'number' ? o.value : idx + 1,
        })),
      }))

    return NextResponse.json({ questions })
  } catch (error: any) {
    console.error('AI generate questions error:', error)
    return NextResponse.json(
      { error: 'Não foi possível gerar as perguntas. Tente novamente.' },
      { status: 503 }
    )
  }
}
