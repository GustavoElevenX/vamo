// VAMO IA — Simulador de Proposta (roleplay de vendas)
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callOpenAIJSON, isOpenAIConfigured } from '@/lib/services/openai.service'

export const runtime = 'nodejs'

interface ScenarioRequest {
  action: 'start' | 'message' | 'feedback'
  sessionId?: string
  difficulty?: number
  message?: string
}

interface ClientScenario {
  nome: string
  empresa: string
  cargo: string
  setor: string
  objecao_principal: string
  contexto: string
  temperamento: string
}

interface SimulationFeedback {
  ponto_forte: string
  erro_especifico: string
  frase_ideal: string
  nota: number
}

export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return new Response(JSON.stringify({ error: 'VAMO IA não configurada' }), { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, organization_id, name')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), { status: 404 })
  }

  const body: ScenarioRequest = await req.json()

  // === START: Generate scenario and create session ===
  if (body.action === 'start') {
    const difficulty = Math.min(3, Math.max(1, body.difficulty || 1))

    const difficultyDesc: Record<number, string> = {
      1: 'Cliente com objeção de preço. Hesitante mas aberto. Uma objeção principal.',
      2: 'Cliente com objeção de timing ("não é o momento"). Mais resistente. Duas objeções.',
      3: 'Cliente difícil com múltiplas objeções (preço, timing, concorrência). Muito cético.',
    }

    const { data: scenario } = await callOpenAIJSON<ClientScenario>({
      systemPrompt: `Você é um gerador de cenários de simulação de vendas. Crie um perfil de cliente fictício realista para um exercício de roleplay de vendas B2B no Brasil.
Dificuldade: ${difficultyDesc[difficulty]}
Retorne APENAS um JSON com: nome, empresa, cargo, setor, objecao_principal, contexto (situação do cliente), temperamento (como ele se comporta).`,
      userPrompt: `Gere um perfil de cliente para simulação nível ${difficulty}. Setor variado. Nome brasileiro realista.`,
      temperature: 0.8,
      maxTokens: 500,
    })

    const { data: session, error } = await supabase
      .from('simulation_sessions')
      .insert({
        user_id: appUser.id,
        organization_id: appUser.organization_id,
        scenario,
        messages: [],
        difficulty,
        completed: false,
      })
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: 'Erro ao criar sessão' }), { status: 500 })
    }

    return new Response(JSON.stringify({ session }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // === MESSAGE: Roleplay streaming response ===
  if (body.action === 'message') {
    if (!body.sessionId || !body.message) {
      return new Response(JSON.stringify({ error: 'sessionId e message são obrigatórios' }), { status: 400 })
    }

    const { data: session } = await supabase
      .from('simulation_sessions')
      .select('*')
      .eq('id', body.sessionId)
      .eq('user_id', appUser.id)
      .single()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), { status: 404 })
    }

    const scenario = session.scenario as ClientScenario
    const prevMessages = (session.messages || []) as { role: string; content: string }[]

    const newMessages = [
      ...prevMessages,
      { role: 'user', content: body.message },
    ]

    const systemPrompt = `Você é ${scenario.nome}, ${scenario.cargo} da ${scenario.empresa} (setor: ${scenario.setor}).
Contexto: ${scenario.contexto}
Temperamento: ${scenario.temperamento}
Objeção principal: ${scenario.objecao_principal}

REGRAS DO ROLEPLAY:
- Você é o CLIENTE, não o vendedor. Responda como cliente real faria.
- Seja natural, use linguagem informal brasileira quando apropriado.
- Não ceda fácil. Faça objeções realistas.
- Dificuldade ${session.difficulty}/3: ${session.difficulty === 1 ? 'Resista um pouco mas esteja aberto' : session.difficulty === 2 ? 'Seja mais resistente, use 2 objeções' : 'Seja muito cético, use múltiplas objeções'}.
- Respostas curtas (2-4 frases). Aja como um cliente real em reunião.
- Se o vendedor fizer um bom argumento, reconheça sutilmente mas não compre na hora.
- NUNCA saia do personagem. NUNCA dê dicas de vendas. Você é o cliente.`

    const openAIMessages = [
      { role: 'system', content: systemPrompt },
      ...newMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ]

    const apiKey = process.env.OPENAI_API_KEY!
    // Timeout: abort if OpenAI doesn't respond within 30s
    const openAIController = new AbortController()
    const openAITimeout = setTimeout(() => openAIController.abort(), 30_000)

    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAIMessages,
          stream: true,
          max_tokens: 300,
          temperature: 0.7,
        }),
        signal: openAIController.signal,
      })
    } catch {
      clearTimeout(openAITimeout)
      return new Response(JSON.stringify({ error: 'Timeout na conexão com IA' }), { status: 504 })
    }
    clearTimeout(openAITimeout)

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Erro na IA' }), { status: 502 })
    }

    let fullResponse = ''
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
                // Save messages to DB
                const updatedMessages = [
                  ...newMessages,
                  { role: 'assistant', content: fullResponse },
                ]
                await supabase
                  .from('simulation_sessions')
                  .update({ messages: updatedMessages })
                  .eq('id', body.sessionId)

                controller.close()
                return
              }
              try {
                const parsed = JSON.parse(data)
                const text = parsed.choices?.[0]?.delta?.content ?? ''
                if (text) {
                  fullResponse += text
                  controller.enqueue(encoder.encode(text))
                }
              } catch {
                // ignore
              }
            }
          }
        } finally {
          // Save even if stream breaks
          if (fullResponse) {
            const updatedMessages = [
              ...newMessages,
              { role: 'assistant', content: fullResponse },
            ]
            await supabase
              .from('simulation_sessions')
              .update({ messages: updatedMessages })
              .eq('id', body.sessionId)
          }
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // === FEEDBACK: Generate feedback and complete session ===
  if (body.action === 'feedback') {
    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId é obrigatório' }), { status: 400 })
    }

    const { data: session } = await supabase
      .from('simulation_sessions')
      .select('*')
      .eq('id', body.sessionId)
      .eq('user_id', appUser.id)
      .single()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), { status: 404 })
    }

    const scenario = session.scenario as ClientScenario
    const messages = (session.messages || []) as { role: string; content: string }[]

    const conversation = messages
      .map((m) => `${m.role === 'user' ? 'VENDEDOR' : 'CLIENTE'}: ${m.content}`)
      .join('\n')

    const { data: feedback } = await callOpenAIJSON<SimulationFeedback>({
      systemPrompt: `Você é um coach de vendas experiente. Analise a conversa de roleplay abaixo e dê feedback construtivo.
O cenário era: ${scenario.nome}, ${scenario.cargo} da ${scenario.empresa}. Objeção: ${scenario.objecao_principal}.
Dificuldade: ${session.difficulty}/3.

Retorne um JSON com:
- ponto_forte: O melhor momento do vendedor (1-2 frases)
- erro_especifico: O erro mais importante (1-2 frases)
- frase_ideal: A frase exata que o vendedor deveria ter dito no momento crítico
- nota: Nota de 1 a 10`,
      userPrompt: `Conversa:\n${conversation}`,
      temperature: 0.3,
      maxTokens: 500,
    })

    await supabase
      .from('simulation_sessions')
      .update({ feedback, completed: true })
      .eq('id', body.sessionId)

    return new Response(JSON.stringify({ feedback }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400 })
}

// GET: List user's simulation sessions
export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), { status: 404 })
  }

  const { data: sessions } = await supabase
    .from('simulation_sessions')
    .select('id, scenario, difficulty, completed, feedback, created_at')
    .eq('user_id', appUser.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return new Response(JSON.stringify({ sessions: sessions || [] }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
