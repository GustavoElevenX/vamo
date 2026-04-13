import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // ── Buscar contexto do negócio ──
  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('organization_id')
    .eq('auth_id', authUser.id)
    .single()

  let businessContext = ''

  if (dbUser?.organization_id) {
    const orgId = dbUser.organization_id

    // Buscar dados da organização + último diagnóstico + KPIs ativos em paralelo
    const [orgResult, diagResult, kpiResult, teamResult] = await Promise.all([
      supabase
        .from('organizations')
        .select('name, plan, settings')
        .eq('id', orgId)
        .single(),
      supabase
        .from('diagnostic_sessions')
        .select('company_context, health_pct, quadrant, area_scores')
        .eq('organization_id', orgId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('kpi_definitions')
        .select('name, unit, targets')
        .eq('organization_id', orgId)
        .eq('active', true)
        .limit(10),
      adminClient
        .from('users')
        .select('id, name, role')
        .eq('organization_id', orgId)
        .eq('active', true),
    ])

    const org = orgResult.data
    const diag = diagResult.data
    const kpis = kpiResult.data
    const team = teamResult.data

    const parts: string[] = []

    if (org) {
      parts.push(`Empresa: ${org.name}`)
    }

    if (diag?.company_context) {
      const ctx = diag.company_context as Record<string, unknown>
      if (ctx.segmento) parts.push(`Segmento: ${ctx.segmento}${ctx.subnicho ? ` (${ctx.subnicho})` : ''}`)
      if (ctx.num_vendedores) parts.push(`Vendedores: ${ctx.num_vendedores}`)
      if (ctx.modelo_vendas) parts.push(`Modelo de vendas: ${ctx.modelo_vendas}`)
      if (ctx.ticket_medio) parts.push(`Ticket médio: ${ctx.ticket_medio}`)
      if (ctx.ciclo_vendas) parts.push(`Ciclo de vendas: ${ctx.ciclo_vendas}`)
      if (ctx.meta_mensal) parts.push(`Meta mensal: ${ctx.meta_mensal}`)
      if (ctx.receita_atual) parts.push(`Receita atual: ${ctx.receita_atual}`)
      if (ctx.crm) parts.push(`CRM: ${ctx.crm}`)
      if (ctx.canal_leads) parts.push(`Canais de leads: ${Array.isArray(ctx.canal_leads) ? (ctx.canal_leads as string[]).join(', ') : ctx.canal_leads}`)
    }

    if (diag?.health_pct != null) {
      parts.push(`Saúde comercial: ${diag.health_pct}% (${diag.quadrant === 'critical' ? 'Crítico' : diag.quadrant === 'at_risk' ? 'Em Risco' : diag.quadrant === 'developing' ? 'Em Desenvolvimento' : 'Otimizado'})`)
    }

    if (kpis && kpis.length > 0) {
      const kpiList = kpis.map((k: { name: string; unit: string }) => `${k.name} (${k.unit})`).join(', ')
      parts.push(`KPIs ativos: ${kpiList}`)
    }

    if (team && team.length > 0) {
      const sellers = team.filter((t: { role: string }) => t.role === 'seller')
      const managers = team.filter((t: { role: string }) => t.role === 'manager')
      parts.push(`Equipe: ${sellers.length} vendedor(es), ${managers.length} gestor(es)`)
    }

    if (parts.length > 0) {
      businessContext = `\n\nCONTEXTO DO NEGÓCIO:\n${parts.join('\n')}`
    }
  }

  const systemPrompt = buildSystemPrompt(role, userName, businessContext)

  const openAIMessages = [{ role: 'system', content: systemPrompt }, ...messages]

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
        max_tokens: 1200,
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
    const err = await response.text().catch(() => '')
    return new Response(JSON.stringify({ error: `Erro OpenAI: ${err}` }), { status: 502 })
  }

  // ── Streaming com buffer para evitar texto quebrado ──
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')

          // Última linha pode estar incompleta — manter no buffer
          buffer = lines.pop() ?? ''

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
              // linha malformada, ignorar
            }
          }
        }

        // Processar o que restou no buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim()
          if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
            try {
              const parsed = JSON.parse(trimmed.slice(6))
              const text = parsed.choices?.[0]?.delta?.content ?? ''
              if (text) controller.enqueue(encoder.encode(text))
            } catch {
              // ignorar
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

function buildSystemPrompt(role: string, userName: string, businessContext: string): string {
  const firstName = userName.split(' ')[0]

  if (role === 'manager') {
    return `Você é a VAMO IA — consultora sênior de performance comercial com mais de 15 anos de experiência em gestão de times de vendas B2B e B2C.
Você está conversando com ${firstName}, gestor de vendas.
${businessContext}

COMO VOCÊ DEVE RESPONDER:
- Sempre considere o contexto do negócio acima (segmento, ticket, modelo, meta, equipe) para dar respostas personalizadas
- Nunca dê respostas genéricas de livro-texto. Fale como um mentor que conhece a operação de ${firstName}
- Use dados concretos quando disponíveis (KPIs, meta, receita, tamanho da equipe)
- Proponha ações específicas e executáveis — não conceitos vagos
- Quando sugerir algo, diga exatamente COMO implementar, com passos claros
- Se não tiver informação suficiente, pergunte antes de supor

SUAS ESPECIALIDADES:
- Diagnóstico e correção de funil de vendas
- Estruturação de comissionamento e metas por perfil de vendedor
- Criação de missões gamificadas que movem indicadores reais
- Coaching de vendedores com base em dados de performance
- Identificação de riscos (desmotivação, queda de conversão, churn de equipe)
- Desenho de planos de ação semanais priorizados por impacto

TOM: Direto, estratégico, consultivo. Fale como parceiro(a) de negócio, não como assistente genérico.
IDIOMA: Português brasileiro.
FORMATO: Escreva em texto corrido, sem listas, sem bullet points, sem marcadores, sem negrito (não use ** ou * ou - para formatar). Respostas diretas e objetivas, máximo 4 parágrafos. Nunca use markdown.`
  }

  return `Você é a VAMO IA — coach de vendas sênior com mais de 15 anos de experiência no campo, especialista em transformar vendedores bons em vendedores excepcionais.
Você está conversando com ${firstName}, vendedor.
${businessContext}

COMO VOCÊ DEVE RESPONDER:
- Sempre considere o contexto do negócio (segmento, ticket médio, ciclo de vendas, meta) para personalizar suas dicas
- Nunca dê conselhos genéricos. Fale como alguém que já vendeu no segmento de ${firstName}
- Dê exemplos práticos e scripts prontos para usar HOJE
- Quando falar de técnica (SPIN, Challenger, etc.), aplique ao contexto real — não explique teoria
- Celebre conquistas e seja direto sobre o que precisa melhorar
- Se não tiver informação suficiente sobre o cenário, pergunte

SUAS ESPECIALIDADES:
- Técnicas de prospecção ativa e passiva
- Construção de rapport e abordagem consultiva
- Quebra de objeções (preço, concorrência, timing, "vou pensar")
- Negociação e fechamento (urgência, ancoragem, alternativas)
- Follow-up estratégico que converte sem ser invasivo
- Scripts e frases prontas para cada etapa do funil
- Gestão de pipeline e priorização de oportunidades

TOM: Motivador, prático, direto. Fale como um mentor que já passou pelas mesmas trincheiras. Use linguagem de vendedor.
IDIOMA: Português brasileiro.
FORMATO: Escreva em texto corrido, sem listas, sem bullet points, sem marcadores, sem negrito (não use ** ou * ou - para formatar). Quando mostrar scripts ou exemplos de fala, coloque-os em linha, dentro do texto. Nunca use markdown. Máximo 4 parágrafos.`
}
