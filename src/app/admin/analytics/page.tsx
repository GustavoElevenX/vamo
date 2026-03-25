'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingUp, Users, Building2 } from 'lucide-react'

export default function AdminAnalyticsPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    totalDiagnostics: 0,
    totalXpAwarded: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const [
        { count: orgs },
        { count: users },
        { count: diagnostics },
        { data: xpData },
      ] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('diagnostic_sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('xp_transactions').select('amount'),
      ])

      const totalXp = (xpData ?? []).reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0)

      setStats({
        totalOrgs: orgs ?? 0,
        totalUsers: users ?? 0,
        totalDiagnostics: diagnostics ?? 0,
        totalXpAwarded: totalXp,
      })
      setLoading(false)
    }
    fetch()
  }, [user])

  if (!user) return null

  const cards = [
    { label: 'Organizações', value: stats.totalOrgs, icon: Building2, sub: 'clientes ativos' },
    { label: 'Usuários', value: stats.totalUsers, icon: Users, sub: 'na plataforma' },
    { label: 'Diagnósticos', value: stats.totalDiagnostics, icon: BarChart3, sub: 'concluídos' },
    { label: 'XP Total', value: stats.totalXpAwarded.toLocaleString(), icon: TrendingUp, sub: 'distribuído' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Analytics</h2>
        <p className="text-muted-foreground">Métricas gerais da plataforma</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{loading ? '...' : card.value}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
