'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  DollarSign,
  TrendingUp,
  Target,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react'

interface MissionEarning {
  id: string
  title: string
  xp_reward: number
  bonus_value: number
  status: 'completed' | 'in_progress' | 'pending'
  completed_at: string | null
}

export default function MeusGanhosPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [missions, setMissions] = useState<MissionEarning[]>([])
  const [monthlyTarget, setMonthlyTarget] = useState(5000)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data } = await supabase
        .from('ai_missions')
        .select('id, title, xp_reward, status, completed_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        setMissions(
          data.map((m: any) => ({
            ...m,
            bonus_value: m.xp_reward * 1.5, // R$1.50 per XP as bonus
          }))
        )
      }
      setLoading(false)
    }

    fetchData()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const completedMissions = missions.filter((m) => m.status === 'completed')
  const totalBonus = completedMissions.reduce((sum, m) => sum + m.bonus_value, 0)
  const baseSalary = 2500
  const totalEarnings = baseSalary + totalBonus
  const targetProgress = Math.min(100, Math.round((totalEarnings / monthlyTarget) * 100))

  // Projection based on current pace
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysPassed = today.getDate()
  const projectedTotal = daysPassed > 0
    ? Math.round((totalEarnings / daysPassed) * daysInMonth)
    : totalEarnings

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Meus Ganhos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Comissão transparente com projeção preditiva
        </p>
      </div>

      {/* Earnings Hero */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="pt-5">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ganho Acumulado</p>
              <p className="text-3xl font-bold mt-1 text-emerald-500">
                R$ {totalEarnings.toLocaleString('pt-BR')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-[10px]">
                  Base: R$ {baseSalary.toLocaleString('pt-BR')}
                </Badge>
                <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-0">
                  Bônus: R$ {totalBonus.toLocaleString('pt-BR')}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Projeção do Mês</p>
              <p className="text-3xl font-bold mt-1">
                R$ {projectedTotal.toLocaleString('pt-BR')}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span className="text-xs text-muted-foreground">
                  Baseado no ritmo de {daysPassed} dias
                </span>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Meta do Mês</p>
              <p className="text-3xl font-bold mt-1">
                R$ {monthlyTarget.toLocaleString('pt-BR')}
              </p>
              <Progress value={targetProgress} className="h-2 mt-2 [&>div]:bg-emerald-500" />
              <p className="text-[10px] text-muted-foreground mt-1">{targetProgress}% alcançado</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{completedMissions.length}</p>
                <p className="text-[10px] text-muted-foreground">Missões Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-lg font-bold">
                  {missions.filter((m) => m.status === 'in_progress').length}
                </p>
                <p className="text-[10px] text-muted-foreground">Em Andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold">R$ {(totalBonus / Math.max(1, completedMissions.length)).toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Média por Missão</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mission Earnings List */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Detalhamento por Missão</CardTitle>
        </CardHeader>
        <CardContent>
          {missions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma missão registrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {missions.map((mission) => (
                <div
                  key={mission.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 hover:bg-accent/30 transition-colors"
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    mission.status === 'completed' ? 'bg-emerald-500/10' : 'bg-muted'
                  }`}>
                    {mission.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : mission.status === 'in_progress' ? (
                      <Zap className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mission.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {mission.completed_at
                        ? new Date(mission.completed_at).toLocaleDateString('pt-BR')
                        : mission.status === 'in_progress' ? 'Em andamento' : 'Pendente'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${mission.status === 'completed' ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {mission.status === 'completed'
                        ? `+R$ ${mission.bonus_value.toFixed(0)}`
                        : `R$ ${mission.bonus_value.toFixed(0)}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">+{mission.xp_reward} XP</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
