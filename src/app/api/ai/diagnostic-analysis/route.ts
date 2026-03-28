// VAMO IA — Análise diagnóstica via OpenAI
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenAIJSON, isOpenAIConfigured } from '@/lib/services/openai.service'
import { buildDiagnosticAnalysisPrompt } from '@/lib/ai/prompts'
import type { AIAnalysisResult, DiagnosticArea } from '@/types'

export async function POST(request: Request) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: 'VAMO IA não configurada' }, { status: 503 })
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

  // Build Q&A context from ai_qa (new AI-generated wizard) or legacy tables
  type QAItem = {
    question_text: string
    area: DiagnosticArea
    selected_option_label: string
    score: number
    max_score: number
    notes?: string | null
  }

  let qa: QAItem[] = []

  const aiQa = session.ai_qa as { questions?: any[]; answers?: Record<string, number> } | null
  if (aiQa?.questions && aiQa?.answers) {
    // New wizard: Q&A stored directly in diagnostic_sessions.ai_qa
    qa = aiQa.questions
      .map((q: any) => {
        const selectedValue = aiQa.answers![q.id]
        if (selectedValue === undefined) return null
        const options = q.options as { label: string; value: number }[]
        const selectedOption = options.find((o) => o.value === selectedValue)
        return {
          question_text: q.question,
          area: q.area as DiagnosticArea,
          selected_option_label: selectedOption?.label ?? `Opção ${selectedValue}`,
          score: selectedValue,
          max_score: Math.max(...options.map((o: any) => o.value)),
          notes: null,
        }
      })
      .filter(Boolean) as QAItem[]
  } else {
    // Legacy: fetch from separate tables
    const [{ data: answers }, { data: questions }] = await Promise.all([
      supabase
        .from('diagnostic_answers')
        .select('question_id, score, notes')
        .eq('session_id', sessionId),
      supabase
        .from('diagnostic_questions')
        .select('id, question_text, area, options, order_index')
        .eq('template_id', session.template_id)
        .order('order_index', { ascending: true }),
    ])

    qa = (answers ?? [])
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
      .filter(Boolean) as QAItem[]
  }

  try {
    const prompt = buildDiagnosticAnalysisPrompt({
      health_pct: session.health_pct,
      quadrant: session.quadrant ?? 'critical',
      area_scores: session.area_scores as Record<DiagnosticArea, { score: number; max: number; pct: number }>,
      respondent_name: session.respondent_name,
      qa,
    })

    const { data: analysis, model } = await callOpenAIJSON<AIAnalysisResult>({
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
      { error: 'Análise VAMO IA indisponível no momento. Tente novamente.' },
      { status: 503 }
    )
  }
}
