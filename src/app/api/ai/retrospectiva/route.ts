import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { callOpenAIJSON, isOpenAIConfigured } from '@/lib/services/openai.service'
import { callOpenRouterJSON, isOpenRouterConfigured } from '@/lib/services/openrouter.service'

interface RetrospectivaContent {
  o_que_foi_prometido: string
  o_que_foi_entregue: string
  impacto_financeiro: string
  fica_pro_proximo: string
  recomendacao_proximo_ciclo: string
}

export async function POST() {
  if (!isOpenAIConfigured() && !isOpenRouterConfigured()) {
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
    const cycleEnd = now.toISOString().split('T')[0]
    const cycleStart = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]

    // Duplicate prevention: block if a retrospective already covers this cycle
    const { data: recentRetro } = await adminClient
      .from('monthly_retrospectives')
      .select('id')
      .eq('organization_id', appUser.organization_id)
      .gte('cycle_end', cycleStart)
      .limit(1)
      .maybeSingle()

    if (recentRetro) {
      return NextResponse.json(
        { error: 'Já existe uma retrospectiva para este ciclo. Aguarde o próximo período de 30 dias.' },
        { status: 409 },
      )
    }

    // Gather cycle data
    const [
      { data: sellers },
      { data: kpiEntries },
      { data: missions },
      { data: diagnostics },
      { data: checkins },
      { data: kpiDefs },
    ] = await Promise.all([
      adminClient
        .from('users')
        .select('id, name')
        .eq('organization_id', appUser.organization_id)
        .eq('role', 'seller')
        .eq('active', true),
      supabase
        .from('kpi_entries')
        .select('user_id, value, points_earned, kpi_id')
        .eq('organization_id', appUser.organization_id)
        .gte('recorded_at', `${cycleStart}T00:00:00`),
      supabase
        .from('ai_missions')
        .select('user_id, title, status, xp_reward, area')
        .eq('organization_id', appUser.organization_id)
        .gte('created_at', `${cycleStart}T00:00:00`),
      supabase
        .from('diagnostic_sessions')
        .select('health_pct, quadrant, area_scores, total_score')
        .eq('organization_id', appUser.organization_id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(2),
      supabase
        .from('daily_checkins')
        .select('user_id, energy_level')
        .eq('organization_id', appUser.organization_id)
        .gte('checkin_date', cycleStart),
      supabase
        .from('kpi_definitions')
        .select('id, name, targets')
        .eq('organization_id', appUser.organization_id)
        .eq('active', true),
    ])

    const sellerCount = sellers?.length || 0
    const completedMissions = (missions || []).filter((m) => m.status === 'completed')
    const totalPoints = (kpiEntries || []).reduce((sum, e) => sum + (e.points_earned || 0), 0)
    const avgEnergy = checkins && checkins.length > 0
      ? (checkins.reduce((sum, c) => sum + c.energy_level, 0) / checkins.length).toFixed(1)
      : 'N/A'

    const latestDiag = diagnostics?.[0]
    const previousDiag = diagnostics?.[1]

    const kpiSummary = (kpiDefs || []).map((kpi) => {
      const entries = (kpiEntries || []).filter((e) => e.kpi_id === kpi.id)
      const total = entries.reduce((sum, e) => sum + (e.value || 0), 0)
      const monthlyTarget = (kpi.targets as any)?.monthly || 0
      return `${kpi.name}: ${total}/${monthlyTarget}`
    }).join(', ')

    const contextSummary = `
Retrospectiva do ciclo: ${cycleStart} a ${cycleEnd} (30 dias)

EQUIPE: ${sellerCount} vendedores ativos
MISSÕES: ${completedMissions.length} concluídas de ${missions?.length || 0} criadas
PONTOS TOTAIS: ${totalPoints}
KPIs DO CICLO: ${kpiSummary || 'Sem KPIs definidos'}
ENERGIA MÉDIA DA EQUIPE: ${avgEnergy}/5
DIAGNÓSTICO ATUAL: Saúde ${latestDiag?.health_pct || 'N/A'}% — Quadrante: ${latestDiag?.quadrant || 'N/A'}
${previousDiag ? `DIAGNÓSTICO ANTERIOR: Saúde ${previousDiag.health_pct}% — Quadrante: ${previousDiag.quadrant}` : ''}
ÁREAS DO DIAGNÓSTICO: ${latestDiag?.area_scores ? JSON.stringify(latestDiag.area_scores) : 'N/A'}
`.trim()

    const systemPrompt = `Você é um consultor sênior de desempenho comercial. Gere uma retrospectiva mensal completa para o gestor. A retrospectiva fecha o ciclo de 30 dias e prepara o próximo. Use dados concretos e seja direto.

Responda em JSON com exatamente estes 5 campos (strings em português, com markdown leve):
{
  "o_que_foi_prometido": "Objetivos e metas que foram definidos para este ciclo, com números",
  "o_que_foi_entregue": "Resultados reais vs metas — destaque KPIs que melhoraram e os que ficaram abaixo",
  "impacto_financeiro": "Estimativa de receita adicional gerada, ROI do ciclo, economia administrativa",
  "fica_pro_proximo": "Gargalos não resolvidos + novos gargalos identificados pelos dados",
  "recomendacao_proximo_ciclo": "3 focos prioritários para o próximo ciclo com justificativa baseada nos dados"
}`

    const aiParams = { systemPrompt, userPrompt: contextSummary, temperature: 0.5, maxTokens: 1200 }
    let retroContent: RetrospectivaContent
    let model: string

    if (isOpenAIConfigured()) {
      try {
        const result = await callOpenAIJSON<RetrospectivaContent>(aiParams)
        retroContent = result.data
        model = result.model
      } catch {
        const result = await callOpenRouterJSON<RetrospectivaContent>(aiParams)
        retroContent = result.data
        model = result.model
      }
    } else {
      const result = await callOpenRouterJSON<RetrospectivaContent>(aiParams)
      retroContent = result.data
      model = result.model
    }

    const { data: saved, error } = await adminClient
      .from('monthly_retrospectives')
      .insert({
        organization_id: appUser.organization_id,
        cycle_start: cycleStart,
        cycle_end: cycleEnd,
        content: retroContent,
        model_used: model,
      })
      .select()
      .single()

    if (error) {
      console.error('Retrospective save error:', error)
      return NextResponse.json({ error: 'Erro ao salvar retrospectiva' }, { status: 500 })
    }

    return NextResponse.json({ retrospective: saved })
  } catch (error: any) {
    console.error('Retrospective generation error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar retrospectiva.' },
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

  const { data: retrospectives } = await adminClient
    .from('monthly_retrospectives')
    .select('*')
    .eq('organization_id', appUser.organization_id)
    .order('cycle_end', { ascending: false })
    .limit(6)

  return NextResponse.json({ retrospectives: retrospectives || [] })
}
