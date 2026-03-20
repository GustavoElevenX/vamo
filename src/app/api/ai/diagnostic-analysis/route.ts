import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenRouterJSON, isOpenRouterConfigured } from '@/lib/services/openrouter.service'
import { buildDiagnosticAnalysisPrompt } from '@/lib/ai/prompts'
import type { AIAnalysisResult, DiagnosticArea } from '@/types'

export async function POST(request: Request) {
  if (!isOpenRouterConfigured()) {
    return NextResponse.json({ error: 'IA não configurada' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { sessionId } = await request.json()
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

  // Check cache — return immediately if already analyzed
  const { data: cached } = await supabase
    .from('ai_analyses')
    .select('*')
    .eq('session_id', sessionId)
    .eq('analysis_type', 'diagnostic')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({ analysis: cached.result, cached: true })
  }

  // Fetch session
  const { data: session } = await supabase
    .from('diagnostic_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('organization_id', appUser.organization_id)
    .single()

  if (!session || session.status !== 'completed') {
    return NextResponse.json({ error: 'Diagnóstico não encontrado ou incompleto' }, { status: 404 })
  }

  // Fetch answers + questions in parallel for rich context
  const [{ data: answers }, { data: questions }] = await Promise.all([
    supabase
      .from('diagnostic_answers')
      .select('question_id, score, notes')
      .eq('session_id', sessionId),
    supabase
      .from('diagnostic_questions')
      .select('id, question_text, area, options, order_index, weight')
      .eq('template_id', session.template_id)
      .order('order_index', { ascending: true }),
  ])

  // Build Q&A context: match each answer to its question and find the selected option label
  const qa = (answers ?? [])
    .map((answer) => {
      const question = (questions ?? []).find((q) => q.id === answer.question_id)
      if (!question) return null
      const options = question.options as { label: string; value: number }[]
      const selectedOption = options.find((o) => o.value === answer.score)
      return {
        question_text: question.question_text,
        area: question.area as DiagnosticArea,
        selected_option_label: selectedOption?.label ?? `Score ${answer.score}`,
        score: answer.score,
        max_score: Math.max(...options.map((o) => o.value)),
        notes: answer.notes,
      }
    })
    .filter(Boolean) as {
      question_text: string
      area: DiagnosticArea
      selected_option_label: string
      score: number
      max_score: number
      notes?: string | null
    }[]

  // Sort by order_index via question lookup
  qa.sort((a, b) => {
    const qA = (questions ?? []).find((q) => q.question_text === a.question_text)?.order_index ?? 0
    const qB = (questions ?? []).find((q) => q.question_text === b.question_text)?.order_index ?? 0
    return qA - qB
  })

  try {
    const prompt = buildDiagnosticAnalysisPrompt({
      health_pct: session.health_pct,
      quadrant: session.quadrant ?? 'critical',
      area_scores: session.area_scores as Record<DiagnosticArea, { score: number; max: number; pct: number }>,
      respondent_name: session.respondent_name,
      qa,
    })

    const { data: analysis, model } = await callOpenRouterJSON<AIAnalysisResult>({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.3,
      maxTokens: 1800,
    })

    // Save to cache
    await supabase.from('ai_analyses').insert({
      session_id: sessionId,
      organization_id: appUser.organization_id,
      user_id: appUser.id,
      analysis_type: 'diagnostic',
      result: analysis,
      model_used: model,
    })

    return NextResponse.json({ analysis, cached: false })
  } catch (error: any) {
    console.error('AI diagnostic analysis error:', error)
    return NextResponse.json(
      { error: 'Análise IA indisponível no momento. Tente novamente.' },
      { status: 503 }
    )
  }
}
