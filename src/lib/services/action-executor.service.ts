import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActionType, ActionResult } from '@/types/chat'
import { awardXp } from './xp.service'
import { registerExecutionEvent, type ExecutionEventType } from './execution.service'
import { ensureSellerSetup } from './seller-setup.service'
import {
  findOrCreateDirectConversation,
  createGroupConversation,
  sendChatMessage,
} from './chat.service'
import { buildCommercialBrainContext } from './commercial-brain.service'
import { createPerformanceEvent } from './performance-os.service'

export async function executeAction(
  adminClient: SupabaseClient,
  supabase: SupabaseClient,
  actionType: ActionType,
  params: Record<string, unknown>,
  orgId: string,
  executorUserId: string
): Promise<ActionResult> {
  switch (actionType) {
    case 'analyze_operation':
      return analyzeOperation(adminClient, params, orgId, executorUserId)
    case 'simulate_decision':
      return simulateDecision(adminClient, params, orgId, executorUserId)
    case 'generate_manager_briefing':
      return generateManagerBriefing(adminClient, params, orgId, executorUserId)
    case 'generate_meeting_agenda':
      return generateMeetingAgenda(adminClient, params, orgId, executorUserId)
    case 'create_action_plan':
      return createActionPlan(adminClient, params, orgId, executorUserId)
    case 'create_pdi_plan':
      return createPdiPlan(adminClient, params, orgId, executorUserId)
    case 'create_recovery_mission':
      return createRecoveryMission(adminClient, params, orgId, executorUserId)
    case 'create_manager_nudge':
      return createManagerNudge(adminClient, params, orgId, executorUserId)
    case 'mark_recommendation_done':
      return markRecommendationDone(adminClient, params, orgId, executorUserId)
    case 'add_seller':
      return addSeller(adminClient, params, orgId)
    case 'edit_seller':
      return editSeller(adminClient, params, orgId)
    case 'remove_seller':
      return removeSeller(adminClient, params, orgId)
    case 'create_mission':
      return createMission(adminClient, params, orgId, executorUserId)
    case 'edit_mission':
      return editMission(adminClient, params, orgId)
    case 'delete_mission':
      return deleteMission(adminClient, params, orgId)
    case 'define_kpi':
      return defineKpi(adminClient, params, orgId)
    case 'edit_kpi':
      return editKpi(adminClient, params, orgId)
    case 'delete_kpi':
      return deleteKpi(adminClient, params, orgId)
    case 'set_goal':
      return setGoal(adminClient, params, orgId)
    case 'award_xp':
      return awardXpAction(supabase, params, orgId)
    case 'generate_briefing':
      return generateBriefing(supabase, adminClient, orgId, executorUserId)
    case 'generate_retrospective':
      return generateRetrospective(supabase, adminClient, orgId)
    case 'create_challenge':
      return createChallenge(adminClient, params, orgId)
    case 'register_kpi_value':
      return registerKpiValue(adminClient, params, orgId, executorUserId)
    case 'notify_seller':
      return notifySeller(adminClient, params, orgId, executorUserId)
    case 'send_chat_message':
      return sendChatMessageAction(adminClient, params, orgId, executorUserId)
    case 'set_goal_rewards':
      return setGoalRewards(adminClient, params, orgId)
    case 'update_goal_status':
      return updateGoalStatus(adminClient, params, orgId)
    default:
      return { success: false, message: `Ação desconhecida: ${actionType}` }
  }
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

// ── Add Seller ──
async function getExecutorName(adminClient: SupabaseClient, userId: string) {
  const { data } = await adminClient.from('users').select('name').eq('id', userId).maybeSingle()
  return (data?.name as string | undefined) ?? 'Gestor'
}

async function validateActiveSeller(adminClient: SupabaseClient, orgId: string, userId: string) {
  const { data: seller, error } = await adminClient
    .from('users')
    .select('id, name, role, active, organization_id')
    .eq('id', userId)
    .eq('organization_id', orgId)
    .eq('role', 'seller')
    .eq('active', true)
    .maybeSingle()

  if (error) throw error
  return seller as { id: string; name: string; role: string; active: boolean; organization_id: string } | null
}

async function createPerformanceEventSafe(
  adminClient: SupabaseClient,
  input: Parameters<typeof createPerformanceEvent>[1],
  label: string,
) {
  try {
    return await createPerformanceEvent(adminClient, input)
  } catch (error) {
    console.error(`Erro ao registrar evento (${label}):`, error)
    return null
  }
}

async function analyzeOperation(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const brain = await buildCommercialBrainContext(adminClient, orgId, executorUserId, await getExecutorName(adminClient, executorUserId))
  return {
    success: true,
    message: `Analise ${String(params.focus || 'geral')}: ${brain.executiveSummary.resumo} Prioridade: ${brain.executiveSummary.prioridadeHoje}.`,
    data: { executiveSummary: brain.executiveSummary, risks: brain.risks, opportunities: brain.opportunities, recommendedActions: brain.recommendedActions, verified: true },
  }
}

async function simulateDecision(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const brain = await buildCommercialBrainContext(adminClient, orgId, executorUserId, await getExecutorName(adminClient, executorUserId))
  const scenario = String(params.scenario || 'simulacao')
  const value = Number(params.value ?? 0)
  const base = brain.executiveSummary
  const isPipelineScenario = String(params.variable || scenario).toLowerCase().includes('pipeline')
  const pipelineLift = isPipelineScenario ? Math.min(base.pipelineEmRisco, Math.max(value, base.pipelineEmRisco * 0.25)) : 0
  const forecastLift = String(params.variable || scenario).toLowerCase().includes('forecast') ? Math.max(value, base.forecastProvavel * 0.1) : pipelineLift * 0.35
  const projectedGap = Math.max(0, base.gapMeta - forecastLift)
  return { success: true, message: `Simulacao pronta. No cenario "${scenario}", o gap projetado cai de ${base.gapMeta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${projectedGap.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`, data: { scenario, current: base, simulated: { forecastLift, pipelineLift, projectedGap }, verified: true } }
}

async function generateManagerBriefing(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const brain = await buildCommercialBrainContext(adminClient, orgId, executorUserId, await getExecutorName(adminClient, executorUserId))
  const period = String(params.period || 'daily')
  return { success: true, message: `Briefing ${period === 'weekly' ? 'semanal' : 'diario'} gerado. Prioridade: ${brain.executiveSummary.prioridadeHoje}.`, data: { period, summary: brain.executiveSummary.resumo, priority: brain.executiveSummary.prioridadeHoje, risks: brain.risks, opportunities: brain.opportunities, recommendedActions: brain.recommendedActions.slice(0, 5), verified: true } }
}

async function generateMeetingAgenda(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const brain = await buildCommercialBrainContext(adminClient, orgId, executorUserId, await getExecutorName(adminClient, executorUserId))
  const userId = params.user_id as string | undefined
  const seller = userId ? brain.teamPerformance.sellers.find((item) => item.id === userId) : null
  const title = seller ? `Pauta 1:1 - ${seller.name}` : 'Pauta da reuniao do time'
  const topics = seller
    ? [seller.status_message, `Pipeline em risco: ${seller.pipeline_at_risk.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, `Pendencias: ${seller.deals_without_next_action} deals sem proxima acao e ${seller.overdue_followups} follow-ups atrasados`, `Acao recomendada: ${seller.recommended_action.label}`]
    : [brain.executiveSummary.resumo, `Gap de meta: ${brain.executiveSummary.gapMeta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, `Pipeline em risco: ${brain.executiveSummary.pipelineEmRisco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, `Prioridade: ${brain.executiveSummary.prioridadeHoje}`]
  return { success: true, message: `${title} gerada com ${topics.length} blocos de conversa.`, data: { title, objective: params.objective ?? null, topics, seller, verified: true } }
}

async function createActionPlan(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const title = String(params.title || '')
  const summary = String(params.summary || '')
  const items = Array.isArray(params.items) ? params.items as Array<Record<string, unknown>> : []
  if (!title || !summary || items.length === 0) return { success: false, message: 'Titulo, resumo e itens sao obrigatorios' }

  const targetUserIds = Array.from(new Set(items.map((item) => item.target_user_id).filter(Boolean).map(String)))
  const validSellerIds = new Set<string>()
  if (targetUserIds.length > 0) {
    const { data: validSellers, error: sellerError } = await adminClient
      .from('users')
      .select('id')
      .eq('organization_id', orgId)
      .eq('role', 'seller')
      .eq('active', true)
      .in('id', targetUserIds)

    if (sellerError) return { success: false, message: `Erro ao validar vendedores do plano: ${sellerError.message}` }
    for (const seller of validSellers ?? []) validSellerIds.add(String(seller.id))
    const invalidIds = targetUserIds.filter((id) => !validSellerIds.has(id))
    if (invalidIds.length > 0) {
      return { success: false, message: `Plano não criado. Vendedor(es) inválido(s) ou inativo(s): ${invalidIds.join(', ')}` }
    }
  }

  const { data: plan, error } = await adminClient.from('manager_action_plans').insert({ organization_id: orgId, manager_id: executorUserId, title, summary, status: 'active', source: 'chat_ia', created_by_ai: true }).select('id,title').single()
  if (error || !plan) return { success: false, message: `Erro ao criar plano de acao: ${error?.message}` }
  const rows = items.map((item) => ({ plan_id: plan.id, organization_id: orgId, target_user_id: item.target_user_id || null, action_type: String(item.action_type || 'manager_action'), title: String(item.title || 'Acao do plano'), description: String(item.description || ''), priority: ['low', 'medium', 'high', 'critical'].includes(String(item.priority)) ? item.priority : 'medium', status: 'pending', due_at: item.due_at || null, metadata: item }))
  const { data: insertedItems, error: itemError } = await adminClient.from('manager_action_plan_items').insert(rows).select('id,title,target_user_id,action_type')
  if (itemError) return { success: false, message: `Plano criado, mas houve erro nos itens: ${itemError.message}`, data: { plan } }
  const executions: Array<Record<string, unknown>> = []
  for (const [index, insertedItem] of (insertedItems ?? []).entries()) {
    const sourceItem = items[index] ?? {}
    const actionType = String(insertedItem.action_type || sourceItem.action_type || '').toLowerCase()
    const targetUserId = insertedItem.target_user_id ? String(insertedItem.target_user_id) : ''
    let execution: ActionResult | null = null

    if (['mission', 'create_mission', 'recovery_mission'].includes(actionType) && targetUserId) {
      execution = await createMission(adminClient, {
        user_id: targetUserId,
        title: insertedItem.title,
        description: sourceItem.description || insertedItem.title,
        deadline: sourceItem.due_at || null,
        xp_reward: sourceItem.xp_reward ?? 50,
        commission_bonus: sourceItem.commission_bonus ?? 0,
        criteria: { type: 'manager_action_plan', plan_id: plan.id, plan_item_id: insertedItem.id },
      }, orgId, executorUserId)
      const missionId = execution.success ? ((execution.data as Record<string, unknown> | undefined)?.entityId ?? (execution.data as Record<string, unknown> | undefined)?.id) : null
      await adminClient
        .from('manager_action_plan_items')
        .update({
          related_mission_id: missionId || null,
          status: missionId ? 'in_progress' : 'blocked',
          metadata: { ...sourceItem, execution },
        })
        .eq('id', insertedItem.id)
        .eq('organization_id', orgId)
    } else if (['pdi', 'create_pdi_plan'].includes(actionType) && targetUserId) {
      execution = await createPdiPlan(adminClient, {
        user_id: targetUserId,
        title: insertedItem.title,
        description: sourceItem.description || insertedItem.title,
        due_date: sourceItem.due_at || null,
      }, orgId, executorUserId)
      const pdiPlanId = execution.success ? ((execution.data as Record<string, unknown> | undefined)?.id ?? (execution.data as Record<string, unknown> | undefined)?.entityId) : null
      await adminClient
        .from('manager_action_plan_items')
        .update({
          related_pdi_plan_id: pdiPlanId || null,
          status: pdiPlanId ? 'in_progress' : 'blocked',
          metadata: { ...sourceItem, execution },
        })
        .eq('id', insertedItem.id)
        .eq('organization_id', orgId)
    } else if (['nudge', 'recognition', 'notify', 'notification'].includes(actionType) && targetUserId) {
      execution = await createManagerNudge(adminClient, {
        user_id: targetUserId,
        message: sourceItem.description || insertedItem.title,
        tone: actionType === 'recognition' ? 'recognition' : sourceItem.tone || 'coaching',
      }, orgId, executorUserId)
      await adminClient.from('manager_action_plan_items').update({ status: execution.success ? 'done' : 'blocked', metadata: { ...sourceItem, execution } }).eq('id', insertedItem.id).eq('organization_id', orgId)
    }

    if (execution) executions.push({ planItemId: insertedItem.id, actionType, success: execution.success, message: execution.message, data: execution.data ?? null })
  }
  const event = await createPerformanceEventSafe(adminClient, { organizationId: orgId, actorUserId: executorUserId, eventType: 'manager_action_plan_created', sourceModule: 'chat_ia', entityType: 'manager_action_plan', entityId: plan.id, title: 'Plano de acao criado pela VAMO IA', description: `Plano "${title}" criado com ${insertedItems?.length ?? 0} item(ns).`, impactScore: 70, priorityScore: 75, riskScore: 30, metadata: { createdByAI: true, itemCount: insertedItems?.length ?? 0 } }, 'manager_action_plan_created')
  return { success: true, message: `Plano criado, ${insertedItems?.length ?? 0} item(ns) vinculados, ${executions.filter((item) => item.success).length} acao(oes) executada(s) e ${event ? 'acao registrada no historico' : 'historico pendente'}.`, data: { entityType: 'manager_action_plan', entityId: plan.id, plan, items: insertedItems ?? [], executions, eventId: event?.id ?? null, verified: true } }
}

async function createPdiPlan(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const userId = params.user_id as string
  const title = String(params.title || 'PDI gerado pela VAMO IA')
  if (!userId) return { success: false, message: 'ID do vendedor e obrigatorio' }
  const seller = await validateActiveSeller(adminClient, orgId, userId)
  if (!seller) return { success: false, message: 'Vendedor não encontrado, inativo ou fora desta organização. Escolha um vendedor ativo para receber o PDI.' }

  const { data, error } = await adminClient.from('pdi_plans').insert({ organization_id: orgId, user_id: userId, manager_id: executorUserId, title, description: String(params.description || title), status: 'recommended', recommended_by: 'ai', start_date: params.start_date || new Date().toISOString().slice(0, 10), due_date: params.due_date || null, metadata: { source: 'chat_ia', createdByAI: true, ...params } }).select('id,title,status,user_id').single()
  if (error || !data) return { success: false, message: `Erro ao criar PDI: ${error?.message}` }

  const { data: confirmed, error: confirmError } = await adminClient
    .from('pdi_plans')
    .select('id,title,status,user_id,organization_id')
    .eq('id', data.id)
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single()
  if (confirmError || !confirmed) return { success: false, message: `PDI criado, mas não foi possível confirmar vínculo com o vendedor: ${confirmError?.message ?? 'confirmação vazia'}`, data }

  const itemRows: Array<Record<string, unknown>> = [
    {
      plan_id: confirmed.id,
      organization_id: orgId,
      training_module_id: null,
      item_type: 'training',
      title: `Treino aplicado - ${title}`,
      description: String(params.description || title),
      status: 'pending',
      metadata: { source: 'chat_ia', target_kpi_key: params.target_kpi_key ?? null, target_value: params.target_value ?? null },
    },
    {
      plan_id: confirmed.id,
      organization_id: orgId,
      item_type: 'deal_application',
      title: 'Aplicar em oportunidade real',
      description: 'Use o aprendizado em uma oportunidade do CRM e envie evidência para validação do gestor.',
      status: 'pending',
      metadata: { source: 'chat_ia' },
    },
    {
      plan_id: confirmed.id,
      organization_id: orgId,
      item_type: 'manager_review',
      title: 'Validação do gestor',
      description: 'Gestor revisa a evidência e decide se o comportamento evoluiu.',
      status: 'pending',
      metadata: { source: 'chat_ia' },
    },
  ]
  const { data: trainingModule, error: trainingError } = await adminClient
    .from('training_modules')
    .insert({
      organization_id: orgId,
      title: `Treinamento - ${title}`,
      description: String(params.description || title),
      skill_area: String(params.skill_area || params.target_kpi_key || 'sales_process'),
      module_type: 'micro_training',
      estimated_minutes: Number(params.estimated_minutes ?? 15),
      content: {
        objective: String(params.objective || params.description || title),
        checklist: Array.isArray(params.checklist) ? params.checklist : ['Revisar conceito', 'Aplicar em um caso real', 'Registrar evidência'],
        createdByAI: true,
        source: 'chat_ia',
      },
      active: true,
      pdi_plan_id: confirmed.id,
    })
    .select('id,title')
    .single()
  if (trainingError || !trainingModule) return { success: false, message: `PDI criado e confirmado, mas houve erro ao criar treinamento: ${trainingError?.message}`, data: confirmed }

  itemRows[0].training_module_id = trainingModule.id
  const { data: items, error: itemsError } = await adminClient.from('pdi_plan_items').insert(itemRows).select('id,title,item_type,status')
  if (itemsError) return { success: false, message: `PDI criado e confirmado, mas houve erro ao criar itens: ${itemsError.message}`, data: confirmed }

  const practicalMissionResult = await createMission(
    adminClient,
    {
      user_id: userId,
      title: `Aplicar PDI: ${title}`,
      description: String(params.practice_description || `Aplicar o treinamento "${title}" em uma oportunidade real e registrar evidência para validação do gestor.`),
      area: 'sales_process',
      difficulty: 2,
      xp_reward: Number(params.xp_reward ?? 50),
      commission_bonus: Number(params.commission_bonus ?? 0),
      deadline: params.due_date || null,
      type: 'manual_validation',
      verification_type: 'manual',
      pdi_plan_id: confirmed.id,
      criteria: { type: 'pdi_practice', pdi_plan_id: confirmed.id, training_module_id: trainingModule.id },
    },
    orgId,
    executorUserId,
  )
  if (!practicalMissionResult.success) return { success: false, message: `PDI criado, mas houve erro ao criar missão prática: ${practicalMissionResult.message}`, data: { ...confirmed, items: items ?? [], trainingModule } }

  const notificationResult = await notifySeller(adminClient, { user_id: userId, message: `Seu gestor criou um novo PDI: ${confirmed.title}` }, orgId, executorUserId)
  const event = await createPerformanceEventSafe(adminClient, { organizationId: orgId, actorUserId: executorUserId, targetUserId: userId, eventType: 'pdi_plan_created_by_ai', sourceModule: 'chat_ia', entityType: 'pdi_plan', entityId: data.id, title: 'PDI criado pela VAMO IA', description: `PDI "${title}" criado para aprovacao do gestor.`, impactScore: 60, priorityScore: 65, riskScore: 25, metadata: { createdByAI: true, verified: true } }, 'pdi_plan_created_by_ai')
  return { success: true, message: `PDI "${confirmed.title}" criado e confirmado para ${seller.name}; treinamento, ${items?.length ?? 0} itens e missão prática criados; ${notificationResult.success ? 'notificação enviada' : `notificação falhou: ${notificationResult.message}`}; ${event ? 'evento registrado no histórico' : 'histórico pendente'}.`, data: { ...confirmed, targetUserName: seller.name, items: items ?? [], trainingModule, practicalMission: practicalMissionResult.data, notification: notificationResult, eventId: event?.id ?? null, verified: true } }
}

async function createRecoveryMission(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const result = await createMission(adminClient, { ...params, area: params.area || 'sales_process', type: 'manual_validation', verification_type: 'manual', criteria: { type: 'pipeline_recovery', target_value: params.target_value ?? 1, source: 'chat_ia' } }, orgId, executorUserId)
  if (!result.success) return result
  const data = result.data as { id?: string; title?: string } | undefined
  const event = await createPerformanceEventSafe(adminClient, { organizationId: orgId, actorUserId: executorUserId, targetUserId: params.user_id as string | undefined, eventType: 'ai_recovery_mission_created', sourceModule: 'chat_ia', entityType: 'ai_mission', entityId: data?.id ?? null, title: 'Missao de recuperacao criada pela VAMO IA', description: data?.title ? `Missao "${data.title}" criada para recuperar pipeline.` : null, impactScore: 65, priorityScore: 75, riskScore: 35, metadata: { createdByAI: true, verified: true } }, 'ai_recovery_mission_created')
  return { ...result, message: `${result.message}. ${event ? 'Evento operacional registrado' : 'Historico operacional pendente'}.`, data: { ...(data ?? {}), eventId: event?.id ?? null, verified: true } }
}

async function createManagerNudge(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const result = await notifySeller(adminClient, params, orgId, executorUserId)
  if (!result.success) return result
  const event = await createPerformanceEventSafe(adminClient, { organizationId: orgId, actorUserId: executorUserId, targetUserId: params.user_id as string | undefined, eventType: 'manager_nudge_created', sourceModule: 'chat_ia', entityType: 'notification', title: 'Nudge do gestor criado pela VAMO IA', description: String(params.message || ''), impactScore: 45, priorityScore: params.tone === 'charge' ? 70 : 50, riskScore: params.tone === 'charge' ? 40 : 15, metadata: { tone: params.tone || 'coaching', createdByAI: true, verified: true } }, 'manager_nudge_created')
  return { ...result, message: `${result.message}. ${event ? 'Nudge registrado no historico' : 'Historico do nudge pendente'}.`, data: { eventId: event?.id ?? null, verified: true } }
}

async function markRecommendationDone(adminClient: SupabaseClient, params: Record<string, unknown>, orgId: string, executorUserId: string): Promise<ActionResult> {
  const recommendationId = params.recommendation_id as string
  if (!recommendationId) return { success: false, message: 'ID da recomendacao e obrigatorio' }
  const { data, error } = await adminClient.from('action_recommendations').update({ status: 'done', metadata: { completed_by_chat: true, note: params.note ?? null }, updated_at: new Date().toISOString() }).eq('id', recommendationId).eq('organization_id', orgId).select('id,title,target_user_id').single()
  if (error || !data) return { success: false, message: `Erro ao concluir recomendacao: ${error?.message}` }
  const event = await createPerformanceEventSafe(adminClient, { organizationId: orgId, actorUserId: executorUserId, targetUserId: data.target_user_id as string | null, eventType: 'action_recommendation_done', sourceModule: 'chat_ia', entityType: 'action_recommendation', entityId: data.id, title: 'Recomendacao concluida pela VAMO IA', description: String(data.title || ''), impactScore: 35, priorityScore: 40, riskScore: 10, metadata: { note: params.note ?? null, verified: true } }, 'action_recommendation_done')
  return { success: true, message: `Recomendacao "${data.title}" marcada como concluida${event ? ' e registrada no historico' : ''}.`, data: { ...data, eventId: event?.id ?? null, verified: true } }
}

async function addSeller(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const name = params.name as string
  const email = params.email as string
  if (!name || !email) return { success: false, message: 'Nome e email são obrigatórios' }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return { success: false, message: 'Formato de email inválido' }

  // Check if already exists in this org
  const { data: existing } = await adminClient
    .from('users')
    .select('id')
    .eq('email', email)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (existing) return { success: false, message: 'Este email já está cadastrado na equipe' }

  // Check if auth user already exists (from another org or orphaned)
  const { data: existingAuthList } = await adminClient.auth.admin.listUsers()
  const existingAuth = existingAuthList?.users?.find((u) => u.email === email)

  let authUserId: string
  const password = generatePassword()

  if (existingAuth) {
    // Auth user exists — update password and confirm email
    authUserId = existingAuth.id
    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      user_metadata: { needs_password_change: true },
    })
    if (updateError) {
      return { success: false, message: `Erro ao atualizar usuário: ${updateError.message}` }
    }
  } else {
    // Create new auth user — mark needs_password_change so the app shows the change-password modal on first login
    const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, needs_password_change: true },
    })

    if (authError || !newAuthUser.user) {
      return { success: false, message: authError?.message || 'Erro ao criar usuário de autenticação' }
    }
    authUserId = newAuthUser.user.id
  }

  // Ensure users row has organization_id set + user_xp record exists
  const setup = await ensureSellerSetup(adminClient, authUserId, orgId, name, email)
  if (!setup) {
    if (!existingAuth) await adminClient.auth.admin.deleteUser(authUserId)
    return { success: false, message: 'Erro ao configurar vendedor no banco de dados' }
  }
  const newUser = { id: setup.id, name, email }

  return {
    success: true,
    message: `Vendedor ${name} cadastrado com sucesso. Senha temporária: ${password}`,
    data: { userId: newUser.id, email, temporaryPassword: password },
  }
}

// ── Create Mission ──
async function createMission(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string,
  executorUserId: string
): Promise<ActionResult> {
  const title = params.title as string
  const description = params.description as string
  if (!title) return { success: false, message: 'Título da missão é obrigatório' }

  const userId = params.user_id as string
  if (!userId) {
    return {
      success: false,
      message: 'Escolha um vendedor para receber a missão. Missões não podem ser criadas sem vendedor responsável.',
    }
  }

  const seller = await validateActiveSeller(adminClient, orgId, userId)
  if (!seller) {
    return {
      success: false,
      message: 'Vendedor não encontrado, inativo ou fora desta organização. Escolha um vendedor ativo para receber a missão.',
    }
  }

  const area = (params.area as string) || 'sales_process'
  const difficulty = (params.difficulty as number) || 2
  const xpReward = (params.xp_reward as number) || 50
  const commissionBonus = (params.commission_bonus as number) || 0
  const type = (params.type as string) || ((params.kpi_id || params.source_event) ? 'kpi_target' : 'manual_validation')
  const targetValue = Number(params.target_value ?? 1)
  const currentValue = Number(params.current_value ?? 0)
  const verificationType = (params.verification_type as string) || (type === 'manual_validation' ? 'manual' : 'automatic')
  const criteria = (params.criteria as Record<string, unknown>) || {
    type,
    kpi_id: params.kpi_id ?? null,
    source_event: params.source_event ?? null,
    target_value: targetValue,
  }

  const { data, error } = await adminClient
    .from('ai_missions')
    .insert({
      organization_id: orgId,
      user_id: userId,
      created_by: executorUserId,
      title,
      description: description || title,
      area,
      difficulty: Math.min(3, Math.max(1, difficulty)),
      xp_reward: xpReward,
      commission_bonus: commissionBonus,
      status: 'pending',
      type,
      kpi_id: params.kpi_id || null,
      target_value: Number.isFinite(targetValue) ? targetValue : 1,
      current_value: Number.isFinite(currentValue) ? currentValue : 0,
      deadline: params.deadline || null,
      verification_type: ['automatic', 'manual', 'hybrid'].includes(verificationType) ? verificationType : 'manual',
      criteria,
      playbook_content: params.playbook_content || null,
      pdi_plan_id: params.pdi_plan_id || null,
      gap_id: params.gap_id || null,
    })
    .select('id, title, xp_reward, commission_bonus')
    .single()

  if (error) return { success: false, message: `Erro ao criar missão: ${error.message}` }
  {
    const { data: confirmed, error: confirmError } = await adminClient
      .from('ai_missions')
      .select('id, title, user_id, organization_id, xp_reward, commission_bonus, status, deadline')
      .eq('id', data.id)
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .single()

    if (confirmError || !confirmed) {
      return {
        success: false,
        message: `Missão criada, mas não foi possível confirmar vínculo com o vendedor: ${confirmError?.message ?? 'confirmação vazia'}`,
        data,
      }
    }

    const event = await createPerformanceEventSafe(adminClient, {
      organizationId: orgId,
      actorUserId: executorUserId,
      targetUserId: userId,
      eventType: 'ai_mission_created',
      sourceModule: 'chat_ia',
      entityType: 'ai_mission',
      entityId: confirmed.id,
      title: 'Missão criada pela VAMO IA',
      description: `Missão "${confirmed.title}" criada para ${seller.name}.`,
      impactScore: 60,
      priorityScore: 70,
      riskScore: 20,
      metadata: {
        createdByAI: true,
        verified: true,
      },
    }, 'ai_mission_created')

    const notificationResult = await notifySeller(
      adminClient,
      {
        user_id: userId,
        title: 'Nova missão recebida',
        message: `Você recebeu uma nova missão: ${confirmed.title}`,
        type: 'mission',
        source: 'ai_chat',
        action_href: '/performance/missoes',
        related_mission_id: confirmed.id,
        performance_event_id: event?.id ?? null,
        context: {
          mission_id: confirmed.id,
          created_by_ai: true,
        },
      },
      orgId,
      executorUserId,
    )

    const confirmedRewardParts = [`${confirmed.xp_reward} XP`]
    if (confirmed.commission_bonus > 0) confirmedRewardParts.push(`R$ ${confirmed.commission_bonus} de bônus`)
    const notificationMessage = notificationResult.success ? 'notificação enviada' : `notificação falhou: ${notificationResult.message}`

    return {
      success: true,
      message: `Missão "${confirmed.title}" criada e confirmada para ${seller.name} com ${confirmedRewardParts.join(' + ')} de recompensa; ${notificationMessage}; ${event ? 'evento registrado no histórico' : 'histórico pendente'}.`,
      data: {
        entityType: 'ai_mission',
        entityId: confirmed.id,
        targetUserId: seller.id,
        targetUserName: seller.name,
        eventId: event?.id ?? null,
        notification: notificationResult,
        verified: true,
        actionHref: '/performance/missoes',
        ...confirmed,
      },
    }
  }
}

// ── Define KPI ──
async function defineKpi(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const name = params.name as string
  if (!name) return { success: false, message: 'Nome do KPI é obrigatório' }

  const unit = (params.unit as string) || 'un'
  const pointsPerUnit = (params.points_per_unit as number) || 10
  const targetDaily = Number(params.target_daily ?? 0)
  const targetWeekly = Number(params.target_weekly ?? 0)
  const targetMonthly = Number(params.target_monthly ?? params.target ?? 0)
  const source = String(params.source || 'manual')
  const sourceEvent = (params.source_event as string) || null
  const targets = params.targets || {
    daily: targetDaily,
    weekly: targetWeekly,
    monthly: targetMonthly,
    source,
    source_event: sourceEvent,
    alert_tolerance: Number(params.alert_tolerance ?? 10),
  }

  const { data, error } = await adminClient
    .from('kpi_definitions')
    .insert({
      organization_id: orgId,
      name,
      slug: slugify(name),
      unit,
      points_per_unit: pointsPerUnit,
      targets,
      source,
      source_event: sourceEvent,
      target_daily: targetDaily,
      target_weekly: targetWeekly,
      target_monthly: targetMonthly,
      period: (params.period as string) || 'monthly',
      calculation_type: (params.calculation_type as string) || 'sum',
      alert_tolerance: Number(params.alert_tolerance ?? 10),
      active: true,
    })
    .select('id, name, unit')
    .single()

  if (error) return { success: false, message: `Erro ao criar KPI: ${error.message}` }
  return { success: true, message: `KPI "${data.name}" criado com unidade "${data.unit}"`, data }
}

// ── Set Goal ──
async function setGoal(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const kpiId = params.kpi_id as string
  const targetValue = params.target_value as number
  const period = (params.period as string) || 'daily'

  if (!kpiId) return { success: false, message: 'ID do KPI é obrigatório' }
  if (targetValue == null) return { success: false, message: 'Valor da meta é obrigatório' }

  const { data: kpi } = await adminClient
    .from('kpi_definitions')
    .select('id, name, targets')
    .eq('id', kpiId)
    .eq('organization_id', orgId)
    .single()

  if (!kpi) return { success: false, message: 'KPI não encontrado nesta organização' }

  const newTargets = { ...(kpi.targets as Record<string, number> || {}), [period]: targetValue }

  const { error } = await adminClient
    .from('kpi_definitions')
    .update({ targets: newTargets })
    .eq('id', kpiId)
    .eq('organization_id', orgId)

  if (error) return { success: false, message: `Erro ao definir meta: ${error.message}` }
  return { success: true, message: `Meta ${period} do KPI "${kpi.name}" definida para ${targetValue}` }
}

// ── Award XP ──
async function awardXpAction(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const userId = params.user_id as string
  const amount = params.amount as number
  const description = (params.description as string) || 'Bônus via VAMO IA'

  if (!userId) return { success: false, message: 'ID do vendedor é obrigatório' }
  if (!amount || amount <= 0) return { success: false, message: 'Quantidade de XP deve ser positiva' }

  try {
    const result = await awardXp(supabase, {
      userId,
      organizationId: orgId,
      amount,
      sourceType: 'bonus',
      description,
    })
    return {
      success: true,
      message: `${amount} XP concedidos! Total agora: ${result.newTotalXp} XP (Nível ${result.newLevel})${result.leveledUp ? ' — SUBIU DE NÍVEL!' : ''}`,
      data: result,
    }
  } catch (error) {
    return { success: false, message: `Erro ao conceder XP: ${error instanceof Error ? error.message : 'Erro desconhecido'}` }
  }
}

// ── Generate Briefing ──
async function generateBriefing(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  orgId: string,
  executorUserId: string
): Promise<ActionResult> {
  const { callOpenAIJSON, isOpenAIConfigured } = await import('./openai.service')
  if (!isOpenAIConfigured()) return { success: false, message: 'OpenAI não configurado' }

  // Use same week_start as the briefing-semanal route (last Monday)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const weekStart = monday.toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  const [{ data: sellers }, { data: kpiEntries }, { data: missions }, { data: checkins }] = await Promise.all([
    adminClient.from('users').select('id, name').eq('organization_id', orgId).eq('role', 'seller').eq('active', true),
    supabase.from('kpi_entries').select('user_id, value, points_earned, kpi_id, recorded_at').eq('organization_id', orgId).gte('recorded_at', `${weekAgo}T00:00:00`),
    supabase.from('ai_missions').select('user_id, title, status, xp_reward').eq('organization_id', orgId).gte('created_at', `${weekAgo}T00:00:00`),
    supabase.from('daily_checkins').select('user_id, energy_level, checkin_date').eq('organization_id', orgId).gte('checkin_date', weekAgo).lte('checkin_date', today),
  ])

  const sellerNames = (sellers || []).reduce((map: Record<string, string>, s) => {
    map[s.id] = s.name
    return map
  }, {})

  const completedMissions = (missions || []).filter((m: { status: string }) => m.status === 'completed')
  const totalKpiPoints = (kpiEntries || []).reduce((s: number, e: { points_earned: number }) => s + (e.points_earned || 0), 0)
  const lowEnergyUsers = (checkins || []).filter((c: { energy_level: number }) => c.energy_level <= 2).map((c: { user_id: string }) => sellerNames[c.user_id] || c.user_id)
  const noCheckinUsers = (sellers || []).filter((s) => !(checkins || []).some((c: { user_id: string }) => c.user_id === s.id)).map((s) => s.name)

  const contextSummary = `
Resumo da semana (${weekAgo} a ${today}):
- Equipe: ${sellers?.length || 0} vendedores ativos
- KPIs registrados: ${kpiEntries?.length || 0} entradas, ${totalKpiPoints} pontos totais
- Missões concluídas: ${completedMissions.length} de ${missions?.length || 0}
- Check-ins realizados: ${(checkins || []).length} no total
- Vendedores com energia baixa (1-2): ${lowEnergyUsers.length > 0 ? lowEnergyUsers.join(', ') : 'nenhum'}
- Sem check-in esta semana: ${noCheckinUsers.length > 0 ? noCheckinUsers.join(', ') : 'nenhum'}
- Missões completadas: ${completedMissions.map((m: { user_id: string; title: string; xp_reward: number }) => `${sellerNames[m.user_id] || 'Vendedor'}: "${m.title}" (+${m.xp_reward}XP)`).join('; ') || 'nenhuma'}
`.trim()

  let content
  try {
    const result = await callOpenAIJSON({
      systemPrompt: `Você é a VAMO IA. Gere um briefing semanal em JSON com os campos: o_que_foi_bem (string), o_que_preocupa (string), quem_precisa_atencao (string), prioridade_semana (string), acao_recomendada (string). Baseie-se nos dados reais da semana. Responda APENAS com o JSON.`,
      userPrompt: contextSummary,
      temperature: 0.5,
      maxTokens: 1000,
    })
    content = result.data
  } catch (err) {
    return { success: false, message: `Erro ao gerar briefing com IA: ${err instanceof Error ? err.message : 'Erro desconhecido'}` }
  }

  // Use adminClient to bypass RLS on write
  const { error: upsertError } = await adminClient.from('weekly_briefings').upsert(
    { organization_id: orgId, generated_by: executorUserId, week_start: weekStart, content, model_used: 'gpt-4o-mini' },
    { onConflict: 'organization_id,week_start' }
  )

  if (upsertError) {
    const { error: insertError } = await adminClient.from('weekly_briefings').insert({
      organization_id: orgId, generated_by: executorUserId, week_start: weekStart, content, model_used: 'gpt-4o-mini',
    })
    if (insertError) {
      return { success: false, message: `Briefing gerado mas não foi possível salvar: ${insertError.message}` }
    }
  }

  return { success: true, message: 'Briefing semanal gerado com sucesso', data: content }
}

// ── Generate Retrospective ──
async function generateRetrospective(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  orgId: string
): Promise<ActionResult> {
  const { callOpenAIJSON, isOpenAIConfigured } = await import('./openai.service')
  if (!isOpenAIConfigured()) return { success: false, message: 'OpenAI não configurado' }

  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const [{ data: sellers }, { data: missions }, { data: kpiEntries }] = await Promise.all([
    adminClient.from('users').select('id, name').eq('organization_id', orgId).eq('role', 'seller').eq('active', true),
    supabase.from('ai_missions').select('status').eq('organization_id', orgId).gte('created_at', `${monthAgo}T00:00:00`),
    supabase.from('kpi_entries').select('value, points_earned').eq('organization_id', orgId).gte('recorded_at', `${monthAgo}T00:00:00`),
  ])

  const completedMissions = missions?.filter((m: { status: string }) => m.status === 'completed').length || 0
  const totalMissions = missions?.length || 0
  const totalKpiPoints = kpiEntries?.reduce((s: number, e: { points_earned: number }) => s + (e.points_earned || 0), 0) || 0

  const context = `Período: ${monthAgo} a ${today}. Equipe: ${sellers?.length || 0}. Missões: ${totalMissions} total, ${completedMissions} completadas (${totalMissions > 0 ? Math.round(completedMissions / totalMissions * 100) : 0}%). Pontos KPI: ${totalKpiPoints}.`

  let content
  try {
    const result = await callOpenAIJSON({
      systemPrompt: `Você é a VAMO IA. Gere uma retrospectiva mensal em JSON com os campos: o_que_foi_prometido (string), o_que_foi_entregue (string), impacto_financeiro (string), fica_pro_proximo (string), recomendacao_proximo_ciclo (string). Responda APENAS com o JSON.`,
      userPrompt: context,
      temperature: 0.5,
      maxTokens: 1000,
    })
    content = result.data
  } catch (err) {
    return { success: false, message: `Erro ao gerar retrospectiva com IA: ${err instanceof Error ? err.message : 'Erro desconhecido'}` }
  }

  // Use adminClient to bypass RLS on write
  const { error } = await adminClient.from('monthly_retrospectives').insert({
    organization_id: orgId, cycle_start: monthAgo, cycle_end: today, content, model_used: 'gpt-4o-mini',
  })

  if (error) return { success: false, message: `Erro ao salvar retrospectiva: ${error.message}` }
  return { success: true, message: 'Retrospectiva mensal gerada com sucesso', data: content }
}

// ── Create Challenge ──
async function createChallenge(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string,
): Promise<ActionResult> {
  const title = params.title as string
  if (!title) return { success: false, message: 'Título do desafio é obrigatório' }

  const { data, error } = await adminClient
    .from('challenges')
    .insert({
      organization_id: orgId,
      title,
      description: (params.description as string) || title,
      type: (params.type as string) || 'individual',
      criteria: params.criteria || {},
      xp_reward: (params.xp_reward as number) || 100,
      bonus_reward: (params.bonus_reward as number) || 0,
      start_date: (params.start_date as string) || new Date().toISOString(),
      end_date: (params.end_date as string) || new Date(Date.now() + 7 * 86400000).toISOString(),
      active: true,
    })
    .select('id, title, xp_reward')
    .single()

  if (error) return { success: false, message: `Erro ao criar desafio: ${error.message}` }
  return { success: true, message: `Desafio "${data.title}" criado com ${data.xp_reward} XP de recompensa`, data }
}

// ── Register KPI Value ──
async function registerKpiValue(
  supabase: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string,
  executorUserId: string
): Promise<ActionResult> {
  const userId = params.user_id as string
  const kpiId = params.kpi_id as string
  const value = params.value as number

  if (!userId) return { success: false, message: 'ID do vendedor é obrigatório' }
  if (!kpiId) return { success: false, message: 'ID do KPI é obrigatório' }
  if (value == null) return { success: false, message: 'Valor é obrigatório' }

  const { data: kpi } = await supabase
    .from('kpi_definitions')
    .select('id, name, source_event')
    .eq('id', kpiId)
    .eq('organization_id', orgId)
    .single()

  if (!kpi) return { success: false, message: 'KPI não encontrado nesta organização' }

  const allowedEvents: ExecutionEventType[] = [
    'crm_activity_call',
    'crm_activity_whatsapp',
    'crm_activity_email',
    'crm_activity_follow_up',
    'crm_activity_meeting',
    'crm_activity_proposal_sent',
    'crm_deal_updated',
    'crm_deal_won',
    'crm_deal_lost',
    'pipeline_next_action_created',
    'pipeline_overdue_action_resolved',
    'manual_kpi_entry',
    'mission_manual_validation_requested',
  ]
  const eventType = allowedEvents.includes(kpi.source_event as ExecutionEventType)
    ? kpi.source_event as ExecutionEventType
    : 'manual_kpi_entry'
  const result = await registerExecutionEvent(supabase, {
    organizationId: orgId,
    userId,
    actorUserId: executorUserId,
    type: eventType,
    value,
    source: 'ai',
    metadata: {
      kpiId,
      kpiName: kpi.name,
      description: `Acao comercial registrada pela IA para ${kpi.name}`,
    },
  })

  return {
    success: true,
    message: `Acao comercial registrada para "${kpi.name}" e processada pela execucao central`,
    data: { value, kpiName: kpi.name, eventType, kpiEntries: result.kpiEntries.length, missionUpdates: result.missionUpdates.length },
  }
}

// ── Edit Seller ──
async function editSeller(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const userId = params.user_id as string
  if (!userId) return { success: false, message: 'ID do vendedor é obrigatório' }

  const updates: Record<string, unknown> = {}
  if (params.name) updates.name = params.name
  if (params.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(params.email as string)) return { success: false, message: 'Formato de email inválido' }
    updates.email = params.email
  }
  if (params.active !== undefined) updates.active = params.active

  if (Object.keys(updates).length === 0) return { success: false, message: 'Nenhum campo para atualizar' }

  const { data, error } = await adminClient
    .from('users')
    .update(updates)
    .eq('id', userId)
    .eq('organization_id', orgId)
    .select('name, email, active')
    .single()

  if (error || !data) return { success: false, message: `Erro ao editar vendedor: ${error?.message}` }

  // Sync email in Supabase Auth if changed
  if (params.email) {
    const { data: authData } = await adminClient
      .from('users').select('auth_id').eq('id', userId).single()
    if (authData?.auth_id) {
      await adminClient.auth.admin.updateUserById(authData.auth_id as string, { email: params.email as string })
    }
  }

  const statusMsg = data.active === false ? ' (desativado)' : ''
  return {
    success: true,
    message: `Vendedor "${data.name}" atualizado com sucesso${statusMsg}`,
    data,
  }
}

// ── Remove Seller ──
async function removeSeller(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const userId = params.user_id as string
  const permanent = params.permanent === true

  if (!userId) return { success: false, message: 'ID do vendedor é obrigatório' }

  const { data: seller } = await adminClient
    .from('users')
    .select('id, name, auth_id')
    .eq('id', userId)
    .eq('organization_id', orgId)
    .single()

  if (!seller) return { success: false, message: 'Vendedor não encontrado nesta organização' }

  if (permanent) {
    // Hard delete: remove from auth (cascade deletes users row)
    if (seller.auth_id) {
      const { error } = await adminClient.auth.admin.deleteUser(seller.auth_id as string)
      if (error) return { success: false, message: `Erro ao remover: ${error.message}` }
    }
    return { success: true, message: `Vendedor "${seller.name}" removido permanentemente da plataforma` }
  }

  // Soft delete: just deactivate
  const { error } = await adminClient
    .from('users')
    .update({ active: false })
    .eq('id', userId)
    .eq('organization_id', orgId)

  if (error) return { success: false, message: `Erro ao desativar: ${error.message}` }
  return { success: true, message: `Vendedor "${seller.name}" desativado. Ele não conseguirá mais acessar a plataforma.` }
}

// ── Edit Mission ──
async function editMission(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const missionId = params.mission_id as string
  if (!missionId) return { success: false, message: 'ID da missão é obrigatório' }

  const updates: Record<string, unknown> = {}
  if (params.title) updates.title = params.title
  if (params.description) updates.description = params.description
  if (params.xp_reward) updates.xp_reward = params.xp_reward
  if (params.difficulty) updates.difficulty = Math.min(3, Math.max(1, params.difficulty as number))
  if (params.status) updates.status = params.status

  if (Object.keys(updates).length === 0) return { success: false, message: 'Nenhum campo para atualizar' }

  const { data, error } = await adminClient
    .from('ai_missions')
    .update(updates)
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .select('title')
    .single()

  if (error || !data) return { success: false, message: `Erro ao editar missão: ${error?.message}` }
  return { success: true, message: `Missão "${data.title}" atualizada com sucesso`, data }
}

// ── Delete Mission ──
async function deleteMission(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const missionId = params.mission_id as string
  if (!missionId) return { success: false, message: 'ID da missão é obrigatório' }

  const { data: mission } = await adminClient
    .from('ai_missions')
    .select('title')
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .single()

  if (!mission) return { success: false, message: 'Missão não encontrada' }

  const { error } = await adminClient
    .from('ai_missions')
    .delete()
    .eq('id', missionId)
    .eq('organization_id', orgId)

  if (error) return { success: false, message: `Erro ao excluir missão: ${error.message}` }
  return { success: true, message: `Missão "${mission.title}" excluída com sucesso` }
}

// ── Edit KPI ──
async function editKpi(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const kpiId = params.kpi_id as string
  if (!kpiId) return { success: false, message: 'ID do KPI é obrigatório' }

  const updates: Record<string, unknown> = {}
  if (params.name) updates.name = params.name
  if (params.unit) updates.unit = params.unit
  if (params.points_per_unit !== undefined) updates.points_per_unit = params.points_per_unit
  if (params.active !== undefined) updates.active = params.active

  if (Object.keys(updates).length === 0) return { success: false, message: 'Nenhum campo para atualizar' }

  const { data, error } = await adminClient
    .from('kpi_definitions')
    .update(updates)
    .eq('id', kpiId)
    .eq('organization_id', orgId)
    .select('name, unit, active')
    .single()

  if (error || !data) return { success: false, message: `Erro ao editar KPI: ${error?.message}` }
  return { success: true, message: `KPI "${data.name}" atualizado com sucesso`, data }
}

// ── Delete KPI ──
async function deleteKpi(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const kpiId = params.kpi_id as string
  if (!kpiId) return { success: false, message: 'ID do KPI é obrigatório' }

  const { data: kpi } = await adminClient
    .from('kpi_definitions')
    .select('name')
    .eq('id', kpiId)
    .eq('organization_id', orgId)
    .single()

  if (!kpi) return { success: false, message: 'KPI não encontrado' }

  // Soft delete (preserve historical data)
  const { error } = await adminClient
    .from('kpi_definitions')
    .update({ active: false })
    .eq('id', kpiId)
    .eq('organization_id', orgId)

  if (error) return { success: false, message: `Erro ao desativar KPI: ${error.message}` }
  return { success: true, message: `KPI "${kpi.name}" desativado. Os registros históricos foram preservados.` }
}

// ── Notify Seller ──
async function notifySeller(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string,
  senderId: string
): Promise<ActionResult> {
  const message = (params.message as string | undefined)?.trim()
  if (!message) return { success: false, message: 'Mensagem é obrigatória' }
  if (message.length > 2000) return { success: false, message: 'Mensagem muito longa (máx 2000)' }

  const title = (params.title as string | undefined) ?? 'Mensagem do gestor'
  const notificationType = (params.type as string | undefined) ?? 'manager_message'
  const source = (params.source as string | undefined) ?? 'team_nudge'
  const relatedMissionId = (params.related_mission_id as string | undefined) ?? null
  const performanceEventId = (params.performance_event_id as string | undefined) ?? null
  const baseContext = (params.context as Record<string, unknown> | undefined) ?? {}
  const targetAll = params.user_id === 'all' || !params.user_id

  const createMessageAndNotification = async (seller: { id: string; name: string }) => {
    const conversationId = await findOrCreateDirectConversation(adminClient, orgId, senderId, seller.id)
    const chatMessage = await sendChatMessage(adminClient, orgId, conversationId, senderId, message)
    const actionHref = (params.action_href as string | undefined) ?? `/mensagens?conversation=${conversationId}`

    const { data: notification, error: notificationError } = await adminClient
      .from('notifications')
      .insert({
        organization_id: orgId,
        user_id: seller.id,
        sender_id: senderId,
        title,
        message,
        type: notificationType,
        source,
        action_href: actionHref,
        related_mission_id: relatedMissionId,
        performance_event_id: performanceEventId,
        context: {
          ...baseContext,
          delivery_channel: 'chat_and_notification',
          conversation_id: conversationId,
          chat_message_id: chatMessage.id,
        },
      })
      .select('id, user_id, source, action_href, read, created_at')
      .single()

    if (notificationError || !notification) {
      throw new Error(
        `Mensagem salva no chat, mas houve erro ao criar notificação: ${notificationError?.message ?? 'notificação não retornada'}`
      )
    }

    return {
      sellerId: seller.id,
      sellerName: seller.name,
      conversationId,
      chatMessageId: chatMessage.id,
      notificationId: notification.id,
      actionHref,
    }
  }

  try {
    if (targetAll) {
      const { data: sellers, error: sellersError } = await adminClient
        .from('users')
        .select('id, name')
        .eq('organization_id', orgId)
        .eq('role', 'seller')
        .eq('active', true)

      if (sellersError) return { success: false, message: `Erro ao buscar vendedores: ${sellersError.message}` }
      if (!sellers || sellers.length === 0) return { success: false, message: 'Nenhum vendedor ativo encontrado' }

      const deliveries = [] as Array<{
        sellerId: string
        sellerName: string
        conversationId: string
        chatMessageId: string
        notificationId: string
        actionHref: string
      }>
      const failures = [] as string[]

      for (const seller of sellers as Array<{ id: string; name: string }>) {
        try {
          deliveries.push(await createMessageAndNotification(seller))
        } catch (error) {
          failures.push(`${seller.name}: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
        }
      }

      if (deliveries.length === 0) {
        return {
          success: false,
          message: `Nenhuma mensagem foi entregue. Falhas: ${failures.join(' | ')}`,
        }
      }

      const deliveredNames = deliveries.map((d) => d.sellerName).join(', ')
      return {
        success: failures.length === 0,
        message:
          failures.length === 0
            ? `Mensagem enviada, salva em Mensagens e notificação confirmada para ${deliveries.length} vendedor(es): ${deliveredNames}`
            : `Mensagem entregue para ${deliveries.length} vendedor(es), mas houve falhas em ${failures.length}: ${failures.join(' | ')}`,
        data: {
          deliveryChannel: 'chat_and_notification',
          deliveredCount: deliveries.length,
          failedCount: failures.length,
          deliveries,
          failures,
          verified: failures.length === 0,
        },
      }
    }

    const userId = params.user_id as string
    const seller = await validateActiveSeller(adminClient, orgId, userId)
    if (!seller) {
      return { success: false, message: 'Vendedor não encontrado, inativo ou fora desta organização.' }
    }

    const delivery = await createMessageAndNotification(seller)
    return {
      success: true,
      message: `Mensagem enviada para ${seller.name}, salva em Mensagens para gestor e vendedor, e notificação confirmada.`,
      data: {
        deliveryChannel: 'chat_and_notification',
        sellerId: seller.id,
        sellerName: seller.name,
        conversationId: delivery.conversationId,
        chatMessageId: delivery.chatMessageId,
        notificationId: delivery.notificationId,
        actionHref: delivery.actionHref,
        verified: true,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: `Erro ao enviar mensagem/notificação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    }
  }
}

// ── Send Chat Message (bidirectional chat) ──
async function sendChatMessageAction(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string,
  senderId: string
): Promise<ActionResult> {
  const message = (params.message as string)?.trim()
  if (!message) return { success: false, message: 'Mensagem é obrigatória' }
  if (message.length > 2000) return { success: false, message: 'Mensagem muito longa (máx 2000)' }

  const userIds = Array.isArray(params.user_ids) ? (params.user_ids as string[]) : null
  const singleUserId = params.user_id as string | undefined

  try {
    // Grupo
    if (userIds && userIds.length > 0) {
      const groupName = (params.group_name as string) || 'Grupo'

      // Valida participantes
      const { data: validUsers } = await adminClient
        .from('users')
        .select('id, name')
        .in('id', userIds)
        .eq('organization_id', orgId)

      const validIds = (validUsers || []).map((u: { id: string }) => u.id)
      if (validIds.length === 0) {
        return { success: false, message: 'Nenhum participante válido' }
      }

      const convId = await createGroupConversation(
        adminClient,
        orgId,
        senderId,
        groupName,
        validIds
      )
      await sendChatMessage(adminClient, orgId, convId, senderId, message)

      const names = (validUsers || []).map((u: { name: string }) => u.name).join(', ')
      return {
        success: true,
        message: `Grupo "${groupName}" criado com ${validIds.length} participante(s) e mensagem enviada: ${names}`,
        data: { conversation_id: convId },
      }
    }

    // 1:1
    if (!singleUserId) {
      return { success: false, message: 'Informe user_id (1:1) ou user_ids + group_name (grupo)' }
    }

    const { data: target } = await adminClient
      .from('users')
      .select('id, name, organization_id')
      .eq('id', singleUserId)
      .single()

    if (!target || target.organization_id !== orgId) {
      return { success: false, message: 'Destinatário inválido' }
    }

    const convId = await findOrCreateDirectConversation(adminClient, orgId, senderId, singleUserId)
    await sendChatMessage(adminClient, orgId, convId, senderId, message)

    return {
      success: true,
      message: `Mensagem enviada para ${target.name} no chat`,
      data: { conversation_id: convId },
    }
  } catch (err) {
    return {
      success: false,
      message: `Erro ao enviar mensagem: ${err instanceof Error ? err.message : 'Erro desconhecido'}`,
    }
  }
}

// ── Set Goal Rewards ──
async function setGoalRewards(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const userId = params.user_id as string
  if (!userId) return { success: false, message: 'ID do vendedor é obrigatório' }

  const xpReward = params.xp_reward as number | undefined
  const commissionBonus = params.commission_bonus as number | undefined

  if (xpReward == null && commissionBonus == null) {
    return { success: false, message: 'Informe xp_reward e/ou commission_bonus' }
  }

  const { data: pgRow } = await adminClient
    .from('program_goals')
    .select('individual_goals')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!pgRow) return { success: false, message: 'Metas do programa não encontradas para esta organização' }

  const goals = (pgRow.individual_goals as Record<string, unknown>[]) ?? []
  const idx = goals.findIndex((g) => g.user_id === userId)
  if (idx === -1) return { success: false, message: 'Meta individual não encontrada para este vendedor' }

  const updated = [...goals]
  if (xpReward != null) updated[idx] = { ...updated[idx], xp_reward: xpReward }
  if (commissionBonus != null) updated[idx] = { ...updated[idx], commission_bonus: commissionBonus }

  const { error } = await adminClient
    .from('program_goals')
    .update({ individual_goals: updated, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)

  if (error) return { success: false, message: `Erro ao atualizar recompensas: ${error.message}` }

  const rewards: string[] = []
  if (xpReward != null) rewards.push(`${xpReward} XP`)
  if (commissionBonus != null) rewards.push(`R$ ${commissionBonus} de bônus`)

  const { data: seller } = await adminClient.from('users').select('name').eq('id', userId).single()
  return {
    success: true,
    message: `Recompensas da meta de ${seller?.name ?? userId} atualizadas: ${rewards.join(' + ')}`,
  }
}

// ── Update Goal Status (manager override) ──
async function updateGoalStatus(
  adminClient: SupabaseClient,
  params: Record<string, unknown>,
  orgId: string
): Promise<ActionResult> {
  const userId = params.user_id as string
  const status = params.status as string
  if (!userId) return { success: false, message: 'ID do vendedor é obrigatório' }
  if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
    return { success: false, message: 'Status inválido. Use: pending, in_progress ou completed' }
  }

  const { data: pgRow } = await adminClient
    .from('program_goals')
    .select('individual_goals')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!pgRow) return { success: false, message: 'Metas do programa não encontradas' }

  const goals = (pgRow.individual_goals as Record<string, unknown>[]) ?? []
  const idx = goals.findIndex((g) => g.user_id === userId)
  if (idx === -1) return { success: false, message: 'Meta individual não encontrada para este vendedor' }

  const updated = [...goals]
  updated[idx] = {
    ...updated[idx],
    status,
    ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
  }

  const { error } = await adminClient
    .from('program_goals')
    .update({ individual_goals: updated, updated_at: new Date().toISOString() })
    .eq('organization_id', orgId)

  if (error) return { success: false, message: `Erro ao atualizar status: ${error.message}` }

  const statusLabels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída' }
  const { data: seller } = await adminClient.from('users').select('name').eq('id', userId).single()
  return {
    success: true,
    message: `Meta de ${seller?.name ?? userId} marcada como "${statusLabels[status]}"`,
  }
}
