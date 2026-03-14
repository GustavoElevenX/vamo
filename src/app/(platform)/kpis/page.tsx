'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Target } from 'lucide-react'
import type { KpiDefinition, KpiEntry } from '@/types'

export default function KpisPage() {
  const { user } = useAuth()
  const [kpis, setKpis] = useState<KpiDefinition[]>([])
  const [entries, setEntries] = useState<KpiEntry[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const today = new Date().toISOString().split('T')[0]

      const [{ data: kpiDefs }, { data: todayEntries }] = await Promise.all([
        supabase
          .from('kpi_definitions')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .order('name'),
        supabase
          .from('kpi_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('recorded_at', `${today}T00:00:00`)
          .lte('recorded_at', `${today}T23:59:59`)
          .order('recorded_at', { ascending: false }),
      ])

      setKpis(kpiDefs ?? [])
      setEntries(todayEntries ?? [])
      setLoading(false)
    }
    fetch()
  }, [user])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Meus KPIs</h2>
          <p className="text-muted-foreground">Registre seus indicadores do dia</p>
        </div>
        <Button render={<Link href="/kpis/registrar" />}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar KPI
</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : kpis.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum KPI configurado para sua organização.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => {
              const kpiEntries = entries.filter((e) => e.kpi_id === kpi.id)
              const totalValue = kpiEntries.reduce((sum, e) => sum + e.value, 0)
              const totalPoints = kpiEntries.reduce((sum, e) => sum + e.points_earned, 0)
              const dailyTarget = kpi.targets?.daily

              return (
                <Card key={kpi.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{totalValue}</span>
                      <span className="text-sm text-muted-foreground">{kpi.unit}</span>
                      {dailyTarget && (
                        <span className="text-xs text-muted-foreground">/ meta: {dailyTarget}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-primary font-medium">+{totalPoints} pts hoje</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {entries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registros de Hoje</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KPI</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const kpi = kpis.find((k) => k.id === entry.kpi_id)
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{kpi?.name ?? '-'}</TableCell>
                          <TableCell>{entry.value} {kpi?.unit}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">+{entry.points_earned}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(entry.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
