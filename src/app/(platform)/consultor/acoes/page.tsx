'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList,
  AlertTriangle,
  Target,
  Users,
} from 'lucide-react'

interface PendingAction {
  id: string
  org_name: string
  type: 'burnout_risk' | 'mission_expiring' | 'low_engagement' | 'no_diagnostic'
  description: string
  urgency: 'alta' | 'media' | 'baixa'
  user_name?: string
}

export default function ConsultorAcoesPage() {
  const { user } = useAuth()
  const supabaseRef = useRef(createClient())
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchActions = async () => {
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
        { data: checkins },
        { data: diagnostics },
      ] = await Promise.all([
        supabase.from('organizations').select('id, name').in('id', orgIds),
        supabase
          .from('users')
          .select('id, name, organization_id')
          .in('organization_id', orgIds)
          .eq('role', 'seller')
          .eq('active', true),
        supabase
          .from('daily_checkins')
          .select('user_id, energy_level, organization_id')
          .in('organization_id', orgIds)
          .gte('checkin_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]),
        supabase
          .from('diagnostic_sessions')
          .select('organization_id, health_pct')
          .in('organization_id', orgIds)
          .eq('status', 'completed'),
      ])

      const orgMap: Record<string, string> = {}
      for (const org of orgs || []) orgMap[org.id] = org.name

      const pendingActions: PendingAction[] = []

      // Orgs without diagnostics
      for (const orgId of orgIds) {
        const hasDiag = (diagnostics || []).some((d: any) => d.organization_id === orgId)
        if (!hasDiag) {
          pendingActions.push({
            id: `no-diag-${orgId}`,
            org_name: orgMap[orgId] || 'Cliente',
            type: 'no_diagnostic',
            description: 'Cliente sem diagnóstico realizado. Agendar sessão.',
            urgency: 'alta',
          })
        }
      }

      // Low energy sellers
      const sellerCheckins: Record<string, number[]> = {}
      for (const c of checkins || []) {
        if (!sellerCheckins[c.user_id]) sellerCheckins[c.user_id] = []
        sellerCheckins[c.user_id].push(c.energy_level)
      }

      for (const seller of sellers || []) {
        const energies = sellerCheckins[seller.id] || []
        if (energies.length > 0) {
          const avg = energies.reduce((a, b) => a + b, 0) / energies.length
          if (avg <= 2) {
            pendingActions.push({
              id: `burnout-${seller.id}`,
              org_name: orgMap[seller.organization_id] || 'Cliente',
              type: 'burnout_risk',
              description: `${seller.name} com energia média ${avg.toFixed(1)}/5 na semana. Risco de burnout.`,
              urgency: 'alta',
              user_name: seller.name,
            })
          }
        }
      }

      // Low health diagnostics
      for (const diag of diagnostics || []) {
        if (diag.health_pct < 40) {
          pendingActions.push({
            id: `low-health-${diag.organization_id}`,
            org_name: orgMap[diag.organization_id] || 'Cliente',
            type: 'low_engagement',
            description: `Saúde da empresa em ${diag.health_pct}%. Ação urgente necessária.`,
            urgency: 'alta',
          })
        }
      }

      // Sort by urgency
      const urgencyOrder = { alta: 0, media: 1, baixa: 2 }
      pendingActions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

      setActions(pendingActions)
      setLoading(false)
    }

    fetchActions().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const urgencyConfig = {
    alta: { label: 'Alta', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    media: { label: 'Média', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    baixa: { label: 'Baixa', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  }

  const typeIcons = {
    burnout_risk: AlertTriangle,
    mission_expiring: Target,
    low_engagement: Users,
    no_diagnostic: ClipboardList,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ClipboardList className="h-5 w-5 text-primary" />
          Ações Pendentes
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          O que fazer hoje na carteira — ordenado por prioridade
        </p>
      </div>

      {actions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Nenhuma ação pendente. Sua carteira está em dia!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => {
            const config = urgencyConfig[action.urgency]
            const Icon = typeIcons[action.type]

            return (
              <Card key={action.id} className={config.border}>
                <CardContent className="flex items-start gap-3 py-4">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{action.org_name}</p>
                      <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {action.description}
                    </p>
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
