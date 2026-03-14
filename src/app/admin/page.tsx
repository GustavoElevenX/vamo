'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, ClipboardCheck, TrendingUp } from 'lucide-react'

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [stats, setStats] = useState({ orgs: 0, users: 0, diagnostics: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const [{ count: orgs }, { count: users }, { count: diagnostics }] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('diagnostic_sessions').select('*', { count: 'exact', head: true }),
      ])
      setStats({ orgs: orgs ?? 0, users: users ?? 0, diagnostics: diagnostics ?? 0 })
      setLoading(false)
    }
    fetch()
  }, [user])

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Painel Administrativo</h2>
        <p className="text-muted-foreground">Visão geral da consultoria</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '...' : stats.orgs}</p>
            <p className="text-xs text-muted-foreground">organizações cadastradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '...' : stats.users}</p>
            <p className="text-xs text-muted-foreground">usuários ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Diagnósticos</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '...' : stats.diagnostics}</p>
            <p className="text-xs text-muted-foreground">realizados</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
