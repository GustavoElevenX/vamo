'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

interface CompletedMission {
  id: string
  title: string
  xp_reward: number
  completed_at: string
}

export default function ComissaoPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [completedMissions, setCompletedMissions] = useState<CompletedMission[]>([])

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data } = await supabase
        .from('ai_missions')
        .select('id, title, xp_reward, completed_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10)

      setCompletedMissions((data ?? []) as CompletedMission[])
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

  // Commission calculation
  const salesRevenue = 34000
  const commissionRate = 0.04
  const baseCommission = Math.round(salesRevenue * commissionRate)
  const missionBonus = completedMissions.reduce((sum, m) => sum + Math.round(m.xp_reward * 1.5), 0)
  const kpiBonus = 350
  const total = baseCommission + missionBonus + kpiBonus

  // Status totals
  const confirmedTotal = baseCommission
  const pendingTotal = missionBonus > 0 ? missionBonus : 1030
  const openTotal = kpiBonus

  // Payment date
  const paymentDate = new Date(2026, 3, 5) // April 5, 2026
  const now = new Date()
  const daysUntilPayment = Math.max(0, Math.ceil((paymentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  const history = [
    { month: 'Fevereiro 2026', total: 3200, base: 1360, missions: 1490, kpi: 350 },
    { month: 'Janeiro 2026', total: 2950, base: 1200, missions: 1400, kpi: 350 },
    { month: 'Dezembro 2025', total: 3400, base: 1500, missions: 1600, kpi: 300 },
  ]

  const missionLineItems = completedMissions.length > 0
    ? completedMissions.slice(0, 5).map((m) => ({
        title: m.title,
        bonus: Math.round(m.xp_reward * 1.5),
        status: 'Confirmado' as const,
      }))
    : [
        { title: 'Missao de Upsell - Cliente Alpha', bonus: 600, status: 'Confirmado' as const },
        { title: 'CRM Streak 7 dias', bonus: 150, status: 'Processando' as const },
        { title: 'Fechamento meta semanal', bonus: 280, status: 'Pendente' as const },
      ]

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Confirmado':
        return (
          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-0">
            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
            Confirmado
          </Badge>
        )
      case 'Processando':
        return (
          <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-0">
            <Clock className="h-2.5 w-2.5 mr-0.5" />
            Processando
          </Badge>
        )
      default:
        return (
          <Badge className="text-[9px] h-4 px-1.5 bg-muted text-muted-foreground border-0">
            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
            Pendente
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Minha Comissao</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Detalhamento de ganhos do periodo</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">Marco 2026</Badge>
      </div>

      {/* Total Summary + Payment Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Previsto</p>
                <p className="text-2xl font-bold text-emerald-500">
                  R$ {total.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            {/* Status breakdown */}
            <div className="flex items-center gap-3 mt-3 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Confirmado: R$ {confirmedTotal.toLocaleString('pt-BR')}
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="h-2.5 w-2.5" />
                Pendente: R$ {pendingTotal.toLocaleString('pt-BR')}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle className="h-2.5 w-2.5" />
                Em aberto: R$ {openTotal.toLocaleString('pt-BR')}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Proximo Pagamento</p>
                <p className="text-xl font-bold text-blue-500">05/04/2026</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Faltam <strong>{daysUntilPayment} dias</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown with explicit formulas */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Composicao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="py-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Comissao Base</span>
              <span className="text-sm font-medium">R$ {baseCommission.toLocaleString('pt-BR')}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              R$ {salesRevenue.toLocaleString('pt-BR')} em vendas x {(commissionRate * 100)}% = R$ {baseCommission.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="py-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Bonus por Missoes ({completedMissions.length > 0 ? completedMissions.length : 3} concluidas)
              </span>
              <span className="text-sm font-medium text-emerald-500">
                +R$ {(missionBonus > 0 ? missionBonus : 1030).toLocaleString('pt-BR')}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Soma dos bonus individuais de cada missao concluida
            </p>
          </div>
          <div className="py-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Bonus por KPI</span>
              <span className="text-sm font-medium text-blue-500">+R$ {kpiBonus.toLocaleString('pt-BR')}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Taxa Fechamento 63% da meta + CRM Atualizado 72% da meta
            </p>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-bold">Total</span>
            <span className="text-sm font-bold">R$ {total.toLocaleString('pt-BR')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Detalhamento de Missoes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {missionLineItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.title}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {statusBadge(item.status)}
                <span className="text-xs font-medium text-emerald-500">+R$ {item.bonus}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Historico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.map((h) => (
            <div key={h.month} className="py-2 border-b border-border/30 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{h.month}</span>
                <span className="text-sm font-medium">R$ {h.total.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground/70">
                <span>Base: R$ {h.base.toLocaleString('pt-BR')}</span>
                <span>Missoes: R$ {h.missions.toLocaleString('pt-BR')}</span>
                <span>KPI: R$ {h.kpi.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
