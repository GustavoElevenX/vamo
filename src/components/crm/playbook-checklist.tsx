'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle } from 'lucide-react'
import type { DealStage, PlaybookStep, PlaybookStepCompletion } from '@/types/crm'

export function PlaybookChecklist({
  dealId,
  stage,
  role,
}: {
  dealId: string
  stage: DealStage
  currentUserId: string
  role: string
}) {
  const [steps, setSteps] = useState<PlaybookStep[]>([])
  const [completions, setCompletions] = useState<PlaybookStepCompletion[]>([])
  const readOnly = role === 'manager' || role === 'admin'

  async function load() {
    const [stepsRes, completionsRes] = await Promise.all([
      fetch(`/api/playbook/steps?stage=${stage}`),
      fetch(`/api/playbook/completions?deal_id=${dealId}`),
    ])
    const stepsBody = await stepsRes.json().catch(() => ({}))
    const completionsBody = await completionsRes.json().catch(() => ({}))
    setSteps(stepsBody.steps ?? [])
    setCompletions(completionsBody.completions ?? [])
  }

  useEffect(() => {
    load().catch(() => {})
  }, [dealId, stage])

  const completedIds = useMemo(() => new Set(completions.map((item) => item.step_id)), [completions])
  const pct = steps.length ? Math.round((steps.filter((step) => completedIds.has(step.id)).length / steps.length) * 100) : 0

  async function toggle(step: PlaybookStep) {
    if (readOnly || step.id.startsWith('default-')) return
    const completed = !completedIds.has(step.id)
    await fetch('/api/playbook/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_id: step.id, deal_id: dealId, completed }),
    })
    await load()
  }

  if (!steps.length) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Roteiro da etapa</CardTitle>
          <span className="text-sm font-semibold tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => {
          const done = completedIds.has(step.id)
          const disabled = readOnly || step.id.startsWith('default-')
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => toggle(step)}
              disabled={disabled}
              className="flex w-full items-start gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors enabled:hover:bg-muted/50 disabled:cursor-default"
            >
              {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
              <span>
                <span className="block text-sm font-medium">{step.title}</span>
                {step.description && <span className="block text-xs text-muted-foreground">{step.description}</span>}
              </span>
            </button>
          )
        })}
        {steps.some((step) => step.id.startsWith('default-')) && (
          <p className="text-xs text-muted-foreground">
            Passos padrão aparecem como guia. Para salvar aderência, personalize o roteiro da organização.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
