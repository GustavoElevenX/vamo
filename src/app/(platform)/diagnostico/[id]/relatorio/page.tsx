'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft } from 'lucide-react'
import { DIAGNOSTIC_AREAS, DIAGNOSTIC_QUADRANTS } from '@/lib/constants'
import type { DiagnosticSession, DiagnosticArea } from '@/types'

export default function RelatorioPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [session, setSession] = useState<DiagnosticSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    const fetch = async () => {
      const { data } = await supabase
        .from('diagnostic_sessions')
        .select('*')
        .eq('id', id)
        .single()
      setSession(data)
      setLoading(false)
    }
    fetch()
  }, [user, id])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Relatório não encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/diagnostico')}>Voltar</Button>
      </div>
    )
  }

  const quadrant = session.quadrant ? DIAGNOSTIC_QUADRANTS[session.quadrant] : null
  const areas = Object.entries(session.area_scores || {}) as [DiagnosticArea, { score: number; max: number; pct: number }][]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/diagnostico')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Relatório de Diagnóstico</h2>
          <p className="text-muted-foreground">{session.respondent_name}</p>
        </div>
      </div>

      {/* Score Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Score Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" className="text-muted" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={quadrant?.color ?? '#6b7280'}
                  strokeWidth="10"
                  strokeDasharray={`${(session.health_pct / 100) * 314} 314`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-2xl font-bold">{session.health_pct}%</span>
            </div>
            <div>
              {quadrant && (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: quadrant.color }} />
                  <span className="text-xl font-bold">{quadrant.label}</span>
                </div>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {session.total_score} / {session.max_score} pontos
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(session.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown por Área */}
      <div className="grid gap-4 md:grid-cols-2">
        {areas.map(([area, scores]) => {
          const areaLabel = DIAGNOSTIC_AREAS[area]
          const areaQuadrant = scores.pct >= 75 ? 'optimized' : scores.pct >= 50 ? 'developing' : scores.pct >= 25 ? 'at_risk' : 'critical'
          const areaColor = DIAGNOSTIC_QUADRANTS[areaQuadrant].color

          return (
            <Card key={area}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{areaLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold" style={{ color: areaColor }}>
                      {scores.pct}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {scores.score}/{scores.max}
                    </span>
                  </div>
                  <Progress value={scores.pct} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
