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
  Loader2,
  TrendingUp,
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

    fetchData()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const baseSalary = 2500
  const missionBonus = completedMissions.reduce((sum, m) => sum + Math.round(m.xp_reward * 1.5), 0)
  const kpiBonus = 350
  const total = baseSalary + missionBonus + kpiBonus

  const history = [
    { month: 'Fevereiro 2026', total: 3200 },
    { month: 'Janeiro 2026', total: 2950 },
    { month: 'Dezembro 2025', total: 3400 },
  ]

  const missionLineItems = completedMissions.length > 0
    ? completedMissions.slice(0, 5).map((m) => ({
        title: m.title,
        bonus: Math.round(m.xp_reward * 1.5),
        status: 'Pendente' as const,
      }))
    : [
        { title: 'Missao de Upsell - Cliente Alpha', bonus: 600, status: 'Pago' as const },
        { title: 'CRM Streak 7 dias', bonus: 150, status: 'Processando' as const },
        { title: 'Fechamento meta semanal', bonus: 280, status: 'Pendente' as const },
      ]

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Pago':
        return <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-0">Pago</Badge>
      case 'Processando':
        return <Badge className="text-[9px] h-4 px-1.5 bg-blue-500/10 text-blue-600 border-0">Processando</Badge>
      default:
        return <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-0">Pendente</Badge>
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

      {/* Total Summary */}
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
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Composicao</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Salario Base</span>
            <span className="text-sm font-medium">R$ {baseSalary.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">
              Bonus por Missoes ({completedMissions.length > 0 ? completedMissions.length : 3} concluidas)
            </span>
            <span className="text-sm font-medium text-emerald-500">
              +R$ {(missionBonus > 0 ? missionBonus : 1030).toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Bonus por KPI</span>
            <span className="text-sm font-medium text-blue-500">+R$ {kpiBonus.toLocaleString('pt-BR')}</span>
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

      {/* Payment Date */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Proximo pagamento</p>
              <p className="text-xs text-muted-foreground">05/04/2026</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Historico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.map((h) => (
            <div key={h.month} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <span className="text-xs text-muted-foreground">{h.month}</span>
              <span className="text-sm font-medium">R$ {h.total.toLocaleString('pt-BR')}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
