'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ACTIVITY_LABELS, type ActivityType } from '@/types/crm'
import { CheckCircle2, Plus } from 'lucide-react'

const TYPES: ActivityType[] = ['call', 'email', 'meeting', 'proposal_sent', 'whatsapp', 'note']

export function DealActivitySheet({ dealId, onSaved }: { dealId: string; onSaved?: () => void }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ActivityType>('call')
  const [outcome, setOutcome] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [nextStepDueAt, setNextStepDueAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/crm/deals/${dealId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        outcome,
        notes: nextStep ? `Próximo passo: ${nextStep}` : null,
        next_action_title: nextStep || null,
        next_action_due_at: nextStepDueAt || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Erro ao registrar atividade')
      return
    }
    setOutcome('')
    setNextStep('')
    setNextStepDueAt('')
    setOpen(false)
    onSaved?.()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        Registrar atividade
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Registrar atividade</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  className={`flex h-9 items-center justify-center rounded-lg border text-sm transition-colors ${
                    type === item ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  {ACTIVITY_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="outcome">O que aconteceu</Label>
            <Textarea
              id="outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              rows={5}
              placeholder="Ex.: Cliente pediu revisao de proposta e confirmou decisor financeiro."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next-step">Próximo passo</Label>
            <Input
              id="next-step"
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              placeholder="Ex.: Enviar nova versão até sexta"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next-step-due">Quando fazer</Label>
            <Input
              id="next-step-due"
              type="datetime-local"
              value={nextStepDueAt}
              onChange={(event) => setNextStepDueAt(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <SheetFooter>
          <Button onClick={submit} disabled={saving || !outcome.trim()} className="w-full">
            <CheckCircle2 className="h-4 w-4" />
            {saving ? 'Registrando...' : 'Registrar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
