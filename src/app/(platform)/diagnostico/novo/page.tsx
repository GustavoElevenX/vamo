'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { DIAGNOSTIC_AREAS } from '@/lib/constants'
import type { DiagnosticQuestion, DiagnosticArea } from '@/types'

export default function NovoDiagnosticoPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [respondentName, setRespondentName] = useState('')
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1) // -1 = info step
  const [answers, setAnswers] = useState<Record<string, { score: number; notes: string }>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchQuestions = async () => {
      const { data: templates } = await supabase
        .from('diagnostic_templates')
        .select('id')
        .order('version', { ascending: false })
        .limit(1)

      if (!templates?.length) return

      const { data } = await supabase
        .from('diagnostic_questions')
        .select('*')
        .eq('template_id', templates[0].id)
        .order('order_index', { ascending: true })

      setQuestions(data ?? [])
    }
    fetchQuestions()
  }, [])

  if (!user) return null

  const progress = currentIndex < 0 ? 0 : Math.round(((currentIndex + 1) / questions.length) * 100)
  const currentQuestion = currentIndex >= 0 ? questions[currentIndex] : null
  const currentArea = currentQuestion?.area
  const areaLabel = currentArea ? DIAGNOSTIC_AREAS[currentArea] : ''

  const handleAnswer = (score: number) => {
    if (!currentQuestion) return
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { ...prev[currentQuestion.id], score, notes: prev[currentQuestion.id]?.notes ?? '' },
    }))
  }

  const handleNotes = (notes: string) => {
    if (!currentQuestion) return
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: { ...prev[currentQuestion.id], notes, score: prev[currentQuestion.id]?.score ?? 0 },
    }))
  }

  const handleSubmit = async () => {
    if (!user || submitting) return
    setSubmitting(true)

    try {
      const { data: templates } = await supabase
        .from('diagnostic_templates')
        .select('id')
        .order('version', { ascending: false })
        .limit(1)

      if (!templates?.length) return

      // Calculate scores
      const answerData = questions.map((q) => ({
        area: q.area as DiagnosticArea,
        score: answers[q.id]?.score ?? 0,
        weight: q.weight,
      }))

      const { calculateDiagnosticScores } = await import('@/lib/services/diagnostic.service')
      const results = calculateDiagnosticScores(answerData)

      // Create session
      const { data: session, error } = await supabase
        .from('diagnostic_sessions')
        .insert({
          organization_id: user.organization_id,
          template_id: templates[0].id,
          conducted_by: user.id,
          respondent_name: respondentName,
          status: 'completed',
          total_score: results.totalScore,
          max_score: results.maxScore,
          health_pct: results.healthPct,
          quadrant: results.quadrant,
          area_scores: results.areaScores,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      // Insert answers
      const answersToInsert = questions.map((q) => ({
        session_id: session.id,
        question_id: q.id,
        score: answers[q.id]?.score ?? 0,
        notes: answers[q.id]?.notes || null,
      }))

      await supabase.from('diagnostic_answers').insert(answersToInsert)

      router.push(`/diagnostico/${session.id}/relatorio`)
    } catch (err) {
      console.error('Erro ao salvar diagnóstico:', err)
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Novo Diagnóstico</h2>
        <p className="text-muted-foreground">Auditoria de performance comercial</p>
      </div>

      <Progress value={progress} className="h-2" />

      {currentIndex < 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Informações do Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="respondent">Nome do Respondente / Empresa</Label>
              <Input
                id="respondent"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="Ex: João Silva - Empresa XYZ"
              />
            </div>
            <Button
              onClick={() => setCurrentIndex(0)}
              disabled={!respondentName.trim()}
              className="w-full"
            >
              Iniciar Diagnóstico
            </Button>
          </CardContent>
        </Card>
      ) : currentQuestion ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {areaLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                {currentIndex + 1} / {questions.length}
              </span>
            </div>
            <CardTitle className="text-lg">{currentQuestion.question_text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {currentQuestion.options.map((opt) => (
                <Button
                  key={opt.value}
                  variant={answers[currentQuestion.id]?.score === opt.value ? 'default' : 'outline'}
                  className="justify-start text-left h-auto py-3"
                  onClick={() => handleAnswer(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={answers[currentQuestion.id]?.notes ?? ''}
                onChange={(e) => handleNotes(e.target.value)}
                placeholder="Anotações sobre esta resposta..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex((i) => i - 1)}
                disabled={currentIndex === 0}
              >
                Anterior
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (currentIndex < questions.length - 1) {
                    setCurrentIndex((i) => i + 1)
                  }
                }}
                disabled={answers[currentQuestion.id]?.score === undefined}
              >
                {currentIndex < questions.length - 1 ? 'Próxima' : 'Revisar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Finalizar Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Todas as {questions.length} perguntas foram respondidas para{' '}
              <strong>{respondentName}</strong>.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(questions.length - 1)}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Concluir Diagnóstico'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
