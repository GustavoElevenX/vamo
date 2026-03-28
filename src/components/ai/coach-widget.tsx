'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import type { CoachTip } from '@/lib/ai/types'

const categoryLabels: Record<string, string> = {
  motivacional: 'Motivacional',
  tecnica: 'Técnica',
  comportamental: 'Comportamental',
  estrategica: 'Estratégica',
}

const categoryColors: Record<string, string> = {
  motivacional: 'text-amber-500',
  tecnica: 'text-blue-500',
  comportamental: 'text-green-500',
  estrategica: 'text-purple-500',
}

export function CoachWidget() {
  const [tip, setTip] = useState<CoachTip | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshCount, setRefreshCount] = useState(0)

  const fetchTip = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/coach-tip', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTip(data.tip)
      }
    } catch {
      // Silently fail - widget is non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTip()
  }, [])

  const handleRefresh = () => {
    if (refreshCount >= 5) return // Rate limit
    setRefreshCount((c) => c + 1)
    fetchTip()
  }

  // Don't render if loading initially failed and no tip
  if (!loading && !tip) return null

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary">Coach VAMO IA</span>
              {tip?.category && (
                <span className={`text-xs ${categoryColors[tip.category] ?? 'text-muted-foreground'}`}>
                  {categoryLabels[tip.category] ?? tip.category}
                </span>
              )}
            </div>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Pensando...</span>
              </div>
            ) : (
              <p className="text-sm">{tip?.tip}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleRefresh}
            disabled={loading || refreshCount >= 5}
            title={refreshCount >= 5 ? 'Limite de dicas atingido' : 'Nova dica'}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
