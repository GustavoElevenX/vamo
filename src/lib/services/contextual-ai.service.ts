import type { SupabaseClient } from '@supabase/supabase-js'
import { callOpenRouter, isOpenRouterConfigured } from './openrouter.service'
import type { JsonObject } from './performance-os.service'

interface PersistContextualAiInput {
  supabase: SupabaseClient
  organizationId: string
  userId?: string | null
  eventId?: string | null
  sourceModule: string
  outputType: string
  entityType?: string | null
  entityId?: string | null
  title: string
  content: string
  confidenceScore?: number
  metadata?: JsonObject
}

async function persistOutput(input: PersistContextualAiInput) {
  await input.supabase.from('contextual_ai_outputs').insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    event_id: input.eventId ?? null,
    source_module: input.sourceModule,
    output_type: input.outputType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    title: input.title,
    content: input.content,
    confidence_score: input.confidenceScore ?? 0.72,
    metadata: input.metadata ?? {},
  })
}

async function generateText(systemPrompt: string, userPrompt: string, fallback: string) {
  if (!isOpenRouterConfigured()) return fallback
  try {
    return await callOpenRouter({ systemPrompt, userPrompt, temperature: 0.35, maxTokens: 700 })
  } catch {
    return fallback
  }
}

function money(value: unknown) {
  const amount = Number(value || 0)
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function generateDealScript(
  supabase: SupabaseClient,
  dealId: string,
  organizationId?: string,
) {
  const { data: deal, error } = await supabase
    .from('crm_deals')
    .select('*, account:crm_accounts(name,segment), owner:users(id,name,role)')
    .eq('id', dealId)
    .maybeSingle()

  if (error) throw error
  if (!deal) throw new Error('Deal nao encontrado')

  const orgId = organizationId ?? String(deal.organization_id)
  const fallback = [
    `Abra com contexto do cliente ${deal.account?.name ?? deal.title}.`,
    `Confirme o objetivo comercial e a etapa atual (${deal.stage}).`,
    `Mostre o impacto financeiro de resolver agora e combine a proxima acao com data.`,
  ].join('\n')

  const content = await generateText(
    'Voce e a VAMO IA, especialista em execucao comercial. Gere scripts curtos, praticos e conectados a forecast, ganho e proxima acao.',
    `Deal: ${JSON.stringify(deal)}\nGere um script de abordagem em portugues do Brasil com no maximo 5 bullets.`,
    fallback,
  )

  await persistOutput({
    supabase,
    organizationId: orgId,
    userId: String(deal.owner_id),
    sourceModule: 'crm',
    outputType: 'ai_script',
    entityType: 'crm_deal',
    entityId: dealId,
    title: 'Script recomendado para o deal',
    content,
    metadata: { stage: deal.stage, value: deal.value },
  })

  return { title: 'Script recomendado para o deal', content }
}

export async function generateTodayPriorities(
  supabase: SupabaseClient,
  userId: string,
  organizationId?: string,
) {
  const [deals, recommendations, gaps, health] = await Promise.all([
    supabase
      .from('crm_deals')
      .select('id,title,value,stage,probability,next_action_title,next_action_due_at,forecast_category')
      .eq('owner_id', userId)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('ai_priority_score', { ascending: false })
      .limit(5),
    supabase
      .from('action_recommendations')
      .select('*')
      .eq('target_user_id', userId)
      .eq('status', 'open')
      .limit(5),
    supabase
      .from('pdi_gaps')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['open', 'in_pdi'])
      .limit(3),
    supabase
      .from('health_calibrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const context = {
    deals: deals.data ?? [],
    recommendations: recommendations.data ?? [],
    gaps: gaps.data ?? [],
    health: health.data?.[0] ?? null,
  }

  const fallback = 'Priorize o deal com proxima acao vencida, registre a atividade no CRM e feche o dia com uma evidencia ligada a KPI, ganho ou PDI.'
  const content = await generateText(
    'Voce e a VAMO IA dentro do cockpit Hoje. Priorize acoes comerciais concretas, com ganho, risco e proximo passo.',
    `Contexto do vendedor: ${JSON.stringify(context)}\nResponda com 3 prioridades acionaveis para hoje.`,
    fallback,
  )

  if (organizationId) {
    await persistOutput({
      supabase,
      organizationId,
      userId,
      sourceModule: 'hoje',
      outputType: 'today_priorities',
      title: 'Prioridades do dia',
      content,
      metadata: context,
    })
  }

  return { title: 'Prioridades do dia', content }
}

export async function generateManagerAlerts(
  supabase: SupabaseClient,
  managerId: string,
  organizationId: string,
) {
  const [recommendations, gaps, health, events] = await Promise.all([
    supabase.from('action_recommendations').select('*').eq('organization_id', organizationId).eq('status', 'open').limit(10),
    supabase.from('pdi_gaps').select('*, user:users(name)').eq('organization_id', organizationId).in('status', ['open', 'in_pdi']).limit(10),
    supabase.from('health_calibrations').select('*, user:users(name)').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(10),
    supabase.from('performance_events').select('*').eq('organization_id', organizationId).order('occurred_at', { ascending: false }).limit(20),
  ])

  const context = {
    recommendations: recommendations.data ?? [],
    gaps: gaps.data ?? [],
    health: health.data ?? [],
    events: events.data ?? [],
  }
  const fallback = 'Comece pelos alertas de risco alto, transforme cada alerta em uma conversa ou acao com dono e reconheca comportamentos reais que ja apareceram nos eventos.'
  const content = await generateText(
    'Voce e a VAMO IA para gestor comercial. Gere decisoes prioritarias com postura humana, foco em forecast, PDI e reconhecimento.',
    `Contexto do gestor: ${JSON.stringify(context)}\nListe decisoes prioritarias para hoje.`,
    fallback,
  )

  await persistOutput({
    supabase,
    organizationId,
    userId: managerId,
    sourceModule: 'hoje_gestor',
    outputType: 'manager_decisions',
    title: 'Decisoes prioritarias',
    content,
    metadata: context,
  })

  return { title: 'Decisoes prioritarias', content }
}

export async function generatePdiRecommendation(
  supabase: SupabaseClient,
  gapId: string,
  organizationId?: string,
) {
  const { data: gap, error } = await supabase
    .from('pdi_gaps')
    .select('*, user:users(id,name)')
    .eq('id', gapId)
    .maybeSingle()

  if (error) throw error
  if (!gap) throw new Error('Gap nao encontrado')

  const fallback = `PDI curto para ${gap.skill_area}: treino de 10 minutos, roleplay de objecao e aplicacao em um deal real nesta semana.`
  const content = await generateText(
    'Voce cria PDI aplicado a performance comercial, nunca biblioteca de curso.',
    `Gap detectado: ${JSON.stringify(gap)}\nGere plano enxuto com treino, aplicacao real e evidencia de evolucao.`,
    fallback,
  )

  await persistOutput({
    supabase,
    organizationId: organizationId ?? String(gap.organization_id),
    userId: String(gap.user_id),
    sourceModule: 'pdi',
    outputType: 'pdi_plan',
    entityType: 'pdi_gap',
    entityId: gapId,
    title: 'PDI recomendado pela VAMO IA',
    content,
    metadata: { skill_area: gap.skill_area, severity: gap.severity },
  })

  return { title: 'PDI recomendado pela VAMO IA', content }
}

export async function generateCommissionExplanation(
  supabase: SupabaseClient,
  commissionCalculationId: string,
) {
  const { data: calculation, error } = await supabase
    .from('commission_calculations')
    .select('*, items:commission_line_items(*)')
    .eq('id', commissionCalculationId)
    .maybeSingle()

  if (error) throw error
  if (!calculation) throw new Error('Calculo de comissao nao encontrado')

  const released = money(calculation.released_commission ?? calculation.total)
  const pending = money(calculation.pending_commission ?? 0)
  const blocked = money(calculation.blocked_commission ?? 0)
  const content = `Comissao prevista: ${money(calculation.forecast_commission ?? calculation.total)}. Liberada: ${released}. Pendente: ${pending}. Bloqueada: ${blocked}. Motivo: ${calculation.block_reason ?? 'sem bloqueio registrado'}.`

  await persistOutput({
    supabase,
    organizationId: String(calculation.organization_id),
    userId: String(calculation.user_id),
    sourceModule: 'commission',
    outputType: 'commission_explanation',
    entityType: 'commission_calculation',
    entityId: commissionCalculationId,
    title: 'Explicacao da comissao',
    content,
    metadata: { total: calculation.total, status: calculation.status },
  })

  return { title: 'Explicacao da comissao', content }
}

export async function generateHealthCalibration(
  supabase: SupabaseClient,
  checkinId: string,
) {
  const { data: checkin, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('id', checkinId)
    .maybeSingle()

  if (error) throw error
  if (!checkin) throw new Error('Check-in nao encontrado')

  const energy = Number(checkin.energy_level)
  const risk = energy <= 2 ? 'high' : energy === 3 ? 'medium' : 'low'
  const content = energy <= 2
    ? 'Reduza a agressividade da missao, foque em duas acoes controlaveis e sugira uma conversa de apoio.'
    : energy === 3
      ? 'Mantenha foco em poucos deals provaveis e use script de apoio para reduzir atrito.'
      : 'Energia favoravel: liberar sprint curto em oportunidade critica, sem perder check-in no fim do dia.'

  await persistOutput({
    supabase,
    organizationId: String(checkin.organization_id),
    userId: String(checkin.user_id),
    sourceModule: 'health',
    outputType: 'health_calibration',
    entityType: 'daily_checkin',
    entityId: checkinId,
    title: 'Calibragem de saude',
    content,
    metadata: { energy_level: energy, risk },
  })

  return { title: 'Calibragem de saude', content, risk }
}

export async function generateOneOnOneAgenda(
  supabase: SupabaseClient,
  targetUserId: string,
  organizationId?: string,
) {
  const [user, gaps, health, recommendations] = await Promise.all([
    supabase.from('users').select('id,name,organization_id').eq('id', targetUserId).maybeSingle(),
    supabase.from('pdi_gaps').select('*').eq('user_id', targetUserId).in('status', ['open', 'in_pdi']).limit(5),
    supabase.from('health_calibrations').select('*').eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(3),
    supabase.from('action_recommendations').select('*').eq('target_user_id', targetUserId).eq('status', 'open').limit(5),
  ])

  if (user.error) throw user.error
  if (!user.data) throw new Error('Usuario nao encontrado')

  const context = {
    user: user.data,
    gaps: gaps.data ?? [],
    health: health.data ?? [],
    recommendations: recommendations.data ?? [],
  }
  const fallback = '1. Comecar pela energia e contexto. 2. Escolher um deal real para desbloquear. 3. Definir uma aplicacao de PDI com evidencia. 4. Fechar com apoio e proxima acao.'
  const content = await generateText(
    'Voce monta pauta de 1:1 humanizada para gestor comercial.',
    `Contexto: ${JSON.stringify(context)}\nGere pauta curta com perguntas e decisoes.`,
    fallback,
  )

  await persistOutput({
    supabase,
    organizationId: organizationId ?? String(user.data.organization_id),
    userId: targetUserId,
    sourceModule: 'health',
    outputType: 'one_on_one_agenda',
    entityType: 'user',
    entityId: targetUserId,
    title: 'Pauta de 1:1 recomendada',
    content,
    metadata: context,
  })

  return { title: 'Pauta de 1:1 recomendada', content }
}
