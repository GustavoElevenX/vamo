'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Zap,
  ChevronUp,
  Calendar,
} from 'lucide-react'

interface TeamCommission {
  user_id: string
  name: string
  base_salary: number
  mission_bonus: number
  kpi_bonus: number
  total: number
  status: 'paid' | 'pending' | 'processing'
  missions_completed: number
}

const ACCELERATOR_TIERS = [
  { meta: '100%', multiplier: '1.0x', color: 'text-muted-foreground', bg: 'bg-muted/50' },
  { meta: '110%', multiplier: '1.2x', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { meta: '120%', multiplier: '1.5x', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  { meta: '130%+', multiplier: '2.0x', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
]

const HISTORY = [
  { month: 'Fevereiro 2026', total: 28400, bonus: 6200, vendedores: 8 },
  { month: 'Janeiro 2026', total: 25800, bonus: 5100, vendedores: 7 },
  { month: 'Dezembro 2025', total: 31200, bonus: 8900, vendedores: 8 },
]

export default function MonitoramentoComissionamentoPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<TeamCommission[]>([])
  const [period] = useState('Março 2026')

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data: members } = await supabase
        .from('users')
        .select('id, name')
        .eq('organization_id', user.organization_id)
        .eq('role', 'seller')
        .eq('active', true)

      if (members) {
        const commissions: TeamCommission[] = await Promise.all(
          members.map(async (member) => {
            const { count: missionsCompleted } = await supabase
              .from('ai_missions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', member.id)
              .eq('status', 'completed')

            const missionBonus = (missionsCompleted ?? 0) * 75
            const kpiBonus = Math.floor(Math.random() * 800)
            return {
              user_id: member.id,
              name: member.name,
              base_salary: 2500,
              mission_bonus: missionBonus,
              kpi_bonus: kpiBonus,
              total: 2500 + missionBonus + kpiBonus,
              status: 'pending' as const,
              missions_completed: missionsCompleted ?? 0,
            }
          })
        )

        setTeam(commissions.sort((a, b) => b.total - a.total))
      }
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

  const totalPayroll = team.reduce((sum, t) => sum + t.total, 0)
  const totalBonus = team.reduce((sum, t) => sum + t.mission_bonus + t.kpi_bonus, 0)

  const statusConfig = {
    paid: { label: 'Pago', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
    pending: { label: 'Pendente', icon: Clock, color: 'text-amber-500 bg-amber-500/10' },
    processing: { label: 'Processando', icon: AlertCircle, color: 'text-blue-500 bg-blue-500/10' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Comissionamento</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Base + bônus por missão · {period}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5 mr-1" />
          Exportar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Folha Total</p>
                <p className="text-2xl font-bold mt-1">
                  R$ {totalPayroll.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Bônus Gerados</p>
                <p className="text-2xl font-bold mt-1">
                  R$ {totalBonus.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vendedores</p>
                <p className="text-2xl font-bold mt-1">{team.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Detalhamento por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          {team.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum vendedor na equipe.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vendedor</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Base</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Bônus Missão</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Bônus KPI</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Missões</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((member) => {
                    const st = statusConfig[member.status]
                    const StatusIcon = st.icon
                    return (
                      <tr key={member.user_id} className="border-b border-border/30 last:border-0 hover:bg-accent/30 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-medium">{member.name}</p>
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground">
                          R$ {member.base_salary.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-emerald-500 font-medium">
                            +R$ {member.mission_bonus.toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="text-blue-500 font-medium">
                            +R$ {member.kpi_bonus.toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          R$ {member.total.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="secondary" className="text-[10px]">
                            {member.missions_completed}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${st.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {st.label}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accelerator */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Acelerador de Comissão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Multiplicador aplicado sobre o bônus conforme atingimento da meta mensal.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {ACCELERATOR_TIERS.map((tier) => (
              <div
                key={tier.meta}
                className={`flex flex-col items-center p-4 rounded-lg border border-border/30 ${tier.bg}`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <ChevronUp className={`h-4 w-4 ${tier.color}`} />
                  <span className={`text-sm font-bold ${tier.color}`}>{tier.multiplier}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Meta {tier.meta}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {HISTORY.map((entry) => (
              <div
                key={entry.month}
                className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:bg-accent/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{entry.month}</p>
                  <p className="text-[10px] text-muted-foreground">{entry.vendedores} vendedores</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">R$ {entry.total.toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-emerald-500">
                    +R$ {entry.bonus.toLocaleString('pt-BR')} em bônus
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
