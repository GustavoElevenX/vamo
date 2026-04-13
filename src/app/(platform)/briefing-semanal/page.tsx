'use client'

import { useState, useEffect, useRef } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { getCached, setCache } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EnergyThermometer } from '@/components/dashboard/energy-thermometer'
import {
  Newspaper,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  Target,
  Zap,
  RefreshCw,
  Calendar,
  Sparkles,
} from 'lucide-react'

interface BriefingData {
  id: string
  week_start: string
  content: {
    o_que_foi_bem: string
    o_que_preocupa: string
    quem_precisa_atencao: string
    prioridade_semana: string
    acao_recomendada: string
  }
  created_at: string
}

const BLOCKS = [
  { key: 'o_que_foi_bem', label: 'O que foi bem', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { key: 'o_que_preocupa', label: 'O que preocupa', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { key: 'quem_precisa_atencao', label: 'Quem precisa de atenção', icon: UserCheck, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { key: 'prioridade_semana', label: 'Prioridade da semana', icon: Target, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { key: 'acao_recomendada', label: 'Ação recomendada hoje', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
] as const

export default function BriefingSemanalPage() {
  const { user } = useRequiredAuth()
  const cachedBriefings = useRef(getCached<BriefingData[]>('briefings'))
  const [briefings, setBriefings] = useState<BriefingData[]>(cachedBriefings.current ?? [])
  const [loading, setLoading] = useState(!cachedBriefings.current)
  const [generating, setGenerating] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const fetchBriefings = async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/ai/briefing-semanal', { signal })
      if (!res.ok) return
      const data = await res.json()
      const items = data.briefings || []
      setBriefings(items)
      setCache('briefings', items, 5 * 60 * 1000)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    abortRef.current = controller

    fetchBriefings(controller.signal).finally(() => clearTimeout(timeout))

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [user])

  const handleGenerate = async () => {
    setGenerating(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)
    try {
      const res = await fetch('/api/ai/briefing-semanal', {
        method: 'POST',
        signal: controller.signal,
      })
      if (res.ok) {
        await fetchBriefings()
      }
    } catch {
      // ignore
    } finally {
      clearTimeout(timeout)
      setGenerating(false)
    }
  }


  const latest = briefings[0] || null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Newspaper className="h-5 w-5 text-primary" />
            Briefing Semanal
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Síntese da semana gerada pela VAMO IA — leia em 2 minutos e aja
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="gap-2"
        >
          {generating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar Briefing
            </>
          )}
        </Button>
      </div>

      {/* Termômetro de Energia */}
      <EnergyThermometer organizationId={user.organization_id} />

      {/* Briefing Content */}
      {latest ? (
        <>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Semana de {new Date(latest.week_start + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
            {' · '}
            Gerado em {new Date(latest.created_at).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>

          <div className="space-y-4">
            {BLOCKS.map((block) => {
              const Icon = block.icon
              const content = (latest.content as any)?.[block.key] || 'Sem dados suficientes.'

              return (
                <Card key={block.key} className={`${block.border}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg ${block.bg} flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${block.color}`} />
                      </div>
                      {block.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {content}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Newspaper className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Nenhum briefing gerado ainda.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em &quot;Gerar Briefing&quot; para criar o primeiro.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Historical briefings */}
      {briefings.length > 1 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Briefings Anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {briefings.slice(1).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                >
                  <span className="text-sm">
                    Semana de {new Date(b.week_start + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
