'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DIAGNOSTIC_AREAS, DIAGNOSTIC_QUADRANTS } from '@/lib/constants'
import type { DiagnosticSession, DiagnosticAnswer } from '@/types'

export default function DiagnosticoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [session, setSession] = useState<DiagnosticSession | null>(null)
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    const fetch = async () => {
      const { data: s } = await supabase
        .from('diagnostic_sessions')
        .select('*')
        .eq('id', id)
        .single()
      setSession(s)

      if (s) {
        const { data: a } = await supabase
          .from('diagnostic_answers')
          .select('*')
          .eq('session_id', id)
        setAnswers(a ?? [])
      }
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
        <h2 className="text-2xl font-bold">Diagnóstico não encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/diagnostico')}>
          Voltar
        </Button>
      </div>
    )
  }

  if (session.status === 'completed') {
    router.push(`/diagnostico/${id}/relatorio`)
    return null
  }

  const quadrant = session.quadrant ? DIAGNOSTIC_QUADRANTS[session.quadrant] : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{session.respondent_name}</h2>
          <p className="text-muted-foreground">
            Diagnóstico criado em {new Date(session.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <Badge variant="secondary">
          {session.status === 'in_progress' ? 'Em Andamento' : 'Rascunho'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Respostas Registradas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {answers.length} respostas registradas
          </p>
          <Button className="mt-4" render={<Link href={`/diagnostico/novo`} />}>Continuar Diagnóstico</Button>
        </CardContent>
      </Card>
    </div>
  )
}
