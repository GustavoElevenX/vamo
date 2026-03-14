import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateDiagnosticScores } from '@/lib/services/diagnostic.service'
import type { DiagnosticArea } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { sessionId } = await request.json()

  // Get session answers with question data
  const { data: answers, error } = await supabase
    .from('diagnostic_answers')
    .select('score, diagnostic_questions!inner(area, weight)')
    .eq('session_id', sessionId)

  if (error || !answers) {
    return NextResponse.json({ error: 'Erro ao buscar respostas' }, { status: 500 })
  }

  const mapped = answers.map((a: any) => ({
    area: (Array.isArray(a.diagnostic_questions) ? a.diagnostic_questions[0]?.area : a.diagnostic_questions?.area) as DiagnosticArea,
    score: a.score as number,
    weight: (Array.isArray(a.diagnostic_questions) ? a.diagnostic_questions[0]?.weight : a.diagnostic_questions?.weight) as number,
  }))

  const result = calculateDiagnosticScores(mapped)

  // Update session
  await supabase
    .from('diagnostic_sessions')
    .update({
      total_score: result.totalScore,
      max_score: result.maxScore,
      health_pct: result.healthPct,
      quadrant: result.quadrant,
      area_scores: result.areaScores,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  return NextResponse.json(result)
}
