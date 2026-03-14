'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Eye } from 'lucide-react'
import { DIAGNOSTIC_QUADRANTS } from '@/lib/constants'
import type { DiagnosticSession } from '@/types'

export default function AdminDiagnosticosPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<(DiagnosticSession & { organizations?: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('diagnostic_sessions')
        .select('*, organizations(name)')
        .order('created_at', { ascending: false })
      setSessions(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [user])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Todos os Diagnósticos</h2>
        <p className="text-muted-foreground">Visão geral de todas as auditorias</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum diagnóstico registrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Respondente</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Quadrante</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const quadrant = s.quadrant ? DIAGNOSTIC_QUADRANTS[s.quadrant] : null
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.respondent_name}</TableCell>
                      <TableCell>{s.organizations?.name ?? '-'}</TableCell>
                      <TableCell>
                        {quadrant && (
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: quadrant.color }} />
                            {quadrant.label}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{s.health_pct}%</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" render={<Link href={`/diagnostico/${s.id}/relatorio`} />}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
