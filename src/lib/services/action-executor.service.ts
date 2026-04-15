import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActionType, ActionResult } from '@/types/chat'
import { awardXp } from './xp.service'
import { ensureSellerSetup } from './seller-setup.service'
import {
  findOrCreateDirectConversation,
  createGroupConversation,
  sendChatMessage,
} from './chat.service'

export async function executeAction(
  adminClient: SupabaseClient,
  supabase: SupabaseClient,
  actionType: ActionType,
  params: Record<string, unknown>,
  orgId: string,
  executorUserId: string
): Promise<ActionResult> {
  switch (actionType) {
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
      return registerKpiValue(supabase, params, orgId)
    case 'notify_seller':
      return notifySeller(adminClient, params, orgId, executorUserId)
    case 'send_chat_message':
      return sendChatMessageAction(adminClient, params, orgId, executorUserId)
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

  const userId = (params.user_id as string) || executorUserId
  const area = (params.area as string) || 'sales_process'
  const difficulty = (params.difficulty as number) || 2
  const xpReward = (params.xp_reward as number) || 50

  const { data, error } = await adminClient
    .from('ai_missions')
    .insert({
      organization_id: orgId,
      user_id: userId,
      title,
      description: description || title,
      area,
      difficulty: Math.min(3, Math.max(1, difficulty)),
      xp_reward: xpReward,
      status: 'pending',
    })
    .select('id, title, xp_reward')
    .single()

  if (error) return { success: false, message: `Erro ao criar missão: ${error.message}` }
  return { success: true, message: `Missão "${data.title}" criada com ${data.xp_reward} XP de recompensa`, data }
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
  const targets = params.targets || { daily: 0 }

  const { data, error } = await adminClient
    .from('kpi_definitions')
    .insert({
      organization_id: orgId,
      name,
      slug: slugify(name),
      unit,
      points_per_unit: pointsPerUnit,
      targets,
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
  orgId: string
): Promise<ActionResult> {
  const userId = params.user_id as string
  const kpiId = params.kpi_id as string
  const value = params.value as number

  if (!userId) return { success: false, message: 'ID do vendedor é obrigatório' }
  if (!kpiId) return { success: false, message: 'ID do KPI é obrigatório' }
  if (value == null) return { success: false, message: 'Valor é obrigatório' }

  const { data: kpi } = await supabase
    .from('kpi_definitions')
    .select('name, points_per_unit')
    .eq('id', kpiId)
    .eq('organization_id', orgId)
    .single()

  if (!kpi) return { success: false, message: 'KPI não encontrado nesta organização' }

  const pointsEarned = value * (kpi.points_per_unit || 0)
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('kpi_entries')
    .insert({
      organization_id: orgId,
      user_id: userId,
      kpi_id: kpiId,
      value,
      points_earned: pointsEarned,
      recorded_at: today,
      source: 'api',
    })

  if (error) return { success: false, message: `Erro ao registrar KPI: ${error.message}` }

  if (pointsEarned > 0) {
    try {
      await awardXp(supabase, {
        userId,
        organizationId: orgId,
        amount: pointsEarned,
        sourceType: 'kpi',
        sourceId: kpiId,
        description: `KPI: ${kpi.name} (${value} ${kpi.name})`,
      })
    } catch {
      // XP award is best-effort
    }
  }

  return {
    success: true,
    message: `Registrado: ${value} para KPI "${kpi.name}" (+${pointsEarned} XP)`,
    data: { value, pointsEarned, kpiName: kpi.name },
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
  const message = params.message as string
  if (!message) return { success: false, message: 'Mensagem é obrigatória' }

  const targetAll = params.user_id === 'all' || !params.user_id

  if (targetAll) {
    // Notify all active sellers
    const { data: sellers } = await adminClient
      .from('users')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('role', 'seller')
      .eq('active', true)

    if (!sellers || sellers.length === 0) {
      return { success: false, message: 'Nenhum vendedor ativo encontrado' }
    }

    const notifications = sellers.map((s: { id: string }) => ({
      organization_id: orgId,
      user_id: s.id,
      sender_id: senderId,
      message,
    }))

    const { error } = await adminClient.from('notifications').insert(notifications)
    if (error) return { success: false, message: `Erro ao enviar notificações: ${error.message}` }

    const names = sellers.map((s: { name: string }) => s.name).join(', ')
    return {
      success: true,
      message: `Notificação enviada para ${sellers.length} vendedor(es): ${names}`,
    }
  }

  // Notify specific seller
  const userId = params.user_id as string
  const { data: seller } = await adminClient
    .from('users')
    .select('id, name')
    .eq('id', userId)
    .eq('organization_id', orgId)
    .single()

  if (!seller) return { success: false, message: 'Vendedor não encontrado' }

  const { error } = await adminClient.from('notifications').insert({
    organization_id: orgId,
    user_id: userId,
    sender_id: senderId,
    message,
  })

  if (error) return { success: false, message: `Erro ao enviar notificação: ${error.message}` }
  return { success: true, message: `Notificação enviada para ${seller.name}` }
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
