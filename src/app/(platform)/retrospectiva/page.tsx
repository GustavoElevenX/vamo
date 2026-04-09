'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getCached, setCache } from '@/lib/cache'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  Target,
  BarChart3,
  DollarSign,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Calendar,
  ArrowRight,
} from 'lucide-react'

interface RetroData {
  id: string
  cycle_start: string
  cycle_end: string
  content: {
    o_que_foi_prometido: string
    o_que_foi_entregue: string
    impacto_financeiro: string
    fica_pro_proximo: string
    recomendacao_proximo_ciclo: string
  }
  created_at: string
}

const SECTIONS = [
  { key: 'o_que_foi_prometido', label: 'O que foi prometido', icon: Target, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { key: 'o_que_foi_entregue', label: 'O que foi entregue', icon: BarChart3, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { key: 'impacto_financeiro', label: 'Impacto financeiro', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  { key: 'fica_pro_proximo', label: 'O que fica para o próximo ciclo', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { key: 'recomendacao_proximo_ciclo', label: 'Recomendação para o próximo ciclo', icon: Lightbulb, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
] as const

export default function RetrospectivaPage() {
  const { user } = useAuth()
  const cachedRetros = useRef(getCached<RetroData[]>('retros'))
  const [retros, setRetros] = useState<RetroData[]>(cachedRetros.current ?? [])
  const [loading, setLoading] = useState(!cachedRetros.current)
  const [generating, setGenerating] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const fetchRetros = async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/ai/retrospectiva', { signal })
      if (!res.ok) return
      const data = await res.json()
      const items = data.retrospectives || []
      setRetros(items)
      setCache('retros', items, 5 * 60 * 1000)
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

    fetchRetros(controller.signal).finally(() => clearTimeout(timeout))

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
      const res = await fetch('/api/ai/retrospectiva', {
        method: 'POST',
        signal: controller.signal,
      })
      if (res.ok) {
        await fetchRetros()
      }
    } catch {
      // ignore
    } finally {
      clearTimeout(timeout)
      setGenerating(false)
    }
  }

  if (!user) return null

  const latest = retros[0] || null

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
            <RefreshCw className="h-5 w-5 text-primary" />
            Retrospectiva Mensal
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fechamento do ciclo de 30 dias com análise da VAMO IA
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
              Gerar Retrospectiva
            </>
          )}
        </Button>
      </div>

      {latest ? (
        <>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Ciclo: {new Date(latest.cycle_start + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
            {' — '}
            {new Date(latest.cycle_end + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>

          <div className="space-y-4">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const content = (latest.content as any)?.[section.key] || 'Sem dados suficientes.'

              return (
                <Card key={section.key} className={section.border}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg ${section.bg} flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${section.color}`} />
                      </div>
                      {section.label}
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

          {/* Botão Iniciar próximo ciclo */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between py-5">
              <div>
                <p className="text-sm font-semibold">Pronto para o próximo ciclo?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Os focos sugeridos já estarão pré-carregados nos objetivos
                </p>
              </div>
              <Link href="/objetivos/metas">
                <Button className="gap-2">
                  Iniciar próximo ciclo <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <RefreshCw className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Nenhuma retrospectiva gerada ainda.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em &quot;Gerar Retrospectiva&quot; para fechar o ciclo atual.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {retros.length > 1 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ciclos Anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {retros.slice(1).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                >
                  <span className="text-sm">
                    {new Date(r.cycle_start + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    {' — '}
                    {new Date(r.cycle_end + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
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
