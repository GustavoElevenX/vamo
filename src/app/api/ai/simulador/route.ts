import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callOpenAIJSON, isOpenAIConfigured } from '@/lib/services/openai.service'
import { createRecommendation } from '@/lib/services/action-recommendation.service'
import { createEntityRelationship, createEventWithImpacts } from '@/lib/services/performance-os.service'
import { awardXp } from '@/lib/services/xp.service'

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
  skill_area?: string
  next_practice?: string
  xp_awarded?: number
  event_id?: string
  pdi_gap_id?: string | null
  pdi_plan_id?: string | null
}

type AdminClient = ReturnType<typeof createAdminClient>

const FALLBACK_SCENARIOS: Record<number, ClientScenario> = {
  1: {
    nome: 'Mariana Lopes',
    empresa: 'Alfa Distribuidora',
    cargo: 'Gerente Comercial',
    setor: 'Distribuicao B2B',
    objecao_principal: 'O preço parece alto para o momento.',
    contexto: 'A empresa quer melhorar conversão de propostas, mas acabou de cortar custos.',
    temperamento: 'Pragmatica, direta e aberta a numeros claros.',
  },
  2: {
    nome: 'Renato Barros',
    empresa: 'NorteLog',
    cargo: 'Diretor de Operacoes',
    setor: 'Logistica',
    objecao_principal: 'Agora não é o momento; estamos com prioridades internas.',
    contexto: 'O time comercial perde retornos e Renato teme iniciar mais um projeto sem adesão.',
    temperamento: 'Cauteloso, analitico e resistente a promessas vagas.',
  },
  3: {
    nome: 'Camila Torres',
    empresa: 'VitaMed Brasil',
    cargo: 'CRO',
    setor: 'Saúde',
    objecao_principal: 'Preço, timing e comparacao com concorrente.',
    contexto: 'A empresa avalia duas soluções, tem meta agressiva e quer prova de ROI antes de decidir.',
    temperamento: 'Exigente, cética e orientada a risco.',
  },
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function difficultyDescription(difficulty: number) {
  if (difficulty === 1) return 'Cliente com objeção de preço, hesitante mas aberto.'
  if (difficulty === 2) return 'Cliente com objeção ao momento, mais resistente e com duas objeções.'
  return 'Cliente difícil com objeções de preço, momento e concorrência.'
}

function fallbackClientReply(scenario: ClientScenario, difficulty: number, sellerMessage: string, turn: number) {
  const lower = sellerMessage.toLowerCase()
  const mentionsRoi = lower.includes('roi') || lower.includes('retorno') || lower.includes('resultado') || lower.includes('receita')
  const asksQuestion = sellerMessage.includes('?') || lower.includes('entender') || lower.includes('qual') || lower.includes('como')
  const nextStep = lower.includes('agenda') || lower.includes('proximo') || lower.includes('próximo') || lower.includes('reuniao')

  if (mentionsRoi && asksQuestion && nextStep) {
    return `Entendi melhor. Se você conseguir me mostrar esse impacto com um exemplo parecido com a ${scenario.empresa}, eu topo uma conversa mais técnica. Mas preciso sair dela com números e um próximo passo bem claro.`
  }
  if (mentionsRoi && asksQuestion) {
    return 'Faz sentido olhar pelo impacto, mas ainda estou tentando entender se isso resolve o nosso problema agora. Que evidência você tem de que esse ganho acontece na prática?'
  }
  if (asksQuestion) {
    return 'Boa pergunta. Hoje minha maior preocupação é com adesão do time e tempo de implementação. Eu não quero comprar algo que vire mais uma iniciativa parada.'
  }
  if (turn <= 1) {
    return `Antes de falar de proposta, preciso ser transparente: ${scenario.objecao_principal} O que faria isso valer a pena para a gente?`
  }
  return difficulty === 3
    ? 'Ainda parece genérico para mim. O concorrente promete algo parecido, e eu preciso de uma razão objetiva para priorizar isso agora.'
    : 'Eu entendo, mas ainda fico com receio de investir agora. Como você reduziria o risco dessa decisão?'
}

function fallbackFeedback(messages: { role: string; content: string }[], scenario: ClientScenario): SimulationFeedback {
  const sellerMessages = messages.filter((message) => message.role === 'user').map((message) => message.content)
  const text = sellerMessages.join(' ').toLowerCase()
  let score = 4
  if (sellerMessages.length >= 3) score += 1
  if (text.includes('?')) score += 1
  if (text.includes('roi') || text.includes('retorno') || text.includes('resultado')) score += 1
  if (text.includes('proximo') || text.includes('próximo') || text.includes('agenda')) score += 1
  if (text.includes('entendo') || text.includes('faz sentido')) score += 1
  score = Math.min(10, Math.max(1, score))

  const skillArea = score >= 7 ? 'negotiation' : text.includes('?') ? 'closing' : 'qualification'

  return {
    ponto_forte: score >= 7
      ? 'Você conectou a conversa a impacto e conduziu o cliente para um próximo passo concreto.'
      : 'Você manteve a conversa ativa e demonstrou disposição para lidar com a objeção.',
    erro_especifico: score >= 7
      ? 'O principal ajuste é quantificar melhor o impacto e confirmar critérios de decisão antes de propor agenda.'
      : 'A abordagem ainda ficou pouco diagnóstica. Faltaram perguntas para entender causa, impacto financeiro e critério de decisão.',
    frase_ideal: `Antes de discutir preço, posso entender quanto essa dificuldade custa hoje para a ${scenario.empresa} e qual resultado faria a decisão valer a pena?`,
    nota: score,
    skill_area: skillArea,
    next_practice: score >= 7
      ? 'Aplicar a mesma estrutura em uma oportunidade real e registrar evidência no CRM.'
      : 'Treinar perguntas de qualificação e fechamento antes de voltar para uma proposta real.',
  }
}

async function loadAppUser(adminClient: AdminClient, authUserId: string) {
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, organization_id, name')
    .eq('auth_id', authUserId)
    .single()

  return appUser as { id: string; organization_id: string; name: string } | null
}

async function findManager(adminClient: AdminClient, organizationId: string) {
  const { data } = await adminClient
    .from('users')
    .select('id')
    .eq('organization_id', organizationId)
    .in('role', ['manager', 'admin'])
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  return data?.id as string | undefined
}

async function createSimulationPlan(
  adminClient: AdminClient,
  params: {
    organizationId: string
    userId: string
    managerId?: string
    gapId?: string | null
    skillArea: string
    title: string
    feedback: SimulationFeedback
  },
) {
  const { data: plan } = await adminClient
    .from('pdi_plans')
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      manager_id: params.managerId ?? null,
      gap_id: params.gapId ?? null,
      title: params.title,
      description: `${params.feedback.erro_especifico} Proxima pratica: ${params.feedback.next_practice}`,
      status: params.gapId ? 'recommended' : 'active',
      recommended_by: params.gapId ? 'system' : 'ai',
      target_kpi_key: params.skillArea,
      baseline_value: 0,
      target_value: 10,
      current_value: params.feedback.nota,
      metadata: { source: 'simulation_feedback', feedback: params.feedback },
    })
    .select('id')
    .single()

  return plan?.id as string | undefined
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return json({ error: 'Não autorizado' }, 401)

  const adminClient = createAdminClient()
  const appUser = await loadAppUser(adminClient, authUser.id)
  if (!appUser) return json({ error: 'Usuário não encontrado' }, 404)

  const body = await req.json() as ScenarioRequest

  if (body.action === 'start') {
    const difficulty = Math.min(3, Math.max(1, body.difficulty || 1))
    let scenario = FALLBACK_SCENARIOS[difficulty]

    if (isOpenAIConfigured()) {
      try {
        const result = await callOpenAIJSON<ClientScenario>({
          systemPrompt: `Você é um gerador de cenários de simulação de vendas B2B no Brasil. Dificuldade: ${difficultyDescription(difficulty)}. Retorne APENAS JSON com: nome, empresa, cargo, setor, objecao_principal, contexto, temperamento.`,
          userPrompt: `Gere um perfil de cliente para simulação nível ${difficulty}.`,
          temperature: 0.8,
          maxTokens: 500,
        })
        scenario = result.data
      } catch {
        scenario = FALLBACK_SCENARIOS[difficulty]
      }
    }

    const { data: session, error } = await adminClient
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

    if (error) return json({ error: 'Erro ao criar sessao' }, 500)

    await createEventWithImpacts(
      adminClient,
      {
        organizationId: appUser.organization_id,
        actorUserId: appUser.id,
        targetUserId: appUser.id,
        eventType: 'pdi.training_started',
        sourceModule: 'simulation',
        entityType: 'simulation_session',
        entityId: session.id,
        title: `Simulacao iniciada: ${scenario.objecao_principal}`,
        description: scenario.contexto,
        impactScore: 25,
        priorityScore: 35,
        metadata: { difficulty, scenario },
      },
      [
        { impactedModule: 'pdi', impactedEntityType: 'simulation_session', impactedEntityId: session.id, impactType: 'training_started' },
        { impactedModule: 'ai', impactedEntityType: 'simulation_session', impactedEntityId: session.id, impactType: 'roleplay_context' },
        { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: appUser.id, impactType: 'development_action_started' },
      ],
    )

    return json({ session })
  }

  if (body.action === 'message') {
    if (!body.sessionId || !body.message) return json({ error: 'sessionId e message sao obrigatorios' }, 400)

    const { data: session } = await adminClient
      .from('simulation_sessions')
      .select('*')
      .eq('id', body.sessionId)
      .eq('user_id', appUser.id)
      .single()

    if (!session) return json({ error: 'Sessão não encontrada' }, 404)

    const scenario = session.scenario as ClientScenario
    const previousMessages = (session.messages || []) as { role: string; content: string }[]
    const newMessages = [...previousMessages, { role: 'user', content: body.message }]

    if (!isOpenAIConfigured()) {
      const reply = fallbackClientReply(scenario, Number(session.difficulty || 1), body.message, newMessages.length)
      await adminClient
        .from('simulation_sessions')
        .update({ messages: [...newMessages, { role: 'assistant', content: reply }] })
        .eq('id', body.sessionId)
        .eq('user_id', appUser.id)

      return new Response(reply, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    const systemPrompt = `Voce e ${scenario.nome}, ${scenario.cargo} da ${scenario.empresa}. Contexto: ${scenario.contexto}. Temperamento: ${scenario.temperamento}. Objecao principal: ${scenario.objecao_principal}. Responda como CLIENTE real, curto, sem dar dicas de vendas.`
    const openAIMessages = [
      { role: 'system', content: systemPrompt },
      ...newMessages.map((message) => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content,
      })),
    ]

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    let response: Response

    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAIMessages,
          stream: true,
          max_tokens: 300,
          temperature: 0.7,
        }),
        signal: controller.signal,
      })
    } catch {
      clearTimeout(timeout)
      const reply = fallbackClientReply(scenario, Number(session.difficulty || 1), body.message, newMessages.length)
      await adminClient
        .from('simulation_sessions')
        .update({ messages: [...newMessages, { role: 'assistant', content: reply }] })
        .eq('id', body.sessionId)
        .eq('user_id', appUser.id)
      return new Response(reply, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    clearTimeout(timeout)
    if (!response.ok || !response.body) {
      const reply = fallbackClientReply(scenario, Number(session.difficulty || 1), body.message, newMessages.length)
      await adminClient
        .from('simulation_sessions')
        .update({ messages: [...newMessages, { role: 'assistant', content: reply }] })
        .eq('id', body.sessionId)
        .eq('user_id', appUser.id)
      return new Response(reply, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    let fullResponse = ''
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(streamController) {
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
                await adminClient
                  .from('simulation_sessions')
                  .update({ messages: [...newMessages, { role: 'assistant', content: fullResponse }] })
                  .eq('id', body.sessionId)
                  .eq('user_id', appUser.id)
                streamController.close()
                return
              }

              try {
                const parsed = JSON.parse(data)
                const text = parsed.choices?.[0]?.delta?.content ?? ''
                if (text) {
                  fullResponse += text
                  streamController.enqueue(encoder.encode(text))
                }
              } catch {
                // Ignore partial JSON chunks.
              }
            }
          }
        } finally {
          if (fullResponse) {
            await adminClient
              .from('simulation_sessions')
              .update({ messages: [...newMessages, { role: 'assistant', content: fullResponse }] })
              .eq('id', body.sessionId)
              .eq('user_id', appUser.id)
          }
          streamController.close()
        }
      },
    })

    return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  if (body.action === 'feedback') {
    if (!body.sessionId) return json({ error: 'sessionId é obrigatório' }, 400)

    const { data: session } = await adminClient
      .from('simulation_sessions')
      .select('*')
      .eq('id', body.sessionId)
      .eq('user_id', appUser.id)
      .single()

    if (!session) return json({ error: 'Sessão não encontrada' }, 404)

    const scenario = session.scenario as ClientScenario
    const messages = (session.messages || []) as { role: string; content: string }[]
    const conversation = messages
      .map((message) => `${message.role === 'user' ? 'VENDEDOR' : 'CLIENTE'}: ${message.content}`)
      .join('\n')

    let feedback = fallbackFeedback(messages, scenario)
    if (isOpenAIConfigured() && messages.length > 0) {
      try {
        const result = await callOpenAIJSON<SimulationFeedback>({
          systemPrompt: `Você é uma mentora de vendas. Analise a conversa de simulação e retorne APENAS JSON com ponto_forte, erro_especifico, frase_ideal, nota de 1 a 10, skill_area (qualification, proposal, negotiation, closing, objection_handling, communication) e next_practice.`,
          userPrompt: `Cenário: ${JSON.stringify(scenario)}\nConversa:\n${conversation}`,
          temperature: 0.3,
          maxTokens: 500,
        })
        feedback = {
          ...feedback,
          ...result.data,
          nota: Math.min(10, Math.max(1, Number(result.data.nota || feedback.nota))),
          skill_area: result.data.skill_area || feedback.skill_area,
          next_practice: result.data.next_practice || feedback.next_practice,
        }
      } catch {
        feedback = fallbackFeedback(messages, scenario)
      }
    }

    const skillArea = feedback.skill_area || (feedback.nota >= 7 ? 'negotiation' : 'objection_handling')
    const managerId = await findManager(adminClient, appUser.organization_id)
    let gapId: string | null = null

    if (feedback.nota < 7) {
      const { data: gap } = await adminClient
        .from('pdi_gaps')
        .insert({
          organization_id: appUser.organization_id,
          user_id: appUser.id,
          gap_type: 'simulation_gap',
          skill_area: skillArea,
          title: `Gap em ${skillArea} detectado no simulador`,
          description: feedback.erro_especifico,
          detected_from: 'simulation',
          source_entity_type: 'simulation_session',
          source_entity_id: body.sessionId,
          severity: feedback.nota <= 4 ? 'high' : 'medium',
          confidence_score: 0.82,
          evidence: { scenario, feedback, conversation },
        })
        .select('id')
        .single()
      gapId = gap?.id ?? null
    }

    const planId = await createSimulationPlan(adminClient, {
      organizationId: appUser.organization_id,
      userId: appUser.id,
      managerId,
      gapId,
      skillArea,
      title: feedback.nota >= 7
        ? `Evidencia de evolucao: ${skillArea}`
        : `PDI aplicado: melhorar ${skillArea}`,
      feedback,
    })

    const { event } = await createEventWithImpacts(
      adminClient,
      {
        organizationId: appUser.organization_id,
        actorUserId: appUser.id,
        targetUserId: appUser.id,
        eventType: feedback.nota >= 7 ? 'pdi.evolution_proved' : 'pdi.gap_detected',
        sourceModule: 'simulation',
        entityType: 'simulation_session',
        entityId: body.sessionId,
        title: `Simulacao concluida com nota ${feedback.nota}/10`,
        description: feedback.erro_especifico,
        impactScore: feedback.nota * 8,
        priorityScore: feedback.nota < 7 ? 80 : 45,
        riskScore: feedback.nota < 7 ? 65 : 20,
        metadata: { scenario, feedback, gapId, planId },
      },
      [
        { impactedModule: 'pdi', impactedEntityType: gapId ? 'pdi_gap' : 'pdi_plan', impactedEntityId: gapId ?? planId ?? body.sessionId, impactType: feedback.nota >= 7 ? 'evolution_evidence' : 'gap_detected' },
        { impactedModule: 'xp', impactedEntityType: 'simulation_session', impactedEntityId: body.sessionId, impactType: 'simulation_evidence', impactValue: feedback.nota >= 6 ? feedback.nota * 5 : 0 },
        { impactedModule: 'ai', impactedEntityType: 'simulation_session', impactedEntityId: body.sessionId, impactType: 'coach_feedback' },
        { impactedModule: 'hoje', impactedEntityType: 'user', impactedEntityId: appUser.id, impactType: 'development_feedback' },
        { impactedModule: 'message', impactedEntityType: 'simulation_session', impactedEntityId: body.sessionId, impactType: 'coachable_moment' },
      ],
    )

    if (planId) {
      await adminClient.from('pdi_evolution_evidence').insert({
        organization_id: appUser.organization_id,
        plan_id: planId,
        user_id: appUser.id,
        source_entity_type: 'simulation_session',
        source_entity_id: body.sessionId,
        kpi_key: skillArea,
        baseline_value: 0,
        current_value: feedback.nota,
        delta_value: feedback.nota,
        evidence: { scenario, feedback, conversation, eventId: event.id },
      })

      const { data: application } = await adminClient
        .from('pdi_applications')
        .insert({
          organization_id: appUser.organization_id,
          plan_id: planId,
          user_id: appUser.id,
          application_type: 'simulation',
          description: `Simulacao aplicada: ${scenario.objecao_principal}. Nota ${feedback.nota}/10.`,
          evidence: { sessionId: body.sessionId, feedback, eventId: event.id },
          status: feedback.nota >= 7 ? 'validated' : 'submitted',
        })
        .select('id')
        .single()

      if (application) {
        await createEntityRelationship(adminClient, {
          organizationId: appUser.organization_id,
          fromEntityType: 'pdi_application',
          fromEntityId: application.id,
          toEntityType: 'simulation_session',
          toEntityId: body.sessionId,
          relationshipType: 'evidenced_by_simulation',
        })
      }
    }

    let xpAwarded = 0
    if (feedback.nota >= 6) {
      xpAwarded = feedback.nota * 5
      await awardXp(adminClient, {
        userId: appUser.id,
        organizationId: appUser.organization_id,
        amount: xpAwarded,
        sourceType: feedback.nota >= 7 ? 'kpi_improvement' : 'pdi_application',
        sourceId: body.sessionId,
        performanceEventId: event.id,
        evidence: { scenario, feedback, skillArea },
        impactExpected: 'Melhorar abordagem comercial e aplicar aprendizado em oportunidade real.',
        description: `+${xpAwarded} XP por concluir simulação com evidência de ${skillArea}`,
      })
    }

    await createRecommendation(adminClient, {
      organizationId: appUser.organization_id,
      eventId: event.id,
      targetUserId: appUser.id,
      createdByUserId: appUser.id,
      sourceModule: 'simulation',
      recommendationType: feedback.nota >= 7 ? 'next_action' : 'pdi_training',
      title: feedback.nota >= 7 ? 'Aplicar aprendizado em oportunidade real' : `Praticar ${skillArea} antes da próxima proposta`,
      description: feedback.next_practice || feedback.erro_especifico,
      suggestedActionLabel: feedback.nota >= 7 ? 'Abrir CRM' : 'Abrir Meu PDI',
      suggestedActionHref: feedback.nota >= 7 ? '/crm' : '/desenvolvimento/pdi',
      priority: feedback.nota < 7 ? 'high' : 'medium',
      metadata: { sessionId: body.sessionId, feedback, gapId, planId },
    })

    const finalFeedback: SimulationFeedback = {
      ...feedback,
      xp_awarded: xpAwarded,
      event_id: event.id,
      pdi_gap_id: gapId,
      pdi_plan_id: planId ?? null,
    }

    await adminClient
      .from('simulation_sessions')
      .update({ feedback: finalFeedback, completed: true })
      .eq('id', body.sessionId)
      .eq('user_id', appUser.id)

    return json({ feedback: finalFeedback })
  }

  return json({ error: 'Ação inválida' }, 400)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return json({ error: 'Não autorizado' }, 401)

  const adminClient = createAdminClient()
  const appUser = await loadAppUser(adminClient, authUser.id)
  if (!appUser) return json({ error: 'Usuário não encontrado' }, 404)

  const { data: sessions } = await adminClient
    .from('simulation_sessions')
    .select('id, scenario, difficulty, completed, feedback, created_at')
    .eq('user_id', appUser.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return json({ sessions: sessions || [] })
}
