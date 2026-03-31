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
import { Sparkles, X } from 'lucide-react'

const ENERGY_OPTIONS = [
  { value: 1, emoji: '\u{1F614}', label: 'Muito baixa' },
  { value: 2, emoji: '\u{1F610}', label: 'Baixa' },
  { value: 3, emoji: '\u{1F642}', label: 'Normal' },
  { value: 4, emoji: '\u{1F604}', label: 'Boa' },
  { value: 5, emoji: '\u{1F525}', label: 'Excelente' },
]

const INTENTION_OPTIONS = [
  'Fechar uma venda',
  'Prospectar novos clientes',
  'Fazer follow-up com leads',
  'Atualizar o CRM',
  'Melhorar uma habilidade',
]

const OBSTACLE_OPTIONS = [
  'Sem obstáculos hoje',
  'Muitas tarefas acumuladas',
  'Falta de leads qualificados',
  'Desmotivação / cansaço',
]

const CHECKIN_STORAGE_KEY = 'motiva_checkin_date'

export function DailyCheckinModal() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [energy, setEnergy] = useState<number | null>(null)
  const [intention, setIntention] = useState<string | null>(null)
  const [obstacle, setObstacle] = useState<string | null>(null)
  const [customObstacle, setCustomObstacle] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'seller') return

    const today = new Date().toISOString().split('T')[0]
    const lastCheckin = localStorage.getItem(CHECKIN_STORAGE_KEY)

    if (lastCheckin === today) return

    // Verify with server
    fetch('/api/checkin')
      .then((res) => res.json())
      .then((data) => {
        if (data.checkin) {
          localStorage.setItem(CHECKIN_STORAGE_KEY, today)
        } else {
          setOpen(true)
        }
      })
      .catch(() => {
        setOpen(true)
      })
  }, [user])

  const handleSkip = useCallback(() => {
    setOpen(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!energy) return
    setSaving(true)

    try {
      const finalObstacle =
        obstacle === 'Sem obstáculos hoje'
          ? null
          : obstacle === 'outro'
            ? customObstacle || null
            : obstacle

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          energy_level: energy,
          intention,
          obstacle: finalObstacle,
        }),
      })

      if (res.ok) {
        const today = new Date().toISOString().split('T')[0]
        localStorage.setItem(CHECKIN_STORAGE_KEY, today)
        setOpen(false)
      }
    } catch {
      // silently fail — check-in is optional
    } finally {
      setSaving(false)
    }
  }, [energy, intention, obstacle, customObstacle])

  const handleNext = useCallback(() => {
    if (step < 2) {
      setStep((s) => s + 1)
    } else {
      handleSubmit()
    }
  }, [step, handleSubmit])

  if (!user || user.role !== 'seller') return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Check-in do dia
          </DialogTitle>
          <DialogDescription>
            {step === 0 && 'Como você está hoje?'}
            {step === 1 && 'Qual seu objetivo principal hoje?'}
            {step === 2 && 'Tem algum obstáculo hoje?'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 0 — Energia */}
          {step === 0 && (
            <div className="flex justify-center gap-3">
              {ENERGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEnergy(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl p-3 transition-all',
                    'hover:bg-accent/50',
                    energy === opt.value
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

          {/* Step 1 — Intenção */}
          {step === 1 && (
            <div className="flex flex-col gap-2">
              {INTENTION_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setIntention(opt)}
                  className={cn(
                    'rounded-lg px-4 py-3 text-left text-sm transition-all',
                    'hover:bg-accent/50',
                    intention === opt
                      ? 'bg-primary/15 ring-2 ring-primary font-medium'
                      : 'bg-card border border-border'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Obstáculo */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              {OBSTACLE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setObstacle(opt)
                    setCustomObstacle('')
                  }}
                  className={cn(
                    'rounded-lg px-4 py-3 text-left text-sm transition-all',
                    'hover:bg-accent/50',
                    obstacle === opt
                      ? 'bg-primary/15 ring-2 ring-primary font-medium'
                      : 'bg-card border border-border'
                  )}
                >
                  {opt}
                </button>
              ))}
              <button
                onClick={() => setObstacle('outro')}
                className={cn(
                  'rounded-lg px-4 py-3 text-left text-sm transition-all',
                  'hover:bg-accent/50',
                  obstacle === 'outro'
                    ? 'bg-primary/15 ring-2 ring-primary font-medium'
                    : 'bg-card border border-border'
                )}
              >
                Outro...
              </button>
              {obstacle === 'outro' && (
                <input
                  type="text"
                  placeholder="Descreva o obstáculo..."
                  value={customObstacle}
                  onChange={(e) => setCustomObstacle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              )}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pb-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'h-2 w-2 rounded-full transition-all',
                i === step ? 'bg-primary w-6' : i < step ? 'bg-primary/50' : 'bg-muted'
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
            disabled={
              (step === 0 && !energy) ||
              saving
            }
            className="flex-1"
          >
            {saving ? 'Salvando...' : step < 2 ? 'Próximo' : 'Concluir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
