'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

export function AiSuggestionCard({ dealId, auto = false }: { dealId: string; auto?: boolean }) {
  const [loading, setLoading] = useState(auto)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium')

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/crm/deals/${dealId}/ai-suggestion`, { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setSuggestion(body.suggestion || null)
    setUrgency(body.urgency || 'medium')
    setLoading(false)
  }

  useEffect(() => {
    if (auto) load().catch(() => setLoading(false))
  }, [auto, dealId])

  if (!auto && !suggestion) {
    return (
      <button
        type="button"
        onClick={load}
        className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-primary/30 p-3 text-left text-xs text-muted-foreground hover:bg-primary/5"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        Gerar sugestao da VAMO IA
      </button>
    )
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            VAMO IA
          </span>
          <Badge variant={urgency === 'high' ? 'destructive' : 'secondary'}>{urgency}</Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {loading ? 'Analisando dados reais da oportunidade...' : suggestion}
        </p>
      </CardContent>
    </Card>
  )
}
