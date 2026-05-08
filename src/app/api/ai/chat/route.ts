import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildCommercialBrainContext } from '@/lib/services/commercial-brain.service'

export const runtime = 'nodejs'

// ── OpenAI Tools (function calling) ──
const MANAGER_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'analyze_operation',
      description: 'Analisar a operacao comercial atual usando o Commercial Brain: forecast, gap, equipe em atencao, riscos e acoes recomendadas. Use para perguntas de diagnostico.',
      parameters: {
        type: 'object',
        properties: {
          focus: { type: 'string', description: 'Foco opcional: forecast, equipe, execucao, pdi, comissao ou geral' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'simulate_decision',
      description: 'Simular uma decisao comercial sem alterar dados: comissao, meta, forecast, foco em pipeline parado, redistribuicao de esforco.',
      parameters: {
        type: 'object',
        properties: {
          scenario: { type: 'string', description: 'Cenario a simular' },
          variable: { type: 'string', description: 'Variavel principal: comissao, meta, forecast, pipeline, esforco' },
          value: { type: 'number', description: 'Valor numerico opcional da mudanca' },
        },
        required: ['scenario'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_manager_briefing',
      description: 'Gerar briefing gerencial diario/semana com base no Commercial Brain, sem salvar briefing semanal tradicional.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['daily', 'weekly'], description: 'Periodo do briefing' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_meeting_agenda',
      description: 'Gerar uma pauta de reuniao para time ou 1:1 com vendedor usando dados reais da operacao.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor se for pauta 1:1' },
          meeting_type: { type: 'string', enum: ['team', 'one_on_one'], description: 'Tipo de reuniao' },
          objective: { type: 'string', description: 'Objetivo da reuniao' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_action_plan',
      description: 'Criar um plano de acao gerencial com itens rastreaveis. Use quando o gestor pedir plano de acao, plano semanal, recuperacao da operacao ou conjunto de acoes.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Titulo do plano' },
          summary: { type: 'string', description: 'Resumo executivo do plano' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                target_user_id: { type: 'string', description: 'ID do vendedor alvo, se houver' },
                action_type: { type: 'string', description: 'Tipo: mission, nudge, meeting, pdi, crm, commission, recognition' },
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                due_at: { type: 'string', description: 'Data limite ISO opcional' },
              },
              required: ['action_type', 'title', 'description'],
            },
          },
        },
        required: ['title', 'summary', 'items'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_recovery_mission',
      description: 'Criar missao de recuperacao de pipeline para um vendedor com base nos riscos atuais.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor' },
          title: { type: 'string' },
          description: { type: 'string' },
          target_value: { type: 'number', description: 'Meta numerica da missao' },
          xp_reward: { type: 'number' },
          deadline: { type: 'string', description: 'Prazo ISO opcional' },
        },
        required: ['user_id', 'title', 'description'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_pdi_plan',
      description: 'Criar um PDI para vendedor baseado em gap real ou necessidade de desenvolvimento.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor' },
          title: { type: 'string', description: 'Titulo do PDI' },
          description: { type: 'string', description: 'Descricao do desenvolvimento esperado' },
          due_date: { type: 'string', description: 'Data limite no formato YYYY-MM-DD' },
          target_kpi_key: { type: 'string', description: 'KPI alvo opcional' },
          target_value: { type: 'number', description: 'Valor alvo opcional' },
        },
        required: ['user_id', 'title', 'description'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_manager_nudge',
      description: 'Criar nudge gerencial para vendedor: cobranca, reconhecimento ou orientacao. Pode enviar notificacao real.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor' },
          message: { type: 'string', description: 'Mensagem do nudge' },
          tone: { type: 'string', enum: ['charge', 'recognition', 'coaching'], description: 'Tom do nudge' },
        },
        required: ['user_id', 'message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mark_recommendation_done',
      description: 'Marcar uma recomendacao aberta como concluida/fechada.',
      parameters: {
        type: 'object',
        properties: {
          recommendation_id: { type: 'string', description: 'ID da recomendacao' },
          note: { type: 'string', description: 'Observacao opcional' },
        },
        required: ['recommendation_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_seller',
      description: 'Cadastrar um novo vendedor na equipe. Use quando o gestor pedir para adicionar, cadastrar ou convidar um vendedor.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome completo do vendedor' },
          email: { type: 'string', description: 'Email do vendedor' },
        },
        required: ['name', 'email'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_mission',
      description: 'Criar uma missão gamificada para um vendedor ou para a equipe. Use quando o gestor pedir para criar, montar, definir ou atribuir uma missão.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título curto da missão' },
          description: { type: 'string', description: 'Descrição detalhada do que o vendedor deve fazer' },
          area: { type: 'string', enum: ['lead_generation', 'sales_process', 'team_management', 'tools_technology'], description: 'Área da missão' },
          difficulty: { type: 'number', enum: [1, 2, 3], description: '1=fácil, 2=média, 3=difícil' },
          xp_reward: { type: 'number', description: 'XP de recompensa (10-200)' },
          commission_bonus: { type: 'number', description: 'Bônus em R$ pago ao vendedor ao concluir a missão (opcional, ex: 50)' },
          user_id: { type: 'string', description: 'ID obrigatório do vendedor ativo que receberá a missão. Nunca omita este campo.' },
        },
        required: ['title', 'description', 'user_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'define_kpi',
      description: 'Criar um novo indicador/KPI para a equipe. Use quando o gestor pedir para criar, definir ou adicionar um KPI.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do KPI (ex: Ligações realizadas)' },
          unit: { type: 'string', description: 'Unidade de medida (ex: un, R$, %)' },
          points_per_unit: { type: 'number', description: 'Pontos de XP por unidade registrada' },
          targets: {
            type: 'object',
            properties: {
              daily: { type: 'number', description: 'Meta diária' },
            },
          },
        },
        required: ['name', 'unit'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_goal',
      description: 'Definir ou alterar a meta de um KPI existente. Use quando o gestor pedir para definir, mudar ou ajustar uma meta.',
      parameters: {
        type: 'object',
        properties: {
          kpi_id: { type: 'string', description: 'ID do KPI' },
          target_value: { type: 'number', description: 'Valor da meta' },
          period: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Período da meta' },
        },
        required: ['kpi_id', 'target_value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'award_xp',
      description: 'Conceder XP de bônus a um vendedor. Use quando o gestor pedir para dar, conceder, premiar XP.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor que receberá o XP' },
          amount: { type: 'number', description: 'Quantidade de XP (1-500)' },
          description: { type: 'string', description: 'Motivo do bônus' },
        },
        required: ['user_id', 'amount'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_briefing',
      description: 'Gerar o briefing semanal da equipe com análise de performance. Use quando o gestor pedir briefing, resumo semanal, análise da semana.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_retrospective',
      description: 'Gerar a retrospectiva mensal com análise do ciclo. Use quando o gestor pedir retrospectiva, resumo do mês, análise mensal.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_challenge',
      description: 'Criar um desafio/sprint para a equipe. Use quando o gestor pedir para criar desafio, competição, sprint.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título do desafio' },
          description: { type: 'string', description: 'Descrição do desafio' },
          type: { type: 'string', enum: ['individual', 'team'], description: 'Tipo do desafio' },
          xp_reward: { type: 'number', description: 'XP de recompensa' },
          bonus_reward: { type: 'number', description: 'Bônus em R$ (opcional)' },
          start_date: { type: 'string', description: 'Data início (ISO)' },
          end_date: { type: 'string', description: 'Data fim (ISO)' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'register_kpi_value',
      description: 'Registrar valor de KPI para um vendedor. Use quando o gestor pedir para registrar, lançar, contabilizar KPI.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor' },
          kpi_id: { type: 'string', description: 'ID do KPI' },
          value: { type: 'number', description: 'Valor a registrar' },
        },
        required: ['user_id', 'kpi_id', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_seller',
      description: 'Editar dados de um vendedor existente (nome, email, ativar/desativar). Use quando o gestor pedir para atualizar, mudar, corrigir dados de um vendedor.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor (da lista de membros da equipe)' },
          name: { type: 'string', description: 'Novo nome (omitir se não mudar)' },
          email: { type: 'string', description: 'Novo email (omitir se não mudar)' },
          active: { type: 'boolean', description: 'true=ativar, false=desativar' },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'remove_seller',
      description: 'Remover ou desativar um vendedor da equipe. Use quando o gestor pedir para remover, deletar, excluir, desativar um vendedor.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor' },
          permanent: { type: 'boolean', description: 'true=exclusão permanente (sem volta), false=apenas desativar (padrão, recomendado)' },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_mission',
      description: 'Editar uma missão existente (título, descrição, XP, dificuldade, status). Use quando o gestor pedir para editar, atualizar ou alterar uma missão.',
      parameters: {
        type: 'object',
        properties: {
          mission_id: { type: 'string', description: 'ID da missão' },
          title: { type: 'string', description: 'Novo título (omitir se não mudar)' },
          description: { type: 'string', description: 'Nova descrição (omitir se não mudar)' },
          xp_reward: { type: 'number', description: 'Novo XP de recompensa' },
          difficulty: { type: 'number', enum: [1, 2, 3], description: 'Nova dificuldade' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'Novo status' },
        },
        required: ['mission_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_mission',
      description: 'Excluir uma missão permanentemente. Use quando o gestor pedir para excluir, deletar ou remover uma missão.',
      parameters: {
        type: 'object',
        properties: {
          mission_id: { type: 'string', description: 'ID da missão' },
        },
        required: ['mission_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_kpi',
      description: 'Editar um KPI existente (nome, unidade, pontos por unidade, ativar/desativar). Use quando o gestor pedir para editar, atualizar ou alterar um KPI.',
      parameters: {
        type: 'object',
        properties: {
          kpi_id: { type: 'string', description: 'ID do KPI' },
          name: { type: 'string', description: 'Novo nome (omitir se não mudar)' },
          unit: { type: 'string', description: 'Nova unidade' },
          points_per_unit: { type: 'number', description: 'Novos pontos por unidade' },
          active: { type: 'boolean', description: 'true=ativar, false=desativar' },
        },
        required: ['kpi_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_kpi',
      description: 'Desativar um KPI (preserva histórico). Use quando o gestor pedir para remover, excluir ou desativar um KPI.',
      parameters: {
        type: 'object',
        properties: {
          kpi_id: { type: 'string', description: 'ID do KPI' },
        },
        required: ['kpi_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'notify_seller',
      description: 'Enviar uma notificação curta (push) para um vendedor ou toda a equipe. Use apenas quando o gestor quiser avisar, notificar, disparar um aviso rápido que NÃO precisa de resposta.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor destinatário. Use "all" para enviar para toda a equipe.' },
          message: { type: 'string', description: 'Texto da notificação (máx 500 chars)' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_goal_rewards',
      description: 'Configurar XP e/ou bônus em R$ para a meta individual de um vendedor. Use quando o gestor pedir para definir, alterar ou ajustar as recompensas de uma meta.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor' },
          xp_reward: { type: 'number', description: 'Pontos XP pela conclusão da meta (ex: 100)' },
          commission_bonus: { type: 'number', description: 'Bônus em R$ pela conclusão da meta (ex: 150)' },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_goal_status',
      description: 'Atualizar o status da meta individual de um vendedor. Use quando o gestor pedir para marcar como concluída, iniciar, ou resetar a meta de um vendedor.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Novo status da meta' },
        },
        required: ['user_id', 'status'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'send_chat_message',
      description: 'Abrir uma conversa de chat (1:1 ou grupo) e enviar uma mensagem. Use quando o gestor pedir explicitamente para "mandar mensagem para X", "enviar mensagem", "falar com X", "abrir chat com X", "conversar com X". Cria uma conversa bidirecional real — o vendedor pode responder.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'ID do vendedor destinatário para mensagem 1:1. Omitir se for mensagem em grupo.' },
          user_ids: { type: 'array', items: { type: 'string' }, description: 'IDs dos participantes para mensagem em grupo. Use quando o gestor quiser falar com múltiplos vendedores numa única conversa. Omitir para 1:1.' },
          group_name: { type: 'string', description: 'Nome do grupo (obrigatório se user_ids for informado). Ex: "Equipe Comercial", "Time A".' },
          message: { type: 'string', description: 'Texto da mensagem (máx 2000 chars)' },
        },
        required: ['message'],
      },
    },
  },
]

const ACTION_LABELS: Record<string, string> = {
  analyze_operation: 'Analisar Operacao',
  simulate_decision: 'Simular Decisao',
  generate_manager_briefing: 'Gerar Briefing Gerencial',
  generate_meeting_agenda: 'Gerar Pauta',
  create_action_plan: 'Criar Plano de Acao',
  create_pdi_plan: 'Criar PDI',
  create_recovery_mission: 'Criar Missao de Recuperacao',
  create_manager_nudge: 'Criar Nudge do Gestor',
  mark_recommendation_done: 'Concluir Recomendacao',
  add_seller: 'Cadastrar Vendedor',
  edit_seller: 'Editar Vendedor',
  remove_seller: 'Remover Vendedor',
  create_mission: 'Criar Missão',
  edit_mission: 'Editar Missão',
  delete_mission: 'Excluir Missão',
  define_kpi: 'Definir KPI',
  edit_kpi: 'Editar KPI',
  delete_kpi: 'Desativar KPI',
  set_goal: 'Definir Meta',
  award_xp: 'Conceder XP',
  generate_briefing: 'Gerar Briefing Semanal',
  generate_retrospective: 'Gerar Retrospectiva Mensal',
  create_challenge: 'Criar Desafio',
  register_kpi_value: 'Registrar acao comercial',
  notify_seller: 'Enviar Notificação',
  send_chat_message: 'Enviar Mensagem no Chat',
}

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
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  let businessContext = ''
  let teamContext = ''
  let kpiContext = ''
  let operationContext = ''

  if (dbUser?.organization_id) {
    const orgId = dbUser.organization_id

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
        .select('id, name, unit, targets')
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

    // Contexto de equipe COM IDs para function calling
    if (team && team.length > 0) {
      const sellers = team.filter((t: { role: string }) => t.role === 'seller')
      const managers = team.filter((t: { role: string }) => t.role === 'manager')
      parts.push(`Equipe: ${sellers.length} vendedor(es), ${managers.length} gestor(es)`)

      if (sellers.length > 0) {
        teamContext = '\n\nMEMBROS DA EQUIPE (use estes IDs nas ações):\n' +
          sellers.map((s: { id: string; name: string }) => `- ${s.name} (id: ${s.id})`).join('\n')
      }
    }

    // Contexto de KPIs COM IDs para function calling
    if (kpis && kpis.length > 0) {
      const kpiList = kpis.map((k: { name: string; unit: string }) => `${k.name} (${k.unit})`).join(', ')
      parts.push(`KPIs ativos: ${kpiList}`)

      kpiContext = '\n\nKPIs DISPONÍVEIS (use estes IDs nas ações):\n' +
        kpis.map((k: { id: string; name: string; unit: string; targets: unknown }) =>
          `- ${k.name} (id: ${k.id}, unidade: ${k.unit}, metas: ${JSON.stringify(k.targets || {})})`
        ).join('\n')
    }

    if (parts.length > 0) {
      businessContext = `\n\nCONTEXTO DO NEGÓCIO:\n${parts.join('\n')}`
    }
  }

  if (dbUser?.organization_id && role === 'manager') {
    try {
      const commercialBrain = await buildCommercialBrainContext(
        adminClient,
        dbUser.organization_id,
        dbUser.id,
        userName,
      )
      operationContext = commercialBrain.llmContext
    } catch (error) {
      console.error('Commercial Brain context error:', error)
      operationContext = '\n\nCONTEXTO OPERACIONAL DO GESTOR: indisponivel nesta mensagem. Responda com base no contexto de negocio e equipe disponivel.'
    }
  }

  const isManager = role === 'manager'
  const systemPrompt = buildSystemPrompt(role, userName, businessContext, teamContext, kpiContext, operationContext)
  const openAIMessages = [{ role: 'system', content: systemPrompt }, ...messages]

  // ── Request com tools (apenas para gestores) ──
  const requestBody: Record<string, unknown> = {
    model: 'gpt-4o-mini',
    messages: openAIMessages,
    stream: true,
    max_tokens: 1500,
    // Temperatura mais baixa para gestores = modelo mais determinístico
    // e menos propenso a gerar texto sem chamar a tool quando deveria
    temperature: isManager ? 0.3 : 0.7,
  }

  if (isManager) {
    requestBody.tools = MANAGER_TOOLS
    requestBody.tool_choice = 'auto'
    requestBody.parallel_tool_calls = false // Uma ação por vez, sempre
  }

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
      body: JSON.stringify(requestBody),
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

  // ── Streaming com suporte a tool_calls ──
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // Acumular tool call se houver
      let toolCallName = ''
      let toolCallArgs = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') {
              // Se houve tool call, emitir o delimitador de ação
              if (toolCallName) {
                let parsedArgs: Record<string, unknown> = {}
                try {
                  parsedArgs = JSON.parse(toolCallArgs)
                } catch {
                  parsedArgs = {}
                }

                const actionLabel = ACTION_LABELS[toolCallName] || toolCallName
                const actionJson = JSON.stringify({
                  action: toolCallName,
                  params: parsedArgs,
                  summary: `${actionLabel}: ${summarizeParams(toolCallName, parsedArgs)}`,
                })
                controller.enqueue(encoder.encode(`\n---ACTION---\n${actionJson}`))
              }
              controller.close()
              return
            }
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta

              // Texto normal
              const text = delta?.content ?? ''
              if (text) controller.enqueue(encoder.encode(text))

              // Tool calls
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.function?.name) toolCallName = tc.function.name
                  if (tc.function?.arguments) toolCallArgs += tc.function.arguments
                }
              }
            } catch {
              // linha malformada, ignorar
            }
          }
        }

        // Buffer restante
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

        // Se acabou sem [DONE] mas tinha tool call
        if (toolCallName) {
          let parsedArgs: Record<string, unknown> = {}
          try {
            parsedArgs = JSON.parse(toolCallArgs)
          } catch {
            parsedArgs = {}
          }
          const actionLabel = ACTION_LABELS[toolCallName] || toolCallName
          const actionJson = JSON.stringify({
            action: toolCallName,
            params: parsedArgs,
            summary: `${actionLabel}: ${summarizeParams(toolCallName, parsedArgs)}`,
          })
          controller.enqueue(encoder.encode(`\n---ACTION---\n${actionJson}`))
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

function summarizeParams(action: string, params: Record<string, unknown>): string {
  switch (action) {
    case 'analyze_operation':
      return `Foco: ${params.focus || 'geral'}`
    case 'simulate_decision':
      return `${params.scenario || 'cenario'}${params.value != null ? ` (${params.value})` : ''}`
    case 'generate_manager_briefing':
      return `Periodo: ${params.period || 'daily'}`
    case 'generate_meeting_agenda':
      return `${params.meeting_type || 'team'}${params.user_id ? ` - ID: ${params.user_id}` : ''}`
    case 'create_action_plan':
      return `"${params.title || '?'}" - ${Array.isArray(params.items) ? params.items.length : 0} itens`
    case 'create_pdi_plan':
      return `ID: ${params.user_id || '?'} - "${params.title || 'PDI'}"`
    case 'create_recovery_mission':
      return `ID: ${params.user_id || '?'} - "${params.title || 'recuperacao'}"`
    case 'create_manager_nudge':
      return `ID: ${params.user_id || '?'} - ${params.tone || 'coaching'}`
    case 'mark_recommendation_done':
      return `ID: ${params.recommendation_id || '?'}`
    case 'add_seller':
      return `${params.name || '?'} (${params.email || '?'})`
    case 'edit_seller':
      return `ID: ${params.user_id || '?'}${params.name ? ` → nome: ${params.name}` : ''}${params.email ? ` → email: ${params.email}` : ''}${params.active !== undefined ? ` → ${params.active ? 'ativar' : 'desativar'}` : ''}`
    case 'remove_seller':
      return `ID: ${params.user_id || '?'} (${params.permanent ? 'permanente' : 'desativar'})`
    case 'create_mission':
      return `"${params.title || '?'}" — ${params.xp_reward || 50} XP`
    case 'edit_mission':
      return `ID: ${params.mission_id || '?'}${params.title ? ` → "${params.title}"` : ''}`
    case 'delete_mission':
      return `ID: ${params.mission_id || '?'}`
    case 'define_kpi':
      return `"${params.name || '?'}" em ${params.unit || 'un'}`
    case 'edit_kpi':
      return `ID: ${params.kpi_id || '?'}${params.name ? ` → "${params.name}"` : ''}`
    case 'delete_kpi':
      return `ID: ${params.kpi_id || '?'}`
    case 'set_goal':
      return `Meta ${params.period || 'daily'}: ${params.target_value ?? '?'}`
    case 'award_xp':
      return `${params.amount || '?'} XP — ${params.description || 'bônus'}`
    case 'generate_briefing':
      return 'Análise da semana atual'
    case 'generate_retrospective':
      return 'Análise do mês atual'
    case 'create_challenge':
      return `"${params.title || '?'}" — ${params.xp_reward || 100} XP`
    case 'register_kpi_value':
      return `${params.value ?? '?'} unidades`
    case 'notify_seller':
      return `${params.user_id === 'all' || !params.user_id ? 'Toda a equipe' : `ID: ${params.user_id}`} — "${String(params.message || '').slice(0, 40)}${String(params.message || '').length > 40 ? '…' : ''}"`
    case 'send_chat_message': {
      const target = Array.isArray(params.user_ids) && params.user_ids.length > 0
        ? `Grupo "${params.group_name || 'sem nome'}" (${(params.user_ids as string[]).length} pessoas)`
        : params.user_id
          ? `ID: ${params.user_id}`
          : 'destinatário?'
      const msg = String(params.message || '')
      return `${target} — "${msg.slice(0, 40)}${msg.length > 40 ? '…' : ''}"`
    }
    default:
      return JSON.stringify(params)
  }
}

function buildSystemPrompt(role: string, userName: string, businessContext: string, teamContext: string, kpiContext: string, operationContext = ''): string {
  const firstName = userName.split(' ')[0]

  if (role === 'manager') {
    return `Você é a VAMO IA — consultora sênior de performance comercial com mais de 15 anos de experiência em gestão de times de vendas B2B e B2C.
Você está conversando com ${firstName}, gestor de vendas.
${businessContext}${teamContext}${kpiContext}${operationContext}

COMO VOCÊ DEVE RESPONDER:
- Sempre considere o contexto do negócio acima (segmento, ticket, modelo, meta, equipe) para dar respostas personalizadas
- Nunca dê respostas genéricas de livro-texto. Fale como um mentor que conhece a operação de ${firstName}
- Use dados concretos quando disponíveis (KPIs, meta, receita, tamanho da equipe)
- Proponha ações específicas e executáveis — não conceitos vagos
- Quando sugerir algo, diga exatamente COMO implementar, com passos claros
- Se não tiver informação suficiente, pergunte antes de supor

REGRA DE OURO — AÇÕES (LEIA COM ATENÇÃO):
Quando ${firstName} pedir uma ação E você tiver os dados necessários, chame a tool NESTA MESMA RESPOSTA. NÃO escreva o que vai fazer e espere — chame a tool agora.
Fluxo correto: texto opcional brevíssimo (1 frase, opcional) → tool call.
Fluxo ERRADO: escrever um parágrafo descrevendo o que vai fazer sem chamar a tool.

AÇÕES DISPONÍVEIS:
Se ${firstName} pedir para adicionar vendedor, criar missão, definir KPI, dar XP, gerar briefing, criar desafio, registrar acao comercial — use a tool correspondente IMEDIATAMENTE.
Nunca diga "você pode fazer isso em tal página" — faça você mesma via tool.

CHAT DA EQUIPE:
- Quando ${firstName} pedir "mandar mensagem para X", "enviar mensagem para X", "falar com X no chat", "abrir chat com X", "avisar X" → use send_chat_message. Isso abre uma conversa bidirecional real (o vendedor pode responder).
- Para mensagem 1:1, use send_chat_message com user_id (um vendedor da lista).
- Para mensagem em grupo, use send_chat_message com user_ids + group_name.
- Diferença para notify_seller: notify_seller é um aviso unidirecional/push; send_chat_message abre o chat real onde o vendedor responde.
Se faltar dado obrigatório (ex: email), pergunte de forma direta e curta. Nada mais.

MISSÕES E VENDEDORES (CRÍTICO):
Ao criar missão via create_mission, use SEMPRE o user_id exato da lista MEMBROS DA EQUIPE acima.
Se ${firstName} mencionar um vendedor pelo nome e esse nome NÃO aparece na lista de membros, NÃO invente nem suponha um user_id.
Responda imediatamente: "Não encontrei [nome mencionado] na equipe cadastrada. Deseja que eu o cadastre agora? Me passe o email dele para continuar."
Se ${firstName} confirmar e fornecer o email, chame add_seller imediatamente e, após cadastrar, crie a missão para o vendedor recém-cadastrado.
Se a lista MEMBROS DA EQUIPE estiver vazia (sem vendedores), informe ${firstName} que a equipe ainda não tem vendedores cadastrados e ofereça cadastrar o primeiro via add_seller.

MÚLTIPLAS AÇÕES:
Se o usuário pedir N ações (ex: "cadastre 2 vendedores"), proponha a PRIMEIRA agora e diga que vai propor a próxima após aprovação. Nunca tente propor as duas ao mesmo tempo.
Exemplo: usuário pede 2 vendedores → você chama a tool para o 1º → após aprovado, chama para o 2º.

DADOS INCOMPLETOS:
Se o usuário fornecer dados parciais (ex: só email sem nome), use um nome razoável baseado no email ou no contexto e avance. Não trave pedindo confirmação de cada campo.
Exemplo: email "joao@empresa.com" sem nome → use "João" como nome.

GERENCIAMENTO DE CORREÇÕES (CRÍTICO):
- No histórico você verá: [AÇÃO FALHOU: ...], [AÇÃO EXECUTADA: ...], [AÇÃO AGUARDANDO APROVAÇÃO: ...]
- [AGUARDANDO APROVAÇÃO] → NÃO proponha de novo. Diga "o card já está aguardando sua confirmação."
- [FALHOU] → Quando o usuário fornecer dado corrigido, use IMEDIATAMENTE o novo valor. Não pergunte.
- Correção como "usa esse email: x", "muda para x", "tenta x" → EXTRAIA o valor e chame a tool corrigida.
- Nunca repita params que já falharam. Mantenha dados que não foram corrigidos (ex: se só o email mudou, mantenha o nome anterior).

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
