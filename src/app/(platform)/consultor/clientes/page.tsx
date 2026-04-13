'use client'

import { useEffect, useState, useRef } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'

interface ClientData {
  organization_id: string
  org_name: string
  seller_count: number
  avg_engagement: number
  alerts: number
  health_status: 'saudavel' | 'atencao' | 'risco'
  last_diagnostic_health: number | null
}

export default function ConsultorClientesPage() {
  const { user } = useRequiredAuth()
  const supabaseRef = useRef(createClient())
  const [clients, setClients] = useState<ClientData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchClients = async () => {
      try {
        const supabase = supabaseRef.current

        const { data: portfolio, error: portfolioErr } = await supabase
          .from('consultant_portfolio')
          .select('organization_id')
          .eq('consultant_user_id', user.id)

        if (portfolioErr) console.error('[Consultor/Clientes] Portfolio error:', portfolioErr)

        if (!portfolio || portfolio.length === 0) {
          setLoading(false)
          return
        }

        const orgIds = portfolio.map((p: { organization_id: string }) => p.organization_id)

        const results = await Promise.allSettled([
          supabase.from('organizations').select('id, name').in('id', orgIds),
          supabase.from('users').select('id, organization_id').in('organization_id', orgIds)
            .eq('role', 'seller').eq('active', true),
          supabase.from('diagnostic_sessions').select('organization_id, health_pct, quadrant')
            .in('organization_id', orgIds).eq('status', 'completed')
            .order('created_at', { ascending: false }),
        ])

        const orgs = results[0].status === 'fulfilled' ? results[0].value.data : []
        const sellers = results[1].status === 'fulfilled' ? results[1].value.data : []
        const diagnostics = results[2].status === 'fulfilled' ? results[2].value.data : []

        const clientsData: ClientData[] = (orgs || []).map((org: any) => {
          const orgSellers = (sellers || []).filter((s: any) => s.organization_id === org.id)
          const latestDiag = (diagnostics || []).find((d: any) => d.organization_id === org.id)
          const health = latestDiag?.health_pct ?? null
          let status: 'saudavel' | 'atencao' | 'risco' = 'saudavel'
          if (health !== null) {
            if (health < 40) status = 'risco'
            else if (health < 65) status = 'atencao'
          }

          return {
            organization_id: org.id,
            org_name: org.name,
            seller_count: orgSellers.length,
            avg_engagement: health ? Math.round(health) : 0,
            alerts: status === 'risco' ? 1 : 0,
            health_status: status,
            last_diagnostic_health: health,
          }
        })

        setClients(clientsData)
      } catch (err) {
        console.error('[Consultor/Clientes] Erro:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchClients()
  }, [user])


  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const statusConfig = {
    saudavel: { label: 'Saudável', color: 'bg-emerald-500', textColor: 'text-emerald-500' },
    atencao: { label: 'Atenção', color: 'bg-amber-500', textColor: 'text-amber-500' },
    risco: { label: 'Risco de Churn', color: 'bg-red-500', textColor: 'text-red-500' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Building2 className="h-5 w-5 text-primary" />
          Meus Clientes
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão geral da sua carteira em 30 segundos
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-xs text-muted-foreground">Clientes ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {clients.reduce((sum, c) => sum + c.seller_count, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Vendedores totais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {clients.filter((c) => c.health_status === 'risco').length}
                </p>
                <p className="text-xs text-muted-foreground">Em risco de churn</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Cards */}
      {clients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Nenhum cliente na sua carteira ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const config = statusConfig[client.health_status]
            return (
              <Card key={client.organization_id} className="hover:border-primary/30 transition-colors">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold truncate">{client.org_name}</h3>
                    <Badge variant="outline" className={`text-[10px] ${config.textColor}`}>
                      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${config.color} inline-block`} />
                      {config.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Vendedores</p>
                      <p className="font-medium">{client.seller_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Saúde</p>
                      <p className="font-medium">
                        {client.last_diagnostic_health !== null
                          ? `${client.last_diagnostic_health}%`
                          : 'N/A'}
                      </p>
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
