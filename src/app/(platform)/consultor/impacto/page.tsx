'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Award,
} from 'lucide-react'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ConsultorImpactoPage() {
  const { user } = useAuth()
  const supabaseRef = useRef(createClient())
  const [loading, setLoading] = useState(true)
  const [totalSellers, setTotalSellers] = useState(0)
  const [totalClients, setTotalClients] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [totalMissionsCompleted, setTotalMissionsCompleted] = useState(0)
  const [estimatedRevenue, setEstimatedRevenue] = useState(0)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const supabase = supabaseRef.current

      const { data: portfolio } = await supabase
        .from('consultant_portfolio')
        .select('organization_id')
        .eq('consultant_user_id', user.id)

      if (!portfolio || portfolio.length === 0) {
        setLoading(false)
        return
      }

      const orgIds = portfolio.map((p: { organization_id: string }) => p.organization_id)
      setTotalClients(orgIds.length)

      const [
        { data: sellers },
        { data: kpiEntries },
        { data: missions },
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id')
          .in('organization_id', orgIds)
          .eq('role', 'seller')
          .eq('active', true),
        supabase
          .from('kpi_entries')
          .select('points_earned')
          .in('organization_id', orgIds),
        supabase
          .from('ai_missions')
          .select('status, xp_reward')
          .in('organization_id', orgIds)
          .eq('status', 'completed'),
      ])

      setTotalSellers(sellers?.length || 0)

      const points = (kpiEntries || []).reduce((sum: number, e: any) => sum + (e.points_earned || 0), 0)
      setTotalPoints(points)

      setTotalMissionsCompleted(missions?.length || 0)

      // Estimated revenue: points * R$10 (simplified multiplier)
      setEstimatedRevenue(points * 10)

      setLoading(false)
    }

    fetchData().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <TrendingUp className="h-5 w-5 text-primary" />
          Impacto Consolidado
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          ROI total da sua carteira — use como argumento comercial
        </p>
      </div>

      {/* Hero number */}
      <Card className="border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/5">
        <CardContent className="flex items-center gap-4 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
            <DollarSign className="h-7 w-7 text-green-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Receita adicional estimada (total)</p>
            <p className="text-3xl font-bold text-green-500">{formatCurrency(estimatedRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Baseado em {totalPoints.toLocaleString('pt-BR')} pontos gerados pela carteira
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalClients}</p>
                <p className="text-xs text-muted-foreground">Clientes ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSellers}</p>
                <p className="text-xs text-muted-foreground">Vendedores impactados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Target className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMissionsCompleted}</p>
                <p className="text-xs text-muted-foreground">Missões concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Award className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPoints.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">Pontos gerados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales argument card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Argumento Comercial</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            &quot;Geramos <strong className="text-foreground">{formatCurrency(estimatedRevenue)}</strong> de receita
            adicional para {totalClients} clientes ativos, impactando {totalSellers} vendedores com{' '}
            {totalMissionsCompleted} missões concluídas. Posso te mostrar o diagnóstico da sua empresa para
            calcular o seu potencial.&quot;
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
