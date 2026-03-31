import { Page, Route } from '@playwright/test'

/** Respostas mock para cada endpoint de IA */
const AI_MOCKS: Record<string, object | string> = {
  '/api/ai/briefing-semanal': {
    o_que_foi_bem: 'A equipe superou a meta de ligações em 20% esta semana.',
    o_que_preocupa: 'Taxa de conversão caiu 5% comparado à semana anterior.',
    quem_precisa_atencao: 'Vendedor com menor número de propostas enviadas.',
    prioridade_semana: 'Foco em follow-up de propostas abertas há mais de 3 dias.',
    acao_recomendada: 'Realizar reunião de alinhamento de pitch na terça-feira.',
  },

  '/api/ai/retrospectiva': {
    o_que_foi_prometido: 'Meta de 50 vendas no ciclo e implementação de novo script.',
    o_que_foi_entregue: '47 vendas realizadas (94% da meta) e script em uso por 80% da equipe.',
    impacto_financeiro: 'Receita de R$ 235.000 no ciclo, 12% acima do ciclo anterior.',
    fica_pro_proximo: 'Melhorar taxa de reativação de leads frios (atual 8%, meta 15%).',
    recomendacao_proximo_ciclo: 'Implementar cadência estruturada de reativação com VAMO IA.',
  },

  '/api/ai/simulador': {
    ponto_forte: 'Você apresentou o produto com clareza e identificou a dor do cliente.',
    erro_especifico: 'Não contornou a objeção de preço — aceitou a resistência sem propor alternativas.',
    frase_ideal: '"Entendo sua preocupação com o investimento. Vamos ver juntos o retorno que você pode ter em 90 dias..."',
    nota: 7,
    nivel: 'Bom',
  },

  '/api/ai/generate-missions': {
    missions: [
      {
        title: 'Sprint de Ligações',
        description: 'Realizar 20 ligações de prospecção até sexta-feira.',
        xp_reward: 150,
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        title: 'Enviar 5 Propostas',
        description: 'Enviar propostas para leads qualificados na pipeline.',
        xp_reward: 200,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },

  '/api/ai/behavioral-profile': {
    perfil: 'Comunicador',
    descricao: 'Você tem facilidade para criar rapport e engajar clientes emocionalmente.',
    pontos_fortes: ['Empatia', 'Comunicação', 'Construção de relacionamento'],
    areas_desenvolvimento: ['Fechamento direto', 'Gestão de objeções técnicas'],
    dica: 'Pratique fechamentos mais assertivos ao final das apresentações.',
  },

  '/api/ai/coach-tip': {
    tip: 'Comece o dia revisando suas propostas abertas e faça um follow-up rápido.',
    category: 'produtividade',
  },

  '/api/ai/diagnostic-analysis': {
    summary: 'Empresa em estágio "Em Desenvolvimento" com oportunidades claras em geração de leads.',
    recommendations: [
      'Estruturar processo de qualificação de leads',
      'Implementar CRM para rastreabilidade do funil',
    ],
  },
}

/** Intercepta todas as rotas /api/ai/* e retorna respostas mock */
export async function mockAIRoutes(page: Page) {
  await page.route('/api/ai/**', async (route: Route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname

    // Busca mock exato ou parcial
    const mockKey = Object.keys(AI_MOCKS).find(
      (k) => pathname === k || pathname.startsWith(k)
    )

    if (mockKey) {
      const mockResponse = AI_MOCKS[mockKey]

      // Para o endpoint de chat, simula um stream SSE simples
      if (pathname.includes('/api/ai/chat')) {
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          body: [
            'data: {"choices":[{"delta":{"content":"Olá! Sou o VAMO IA. Como posso ajudar?"}}]}\n\n',
            'data: [DONE]\n\n',
          ].join(''),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse),
      })
    } else {
      // Passa adiante se não houver mock
      await route.continue()
    }
  })
}
