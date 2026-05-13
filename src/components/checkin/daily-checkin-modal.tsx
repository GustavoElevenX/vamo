'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
import type { CheckinQuestion } from '@/lib/services/checkin-question.service'

const ENERGY_OPTIONS = [
  { value: 1, emoji: '\u{1F614}', label: 'Muito baixa' },
  { value: 2, emoji: '\u{1F610}', label: 'Baixa' },
  { value: 3, emoji: '\u{1F642}', label: 'Normal' },
  { value: 4, emoji: '\u{1F604}', label: 'Boa' },
  { value: 5, emoji: '\u{1F525}', label: 'Excelente' },
]

function todayKey(userId: string) {
  const today = new Date().toISOString().split('T')[0]
  return `vamo_checkin_${userId}_${today}`
}

function dismissedKey(userId: string) {
  const today = new Date().toISOString().split('T')[0]
  return `vamo_checkin_dismissed_${userId}_${today}`
}

function answerIsFilled(value: unknown) {
  if (typeof value === 'string') return value.trim().length > 0
  return value !== null && value !== undefined && value !== ''
}

export function DailyCheckinModal() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [questions, setQuestions] = useState<CheckinQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'seller') return

    const completedKey = todayKey(user.id)
    const skippedKey = dismissedKey(user.id)

    if (localStorage.getItem(completedKey) === 'true') return
    if (localStorage.getItem(skippedKey) === 'true') return

    fetch('/api/checkin')
      .then((res) => res.json())
      .then((data) => {
        if (data.checkin) {
          localStorage.setItem(completedKey, 'true')
          return
        }

        if (data.shouldShow === false) return

        const nextQuestions = (data.questions ?? []) as CheckinQuestion[]
        setQuestions(nextQuestions)
        setAnswers({})
        setStep(0)
        setOpen(nextQuestions.length > 0)
      })
      .catch(() => {
        // Falha silenciosa: nao abrir automaticamente para evitar repeticao.
      })
  }, [user])

  const handleSkip = useCallback(() => {
    if (user?.id) {
      localStorage.setItem(dismissedKey(user.id), 'true')
    }
    setOpen(false)
  }, [user?.id])

  const setAnswer = useCallback((questionId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [questionId]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    const energyLevel = Number(answers.energy_level)
    if (!energyLevel) return
    setSaving(true)

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          energy_level: energyLevel,
          intention: String(answers.priority_focus || '') || null,
          obstacle: String(answers.blocker || '') || null,
          answers,
          question_set: questions,
        }),
      })

      if (res.ok && user?.id) {
        localStorage.setItem(todayKey(user.id), 'true')
        localStorage.removeItem(dismissedKey(user.id))
        setOpen(false)
      }
    } catch {
      // silently fail - check-in is optional
    } finally {
      setSaving(false)
    }
  }, [answers, questions, user?.id])

  const currentQuestion = questions[step]
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined
  const currentRequiredMissing = Boolean(currentQuestion?.required && !answerIsFilled(currentAnswer))

  const handleNext = useCallback(() => {
    if (step < questions.length - 1) {
      setStep((s) => s + 1)
    } else {
      handleSubmit()
    }
  }, [step, questions.length, handleSubmit])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      handleSkip()
      return
    }
    setOpen(true)
  }, [handleSkip])

  if (!user || user.role !== 'seller' || !currentQuestion) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Check-in do dia
          </DialogTitle>
          <DialogDescription>
            {currentQuestion.description || 'Responda em poucos segundos para calibrar seu dia.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-base font-semibold leading-snug">{currentQuestion.title}</p>

          {currentQuestion.type === 'energy' && (
            <div className="flex justify-center gap-3">
              {ENERGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnswer(currentQuestion.id, opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl p-3 transition-all',
                    'hover:bg-accent/50',
                    currentAnswer === opt.value
                      ? 'bg-primary/15 ring-2 ring-primary scale-110'
                      : 'bg-card'
                  )}
                >
                  <span className="text-3xl">{opt.emoji}</span>
                  <span className="text-xs text-muted-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'single_choice' && (
            <div className="flex flex-col gap-2">
              {(currentQuestion.options ?? []).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAnswer(currentQuestion.id, opt)}
                  className={cn(
                    'rounded-lg border px-4 py-3 text-left text-sm transition-all',
                    'hover:bg-accent/50',
                    currentAnswer === opt
                      ? 'border-primary bg-primary/15 ring-2 ring-primary font-medium'
                      : 'border-border bg-card'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'text' && (
            <input
              type="text"
              value={String(currentAnswer || '')}
              onChange={(event) => setAnswer(currentQuestion.id, event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          )}
        </div>

        <div className="flex justify-center gap-2 pb-2">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className={cn(
                'h-2 w-2 rounded-full transition-all',
                index === step ? 'bg-primary w-6' : index < step ? 'bg-primary/50' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip} className="flex-1">
            Pular
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentRequiredMissing || saving}
            className="flex-1"
          >
            {saving ? 'Salvando...' : step < questions.length - 1 ? 'Proximo' : 'Concluir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
