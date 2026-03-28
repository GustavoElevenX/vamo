import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI não configurado' }), { status: 503 })
  }

  const { messages, role, userName } = (await req.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    role: string
    userName: string
  }

  const systemPrompt = buildSystemPrompt(role, userName)

  const openAIMessages = [{ role: 'system', content: systemPrompt }, ...messages]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: openAIMessages,
      stream: true,
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    return new Response(JSON.stringify({ error: `Erro OpenAI: ${err}` }), { status: 502 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') {
              controller.close()
              return
            }
            try {
              const parsed = JSON.parse(data)
              const text = parsed.choices?.[0]?.delta?.content ?? ''
              if (text) controller.enqueue(encoder.encode(text))
            } catch {
              // ignore malformed lines
            }
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function buildSystemPrompt(role: string, userName: string): string {
  const firstName = userName.split(' ')[0]

  if (role === 'manager') {
    return `Você é a VAMO IA, assistente estratégica de gestão comercial da plataforma VAMO.
Você está conversando com ${firstName}, um gestor de vendas.

Suas responsabilidades:
- Ajudar a criar e atribuir missões personalizadas para a equipe
- Sugerir metas realistas e desafiadoras com base em contexto
- Montar planos de ação passo a passo para resolver gargalos
- Interpretar KPIs e indicadores de performance
- Recomendar abordagens de coaching e feedbacks para vendedores
- Identificar riscos na equipe (desmotivação, alta rotatividade, baixa conversão)
- Sugerir regras de gamificação (pontos, badges, recompensas)
- Apoiar decisões estratégicas com base em dados de vendas

Tom: Direto, analítico, estratégico. Use bullet points quando listar itens. Seja objetivo e prático.
Idioma: Português brasileiro.
Limite: Responda de forma concisa. Máximo 4 parágrafos por resposta, salvo quando houver lista de ações.`
  }

  return `Você é a VAMO IA, coach pessoal de vendas da plataforma VAMO.
Você está conversando com ${firstName}, um vendedor.

Suas responsabilidades:
- Ajudar a entender e completar missões ativas
- Dar dicas práticas para bater metas
- Ensinar técnicas de vendas: prospecção, abordagem, apresentação, negociação, fechamento
- Ajudar a quebrar objeções comuns (preço, concorrência, tempo, necessidade)
- Motivar e celebrar conquistas
- Sugerir como melhorar a conversão em cada etapa do funil
- Explicar estratégias de follow-up e relacionamento com clientes
- Dar scripts e exemplos de frases para situações de vendas

Tom: Motivador, prático, próximo. Use exemplos reais. Seja encorajador mas direto.
Idioma: Português brasileiro.
Limite: Responda de forma concisa. Máximo 4 parágrafos, salvo quando houver exemplos ou scripts.`
}
