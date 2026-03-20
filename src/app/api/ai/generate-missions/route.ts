import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenRouterJSON, isOpenRouterConfigured } from '@/lib/services/openrouter.service'
import { buildMissionGenerationPrompt } from '@/lib/ai/prompts'
import type { DiagnosticArea } from '@/types'

interface GeneratedMission {
  title: string
  description: string
  area: string
  difficulty: number
  xp_reward: number
  resources: { title: string; url?: string }[]
}

const VALID_AREAS = ['lead_generation', 'sales_process', 'team_management', 'tools_technology']

export async function POST(request: Request) {
  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ error: 'IA não configurada' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { sessionId, profileId } = await request.json()
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId é obrigatório' }, { status: 400 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  // Fetch diagnostic session
  const { data: session } = await supabase
    .from('diagnostic_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('organization_id', appUser.organization_id)
    .single()

  if (!session || session.status !== 'completed') {
    return NextResponse.json({ error: 'Diagnóstico não encontrado ou incompleto' }, { status: 404 })
  }

  // Fetch behavioral profile if provided
  let behavioralProfile = undefined
  if (profileId) {
    const { data: profile } = await supabase
      .from('behavioral_profiles')
      .select('profile_result')
      .eq('id', profileId)
      .single()

    if (profile?.profile_result) {
      behavioralProfile = profile.profile_result as any
    }
  } else {
    // Try to find user's existing profile
    const { data: profile } = await supabase
      .from('behavioral_profiles')
      .select('profile_result')
      .eq('user_id', appUser.id)
      .maybeSingle()

    if (profile?.profile_result) {
      behavioralProfile = profile.profile_result as any
    }
  }

  try {
    const prompt = buildMissionGenerationPrompt({
      health_pct: session.health_pct,
      quadrant: session.quadrant ?? 'critical',
      area_scores: session.area_scores as Record<DiagnosticArea, { score: number; max: number; pct: number }>,
      behavioralProfile,
    })

    const { data: missions } = await callOpenRouterJSON<GeneratedMission[]>({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.5,
      maxTokens: 1500,
    })

    // Validate and insert missions
    const validMissions = (Array.isArray(missions) ? missions : []).map((m) => ({
      organization_id: appUser.organization_id,
      user_id: appUser.id,
      session_id: sessionId,
      title: String(m.title || 'Missão'),
      description: String(m.description || ''),
      area: VALID_AREAS.includes(m.area) ? m.area : 'sales_process',
      difficulty: Math.min(3, Math.max(1, Number(m.difficulty) || 1)),
      xp_reward: Math.min(200, Math.max(10, Number(m.xp_reward) || 50)),
      criteria: {},
      resources: Array.isArray(m.resources) ? m.resources : [],
      status: 'pending',
    }))

    if (validMissions.length === 0) {
      return NextResponse.json({ error: 'Não foi possível gerar missões' }, { status: 500 })
    }

    const { data: inserted, error } = await supabase
      .from('ai_missions')
      .insert(validMissions)
      .select()

    if (error) throw error

    return NextResponse.json({ missions: inserted })
  } catch (error: any) {
    console.error('AI mission generation error:', error)
    return NextResponse.json(
      { error: 'Geração de missões indisponível no momento.' },
      { status: 503 }
    )
  }
}
