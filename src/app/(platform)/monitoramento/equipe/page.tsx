'use client'

import { useEffect, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Zap,
  Target,
  Bell,
  Crown,
  Flame,
} from 'lucide-react'

interface TeamMember {
  user_id: string
  name: string
  total_xp: number
  current_level: number
  current_streak: number
  missions_completed: number
  individual_goal: string | null
  trend: 'up' | 'down' | 'stable'
}

interface TeamGoal {
  kpiComportamental?: string
  valorAtual?: number
  valorMeta?: number
  prazo?: string
}

export default function MonitoramentoEquipePage() {
  const { user } = useRequiredAuth()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [teamGoal, setTeamGoal] = useState<TeamGoal | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        const res = await fetch('/api/team/performance', { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setMembers(data.members ?? [])
          setTeamGoal(data.team_goal ?? null)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])


  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const maxXp = members.length > 0 ? members[0].total_xp : 1
  const avgXp = members.length > 0
    ? Math.round(members.reduce((sum, m) => sum + m.total_xp, 0) / members.length)
    : 0
  const totalMissions = members.reduce((sum, m) => sum + m.missions_completed, 0)
  const topPerformer = members.length > 0 ? members[0].name : '—'

  const trendConfig = {
    up: { label: 'Tendência: ↑ crescimento', color: 'text-emerald-500 bg-emerald-500/10' },
    down: { label: 'Tendência: ↓ queda', color: 'text-red-500 bg-red-500/10' },
    stable: { label: 'Tendência: → estável', color: 'text-blue-500 bg-blue-500/10' },
  }

  return (
    <div className="space-y-6">
      <PageHeader
        label="Monitoramento"
        title={<>Performance da <TitleHighlight>Equipe</TitleHighlight></>}
        description="Ranking e desempenho individual dos vendedores em tempo real"
      />

      {/* Meta da Equipe */}
      {teamGoal && (teamGoal.kpiComportamental || teamGoal.valorMeta) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-primary">Meta da Equipe</p>
                <p className="text-sm font-medium mt-0.5">
                  {teamGoal.kpiComportamental ?? 'KPI comportamental'}
                  {teamGoal.valorMeta ? ` — alvo: ${teamGoal.valorMeta}` : ''}
                  {teamGoal.prazo ? ` · prazo ${new Date(teamGoal.prazo).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-bold truncate">{topPerformer}</p>
                <p className="text-[10px] text-muted-foreground">Melhor Performer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgXp.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-muted-foreground">Média de Pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMissions}</p>
                <p className="text-[10px] text-muted-foreground">Total Missões Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking por Pontos e Missões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum vendedor registrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member, index) => {
                const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                const xpPct = maxXp > 0 ? (member.total_xp / maxXp) * 100 : 0
                const tc = trendConfig[member.trend]

                return (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-accent/30 transition-colors"
                  >
                    {/* Rank */}
                    <div className="w-7 text-center shrink-0">
                      {index === 0 ? (
                        <span className="text-lg">🥇</span>
                      ) : index === 1 ? (
                        <span className="text-lg">🥈</span>
                      ) : index === 2 ? (
                        <span className="text-lg">🥉</span>
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">{index + 1}º</span>
                      )}
                    </div>

                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-500">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          Nv. {member.current_level}
                        </Badge>
                      </div>

                      {/* XP Bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Progress
                            value={xpPct}
                            className="h-2 [&>div]:bg-emerald-500"
                          />
                        </div>
                        <span className="text-xs font-medium text-emerald-500 shrink-0 w-16 text-right">
                          {member.total_xp.toLocaleString('pt-BR')} pts
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                          <Target className="h-2.5 w-2.5" />
                          {member.missions_completed} missões concluídas
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5 text-orange-500" />
                          {member.current_streak}d streak
                        </span>
                        {member.individual_goal && (
                          <span className="text-[10px] text-primary font-medium">
                            Meta: {member.individual_goal}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Trend Badge */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tc.color}`}>
                        {member.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                        {member.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                        {member.trend === 'stable' && <Minus className="h-3 w-3" />}
                        {tc.label}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2">
                        <Bell className="h-3 w-3 mr-1" />
                        Enviar Nudge
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
