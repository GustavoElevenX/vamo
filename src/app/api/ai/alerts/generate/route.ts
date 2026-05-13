import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

interface GeneratedAlert {
  type: 'performance' | 'engagement' | 'opportunity' | 'milestone' | 'system'
  severity: 'critical' | 'warning' | 'opportunity' | 'positive'
  title: string
  description: string
  entity_type?: 'user' | 'team' | 'kpi' | 'mission' | 'system' | null
  entity_id?: string | null
  quick_action?: string | null
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI não configurado' }, { status: 503 })
    }

    const adminClient = createAdminClient()
    const { data: appUser } = await adminClient
      .from('users')
      .select('id, organization_id, role')
      .eq('auth_id', authUser.id)
      .single()

    if (!appUser || !['manager', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: 'Apenas gestores podem gerar alertas' }, { status: 403 })
    }

    const orgId = appUser.organization_id

    // ── Buscar dados reais em paralelo ──
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000).toISOString().split('T')[0]

    const [
      { data: sellers },
      { data: userXp },
      { data: kpiDefs },
      { data: kpiEntries },
      { data: missions },
      { data: checkins },
      { data: challenges },
    ] = await Promise.all([
      adminClient.from('users').select('id, name, email').eq('organization_id', orgId).eq('role', 'seller').eq('active', true),
      adminClient.from('user_xp').select('user_id, total_xp, current_level, current_streak, longest_streak, last_activity_date').eq('organization_id', orgId),
      supabase.from('kpi_definitions').select('id, name, unit, targets').eq('organization_id', orgId).eq('active', true),
      supabase.from('kpi_entries').select('user_id, kpi_id, value, points_earned, recorded_at').eq('organization_id', orgId).gte('recorded_at', twoWeeksAgo),
      supabase.from('ai_missions').select('user_id, status, created_at, completed_at').eq('organization_id', orgId).gte('created_at', `${twoWeeksAgo}T00:00:00`),
      adminClient.from('daily_checkins').select('user_id, energy_level, checkin_date').eq('organization_id', orgId).gte('checkin_date', weekAgo),
      supabase.from('challenges').select('id, title, end_date, active').eq('organization_id', orgId).eq('active', true),
    ])

    // ── Montar contexto estruturado ──
    const sellersWithXp = (sellers || []).map((s: { id: string; name: string }) => {
      const xp = userXp?.find((x: { user_id: string }) => x.user_id === s.id)
      const lastActive = xp?.last_activity_date
      const daysSinceActive = lastActive ? Math.floor((today.getTime() - new Date(lastActive).getTime()) / 86400000) : 999
      const sellerMissions = missions?.filter((m: { user_id: string }) => m.user_id === s.id) || []
      const activeMissions = sellerMissions.filter((m: { status: string }) => m.status === 'pending' || m.status === 'in_progress').length
      const completedMissions = sellerMissions.filter((m: { status: string }) => m.status === 'completed').length
      const sellerCheckins = checkins?.filter((c: { user_id: string; checkin_date: string }) => c.user_id === s.id) || []
      const avgEnergy = sellerCheckins.length > 0 ? sellerCheckins.reduce((sum: number, c: { energy_level: number }) => sum + c.energy_level, 0) / sellerCheckins.length : null
      const todayCheckin = sellerCheckins.find((c: { checkin_date: string }) => c.checkin_date === today.toISOString().split('T')[0])
      const todayEnergy: number | null = todayCheckin ? (todayCheckin as { energy_level: number }).energy_level : null
      const sellerKpis = kpiEntries?.filter((e: { user_id: string }) => e.user_id === s.id) || []

      return {
        id: s.id,
        name: s.name,
        total_xp: xp?.total_xp || 0,
        level: xp?.current_level || 1,
        streak: xp?.current_streak || 0,
        longest_streak: xp?.longest_streak || 0,
        days_since_active: daysSinceActive,
        active_missions: activeMissions,
        completed_missions_14d: completedMissions,
        avg_energy_7d: avgEnergy,
        today_energy: todayEnergy,
        kpi_entries_14d: sellerKpis.length,
      }
    })

    const kpiSummary = (kpiDefs || []).map((k: { id: string; name: string; targets: unknown }) => {
      const entries = kpiEntries?.filter((e: { kpi_id: string }) => e.kpi_id === k.id) || []
      const weekEntries = entries.filter((e: { recorded_at: string }) => e.recorded_at >= weekAgo)
      const prevWeekEntries = entries.filter((e: { recorded_at: string }) => e.recorded_at < weekAgo)
      const weekTotal = weekEntries.reduce((sum: number, e: { value: number }) => sum + (e.value || 0), 0)
      const prevWeekTotal = prevWeekEntries.reduce((sum: number, e: { value: number }) => sum + (e.value || 0), 0)
      const trend = prevWeekTotal > 0 ? Math.round(((weekTotal - prevWeekTotal) / prevWeekTotal) * 100) : 0
      return { id: k.id, name: k.name, week_total: weekTotal, prev_week_total: prevWeekTotal, trend_pct: trend, target: k.targets }
    })

    const contextData = {
      total_sellers: sellersWithXp.length,
      sellers: sellersWithXp,
      kpis: kpiSummary,
      active_challenges: challenges?.length || 0,
      total_missions_14d: missions?.length || 0,
      completed_missions_14d: missions?.filter((m: { status: string }) => m.status === 'completed').length || 0,
    }

    // ── Prompt para gerar alertas ──
    const systemPrompt = `Você é a VAMO IA — analista de desempenho comercial. Sua tarefa é analisar dados reais de uma equipe de vendas e gerar alertas acionáveis para o gestor.

REGRAS DE ANÁLISE:
- Vendedor inativo há 3+ dias → severity: critical, type: engagement, quick_action: "contact"
- Vendedor sem missões ativas há 2+ dias → severity: warning, type: engagement, quick_action: "assign_mission"
- KPI com tendência negativa (trend_pct < -10%) → severity: warning, type: desempenho, quick_action: "review_kpi"
- Vendedor com streak 5+ dias → severity: positive, type: milestone, quick_action: "award_xp"
- Vendedor com streak recorde (longest_streak >= 10) → severity: positive, type: milestone, quick_action: null
- Vendedor com today_energy = 1 (energia crítica hoje no check-in) → severity: critical, type: engagement, quick_action: "contact"
- Vendedor com today_energy = 2 (energia baixa hoje no check-in) → severity: warning, type: engagement, quick_action: "contact"
- Média de energia (avg_energy_7d) < 2.5 → severity: warning, type: engagement, quick_action: "contact"
- KPI com tendência positiva forte (trend_pct > 20%) → severity: opportunity, type: opportunity, quick_action: null
- Equipe sem missões ativas (total_missions < sellers) → severity: warning, type: engagement, quick_action: "chat"
- Vendedor com muitas missões completadas (completed_missions_14d >= 5) → severity: positive, quick_action: "award_xp"

FORMATO DE RESPOSTA:
Retorne APENAS um array JSON válido (sem markdown, sem explicações) com 3 a 8 alertas. Cada alerta tem:
{
  "type": "desempenho" | "engagement" | "opportunity" | "milestone" | "system",
  "severity": "critical" | "warning" | "opportunity" | "positive",
  "title": "título curto (max 80 chars)",
  "description": "descrição com dado concreto (max 200 chars)",
  "entity_type": "user" | "team" | "kpi" | "mission" | "system" | null,
  "entity_id": "id da entidade quando aplicável (use o id real do contexto)",
  "quick_action": "contact" | "assign_mission" | "award_xp" | "review_kpi" | "chat" | null
}

Se não houver dados suficientes (conta vazia/demo), retorne um array com um único alerta type: "system", severity: "opportunity", title: "Comece a usar a plataforma", description: "Adicione vendedores e defina KPIs para receber alertas contextualizados." com quick_action: "chat".

IMPORTANTE: Use nomes reais dos vendedores e IDs reais do contexto. Seja específico nos dados.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(contextData) },
        ],
        max_tokens: 2000,
        temperature: 0.5,
      }),
    })

    if (!response.ok) {
      const err = await response.text().catch(() => '')
      return NextResponse.json({ error: `Erro OpenAI: ${err}` }, { status: 502 })
    }

    const result = await response.json()
    const text = result.choices?.[0]?.message?.content || '[]'

    let alerts: GeneratedAlert[] = []
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      // Tentar extrair JSON array do texto
      const match = cleaned.match(/\[[\s\S]*\]/)
      alerts = match ? JSON.parse(match[0]) : JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Erro ao processar resposta da IA' }, { status: 500 })
    }

    // ── Limpar alertas antigos (> 7 dias) ──
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString()
    await adminClient
      .from('ai_alerts')
      .delete()
      .eq('organization_id', orgId)
      .lt('created_at', sevenDaysAgo)

    // ── Inserir novos alertas ──
    const alertsToInsert = alerts.map((a) => ({
      organization_id: orgId,
      type: a.type || 'system',
      severity: a.severity || 'opportunity',
      title: String(a.title || '').slice(0, 200),
      description: a.description ? String(a.description).slice(0, 500) : null,
      entity_type: a.entity_type || null,
      entity_id: a.entity_id || null,
      quick_action: a.quick_action || null,
      read: false,
    }))

    if (alertsToInsert.length === 0) {
      return NextResponse.json({ alerts: [] })
    }

    const { data: inserted, error: insertError } = await adminClient
      .from('ai_alerts')
      .insert(alertsToInsert)
      .select()

    if (insertError) {
      console.error('Insert alerts error:', insertError)
      return NextResponse.json({ error: `Erro ao salvar alertas: ${insertError.message}` }, { status: 500 })
    }

    return NextResponse.json({ alerts: inserted })
  } catch (error) {
    console.error('Generate alerts error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
