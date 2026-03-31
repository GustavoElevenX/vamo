'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  HeartPulse,
  Smile,
  Meh,
  Frown,
} from 'lucide-react'

interface ClientHealth {
  org_id: string
  org_name: string
  health_pct: number
  status: 'saudavel' | 'atencao' | 'risco'
  seller_count: number
}

export default function ConsultorSaudeCarteiraPage() {
  const { user } = useAuth()
  const supabaseRef = useRef(createClient())
  const [clients, setClients] = useState<ClientHealth[]>([])
  const [loading, setLoading] = useState(true)

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

      const [
        { data: orgs },
        { data: sellers },
        { data: diagnostics },
      ] = await Promise.all([
        supabase.from('organizations').select('id, name').in('id', orgIds),
        supabase
          .from('users')
          .select('id, organization_id')
          .in('organization_id', orgIds)
          .eq('role', 'seller')
          .eq('active', true),
        supabase
          .from('diagnostic_sessions')
          .select('organization_id, health_pct')
          .in('organization_id', orgIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false }),
      ])

      const result: ClientHealth[] = (orgs || []).map((org: any) => {
        const latestDiag = (diagnostics || []).find((d: any) => d.organization_id === org.id)
        const health = latestDiag?.health_pct ?? 50
        let status: 'saudavel' | 'atencao' | 'risco' = 'saudavel'
        if (health < 40) status = 'risco'
        else if (health < 65) status = 'atencao'

        return {
          org_id: org.id,
          org_name: org.name,
          health_pct: health,
          status,
          seller_count: (sellers || []).filter((s: any) => s.organization_id === org.id).length,
        }
      })

      result.sort((a, b) => a.health_pct - b.health_pct)
      setClients(result)
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

  const statusConfig = {
    saudavel: { label: 'Saudável', icon: Smile, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    atencao: { label: 'Atenção', icon: Meh, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    risco: { label: 'Risco de Churn', icon: Frown, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  }

  const saudavelCount = clients.filter((c) => c.status === 'saudavel').length
  const atencaoCount = clients.filter((c) => c.status === 'atencao').length
  const riscoCount = clients.filter((c) => c.status === 'risco').length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <HeartPulse className="h-5 w-5 text-primary" />
          Saúde da Carteira
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Mapa visual do estado de cada cliente
        </p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="flex items-center gap-3 pt-5">
            <Smile className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{saudavelCount}</p>
              <p className="text-xs text-muted-foreground">Saudáveis</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 pt-5">
            <Meh className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{atencaoCount}</p>
              <p className="text-xs text-muted-foreground">Atenção</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="flex items-center gap-3 pt-5">
            <Frown className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{riscoCount}</p>
              <p className="text-xs text-muted-foreground">Risco de Churn</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client list */}
      <div className="space-y-3">
        {clients.map((client) => {
          const config = statusConfig[client.status]
          const StatusIcon = config.icon

          return (
            <Card key={client.org_id} className={config.border}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config.bg)}>
                  <StatusIcon className={cn('h-5 w-5', config.color)} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{client.org_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {client.seller_count} vendedores
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('text-lg font-bold', config.color)}>{client.health_pct}%</p>
                  <p className={cn('text-xs', config.color)}>{config.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
