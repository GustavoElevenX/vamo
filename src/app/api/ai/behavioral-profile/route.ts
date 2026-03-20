import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenRouterJSON, isOpenRouterConfigured } from '@/lib/services/openrouter.service'
import { buildBehavioralProfilePrompt } from '@/lib/ai/prompts'
import type { BehavioralProfile, BehavioralAnswer } from '@/lib/ai/types'

export async function POST(request: Request) {
  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ error: 'IA não configurada' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { answers } = await request.json() as { answers: BehavioralAnswer[] }
  if (!answers || answers.length === 0) {
    return NextResponse.json({ error: 'Respostas são obrigatórias' }, { status: 400 })
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  try {
    const prompt = buildBehavioralProfilePrompt(answers)

    const { data: profile, model } = await callOpenRouterJSON<BehavioralProfile>({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.3,
      maxTokens: 1000,
    })

    // Ensure DISC scores reflect actual D/I/S/C answers (E/A are separate dimensions)
    const traitCounts = { D: 0, I: 0, S: 0, C: 0 }
    for (const a of answers) {
      if (a.selected_option === 'D' || a.selected_option === 'I' || a.selected_option === 'S' || a.selected_option === 'C') {
        traitCounts[a.selected_option]++
      }
    }
    const total = answers.length
    profile.scores = {
      D: Math.round((traitCounts.D / total) * 100),
      I: Math.round((traitCounts.I / total) * 100),
      S: Math.round((traitCounts.S / total) * 100),
      C: Math.round((traitCounts.C / total) * 100),
    }

    // Upsert behavioral profile
    const { data: existing } = await supabase
      .from('behavioral_profiles')
      .select('id')
      .eq('user_id', appUser.id)
      .eq('organization_id', appUser.organization_id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('behavioral_profiles')
        .update({
          answers,
          profile_result: profile,
          model_used: model,
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('behavioral_profiles').insert({
        user_id: appUser.id,
        organization_id: appUser.organization_id,
        answers,
        profile_result: profile,
        model_used: model,
      })
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error('AI behavioral profile error:', error)
    return NextResponse.json(
      { error: 'Análise comportamental indisponível no momento.' },
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

  const { data: appUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', authUser.id)
    .single()

  if (!appUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('behavioral_profiles')
    .select('*')
    .eq('user_id', appUser.id)
    .eq('organization_id', appUser.organization_id)
    .maybeSingle()

  return NextResponse.json({ profile: profile?.profile_result ?? null })
}
