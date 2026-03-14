'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react'
import type { ChecklistTemplate } from '@/types'

export default function ChecklistPage() {
  const searchParams = useSearchParams()
  const checklistId = searchParams.get('id')
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [template, setTemplate] = useState<ChecklistTemplate | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !checklistId) return
    const fetch = async () => {
      const { data } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('id', checklistId)
        .single()
      setTemplate(data)

      // Check if already completed today
      const today = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('checklist_completions')
        .select('*')
        .eq('template_id', checklistId)
        .eq('user_id', user.id)
        .gte('completed_at', `${today}T00:00:00`)
        .limit(1)

      if (existing?.length) {
        setChecked(existing[0].items_completed)
      }

      setLoading(false)
    }
    fetch()
  }, [user, checklistId])

  if (!user) return null

  const toggleItem = (itemId: string) => {
    setChecked((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  const allChecked = template?.items.every((item) => checked[item.id]) ?? false

  const handleSubmit = async () => {
    if (!template || submitting) return
    setSubmitting(true)

    await supabase.from('checklist_completions').insert({
      template_id: template.id,
      user_id: user.id,
      organization_id: user.organization_id,
      items_completed: checked,
      fully_completed: allChecked,
      completed_at: new Date().toISOString(),
    })

    if (allChecked && template.xp_reward > 0) {
      await fetch('/api/gamification/award-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          organizationId: user.organization_id,
          amount: template.xp_reward,
          sourceType: 'checklist',
          sourceId: template.id,
          description: `Checklist concluído: ${template.title}`,
        }),
      })
    }

    router.push('/padronizacao')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Checklist não encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/padronizacao')}>Voltar</Button>
      </div>
    )
  }

  const completedCount = template.items.filter((item) => checked[item.id]).length

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/padronizacao')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{template.title}</h2>
          <p className="text-muted-foreground">
            {completedCount}/{template.items.length} itens • +{template.xp_reward} XP
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {template.items
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  {checked[item.id] ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <span className={checked[item.id] ? 'line-through text-muted-foreground' : ''}>
                    {item.text}
                  </span>
                </button>
              ))}
          </div>

          <Button
            className="mt-6 w-full"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Salvando...' : allChecked ? 'Concluir e Ganhar XP' : 'Salvar Progresso'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
