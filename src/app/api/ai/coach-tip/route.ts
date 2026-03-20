import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenRouterJSON, isOpenRouterConfigured } from '@/lib/services/openrouter.service'
import { buildCoachTipPrompt } from '@/lib/ai/prompts'
import type { CoachTip } from '@/lib/ai/types'

export async function POST() {
  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ error: 'IA não configurada' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, name, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  try {
    // Gather user context
    const today = new Date().toISOString().split('T')[0]

    const [
      { data: userXp },
      { count: todayKpis },
      { data: latestDiagnostic },
    ] = await Promise.all([
      supabase
        .from('user_xp')
        .select('total_xp, current_level, current_streak')
        .eq('user_id', appUser.id)
        .maybeSingle(),
      supabase
        .from('kpi_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .gte('recorded_at', `${today}T00:00:00`)
        .lte('recorded_at', `${today}T23:59:59`),
      supabase
        .from('diagnostic_sessions')
        .select('health_pct, quadrant')
        .eq('organization_id', appUser.organization_id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const prompt = buildCoachTipPrompt({
      userName: appUser.name.split(' ')[0],
      level: userXp?.current_level ?? 1,
      streak: userXp?.current_streak ?? 0,
      totalXp: userXp?.total_xp ?? 0,
      recentKpiCount: todayKpis ?? 0,
      latestDiagnosticQuadrant: latestDiagnostic?.quadrant ?? undefined,
      latestDiagnosticHealthPct: latestDiagnostic?.health_pct ?? undefined,
    })

    const { data: tip } = await callOpenRouterJSON<CoachTip>({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.7,
      maxTokens: 300,
    })

    return NextResponse.json({ tip })
  } catch (error: any) {
    console.error('AI coach tip error:', error)
    return NextResponse.json(
      { error: 'Coach IA indisponível no momento.' },
      { status: 503 }
    )
  }
}
