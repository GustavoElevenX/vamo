import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callOpenAIJSON, isOpenAIConfigured } from '@/lib/services/openai.service'

interface BriefingContent {
  o_que_foi_bem: string
  o_que_preocupa: string
  quem_precisa_atencao: string
  prioridade_semana: string
  acao_recomendada: string
}

export async function POST() {
  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: 'VAMO IA não configurada' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, organization_id, role')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser || !['manager', 'admin', 'consultant'].includes(appUser.role)) {
    return NextResponse.json({ error: 'Acesso restrito a gestores' }, { status: 403 })
  }

  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    // Get team data
    const [
      { data: sellers },
      { data: kpiEntries },
      { data: missions },
      { data: checkins },
    ] = await Promise.all([
      adminClient
        .from('users')
        .select('id, name')
        .eq('organization_id', appUser.organization_id)
        .eq('role', 'seller')
        .eq('active', true),
      supabase
        .from('kpi_entries')
        .select('user_id, value, points_earned, kpi_id, recorded_at')
        .eq('organization_id', appUser.organization_id)
        .gte('recorded_at', `${weekAgo}T00:00:00`),
      supabase
        .from('ai_missions')
        .select('user_id, title, status, xp_reward')
        .eq('organization_id', appUser.organization_id)
        .gte('created_at', `${weekAgo}T00:00:00`),
      supabase
        .from('daily_checkins')
        .select('user_id, energy_level, obstacle, checkin_date')
        .eq('organization_id', appUser.organization_id)
        .gte('checkin_date', weekAgo)
        .lte('checkin_date', today),
    ])

    const sellerNames = (sellers || []).reduce((map: Record<string, string>, s) => {
      map[s.id] = s.name
      return map
    }, {})

    // Build context summary for AI
    const sellerCount = sellers?.length || 0
    const completedMissions = (missions || []).filter((m) => m.status === 'completed')
    const totalKpiEntries = kpiEntries?.length || 0
    const totalPoints = (kpiEntries || []).reduce((sum, e) => sum + (e.points_earned || 0), 0)

    // Check-in analysis
    const lowEnergyUsers: string[] = []
    const obstacleUsers: string[] = []
    const sellerCheckins: Record<string, number[]> = {}

    for (const c of checkins || []) {
      if (!sellerCheckins[c.user_id]) sellerCheckins[c.user_id] = []
      sellerCheckins[c.user_id].push(c.energy_level)
      if (c.energy_level <= 2) lowEnergyUsers.push(sellerNames[c.user_id] || c.user_id)
      if (c.obstacle) obstacleUsers.push(sellerNames[c.user_id] || c.user_id)
    }

    // Users with no check-in this week
    const noCheckinUsers = (sellers || [])
      .filter((s) => !sellerCheckins[s.id])
      .map((s) => s.name)

    const contextSummary = `
Resumo da semana (${weekAgo} a ${today}):
- Equipe: ${sellerCount} vendedores ativos
- KPIs registrados: ${totalKpiEntries} entradas, ${totalPoints} pontos totais
- Missões concluídas: ${completedMissions.length} de ${missions?.length || 0}
- Check-ins realizados: ${(checkins || []).length} no total
- Vendedores com energia baixa (1-2): ${lowEnergyUsers.length > 0 ? lowEnergyUsers.join(', ') : 'nenhum'}
- Vendedores com obstáculo declarado: ${obstacleUsers.length > 0 ? obstacleUsers.join(', ') : 'nenhum'}
- Sem check-in esta semana: ${noCheckinUsers.length > 0 ? noCheckinUsers.join(', ') : 'nenhum'}
- Missões completadas: ${completedMissions.map((m) => `${sellerNames[m.user_id] || 'Vendedor'}: "${m.title}" (+${m.xp_reward}XP)`).join('; ') || 'nenhuma'}
`.trim()

    const systemPrompt = `Você é um consultor sênior de performance comercial. Gere um briefing semanal para o gestor de uma equipe de vendas. O briefing deve ser prático, direto e acionável. O gestor deve conseguir agir SEM precisar abrir outra tela.

Responda em JSON com exatamente estes 5 campos (strings em português, com markdown leve para formatação):
{
  "o_que_foi_bem": "Top 2-3 resultados positivos da semana com números concretos",
  "o_que_preocupa": "Alertas que merecem atenção — queda de KPI, engajamento baixo, missão expirando",
  "quem_precisa_atencao": "Nome + motivo + nível de urgência para cada colaborador em risco",
  "prioridade_semana": "O único foco mais importante para esta semana, baseado no gargalo atual",
  "acao_recomendada": "Uma ação específica e direta que o gestor deve fazer HOJE"
}`

    const { data: briefingContent, model } = await callOpenAIJSON<BriefingContent>({
      systemPrompt,
      userPrompt: contextSummary,
      temperature: 0.5,
      maxTokens: 1000,
    })

    // Calculate week_start (last Monday)
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const weekStart = monday.toISOString().split('T')[0]

    // Save to DB
    const { data: saved, error } = await supabase
      .from('weekly_briefings')
      .upsert(
        {
          organization_id: appUser.organization_id,
          generated_by: appUser.id,
          week_start: weekStart,
          content: briefingContent,
          model_used: model,
        },
        { onConflict: 'organization_id,week_start' }
      )
      .select()
      .single()

    if (error) {
      // If upsert fails (no unique constraint), just insert
      const { data: inserted } = await supabase
        .from('weekly_briefings')
        .insert({
          organization_id: appUser.organization_id,
          generated_by: appUser.id,
          week_start: weekStart,
          content: briefingContent,
          model_used: model,
        })
        .select()
        .single()

      return NextResponse.json({ briefing: inserted })
    }

    return NextResponse.json({ briefing: saved })
  } catch (error: any) {
    console.error('Briefing generation error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar briefing semanal.' },
      { status: 503 }
    )
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const { data: briefings } = await supabase
    .from('weekly_briefings')
    .select('*')
    .eq('organization_id', appUser.organization_id)
    .order('week_start', { ascending: false })
    .limit(4)

  return NextResponse.json({ briefings: briefings || [] })
}
