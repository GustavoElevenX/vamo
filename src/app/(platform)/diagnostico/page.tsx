'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Eye } from 'lucide-react'
import { DIAGNOSTIC_QUADRANTS } from '@/lib/constants'
import type { DiagnosticSession } from '@/types'

export default function DiagnosticoPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<DiagnosticSession[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('diagnostic_sessions')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('created_at', { ascending: false })
      setSessions(data ?? [])
      setLoading(false)
    }
    fetch().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Diagnósticos</h2>
          <p className="text-muted-foreground">Auditorias de performance comercial</p>
        </div>
        {(user.role === 'admin' || user.role === 'manager') && (
          <Button render={<Link href="/diagnostico/novo" />}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Diagnóstico
</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Nenhum diagnóstico realizado ainda.</p>
            {(user.role === 'admin' || user.role === 'manager') && (
              <Button className="mt-4" render={<Link href="/diagnostico/novo" />}>Criar Primeiro Diagnóstico</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const quadrant = session.quadrant ? DIAGNOSTIC_QUADRANTS[session.quadrant] : null
            return (
              <Card key={session.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{session.respondent_name}</CardTitle>
                    <Badge
                      variant={session.status === 'completed' ? 'default' : 'secondary'}
                    >
                      {session.status === 'completed' ? 'Concluído' : session.status === 'in_progress' ? 'Em Andamento' : 'Rascunho'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {session.status === 'completed' && quadrant && (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: quadrant.color }}
                        />
                        <span className="text-sm font-medium">{quadrant.label}</span>
                        <span className="text-sm text-muted-foreground">
                          ({session.health_pct}%)
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="flex gap-2 pt-2">
                      {session.status === 'completed' ? (
                        <Button variant="outline" size="sm" render={<Link href={`/diagnostico/${session.id}/relatorio`} />}>
                            <Eye className="mr-1 h-3 w-3" />
                            Relatório
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" render={<Link href={`/diagnostico/${session.id}`} />}>
                            Continuar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
