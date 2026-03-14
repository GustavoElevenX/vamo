'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DIAGNOSTIC_AREAS } from '@/lib/constants'
import type { DiagnosticTemplate, DiagnosticQuestion } from '@/types'

export default function AdminTemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<(DiagnosticTemplate & { questions?: DiagnosticQuestion[] })[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('diagnostic_templates')
        .select('*, diagnostic_questions(*)')
        .order('version', { ascending: false })
      setTemplates(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [user])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Templates de Diagnóstico</h2>
        <p className="text-muted-foreground">Questionários de auditoria comercial</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum template cadastrado. Execute o seed do banco de dados.
          </CardContent>
        </Card>
      ) : (
        templates.map((tmpl) => (
          <Card key={tmpl.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{tmpl.name}</CardTitle>
                <Badge variant="outline">v{tmpl.version}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                {tmpl.questions?.length ?? 0} perguntas
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Pergunta</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Peso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tmpl.questions
                    ?.sort((a, b) => a.order_index - b.order_index)
                    .map((q, i) => (
                      <TableRow key={q.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{q.question_text}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {DIAGNOSTIC_AREAS[q.area as keyof typeof DIAGNOSTIC_AREAS]}
                          </Badge>
                        </TableCell>
                        <TableCell>{q.weight}x</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
