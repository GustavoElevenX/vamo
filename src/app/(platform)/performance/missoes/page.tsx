'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Zap,
  Clock,
  Brain,
  Target,
  TrendingUp,
  Play,
  Users,
  DollarSign,
  CheckSquare,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'

interface Mission {
  id: string
  title: string
  status: string
  xp_reward: number
  difficulty: number
  created_at: string
  is_collective?: boolean
  description?: string
}

function getExpiration(createdAt: string) {
  const created = new Date(createdAt)
  const expires = new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 days
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)))
  const diffDays = Math.floor(diffHours / 24)
  const remainingHours = diffHours % 24

  if (diffMs <= 0) return { text: 'Expirada', color: 'text-red-600', bgColor: 'border-red-500/20 bg-red-500/5', urgent: true }
  if (diffDays === 0) return { text: `Expira em ${diffHours}h`, color: 'text-red-600', bgColor: 'border-red-500/20 bg-red-500/5', urgent: true }
  if (diffDays <= 2) return { text: `Expira em ${diffDays}d ${remainingHours}h`, color: 'text-amber-600', bgColor: 'border-amber-500/20 bg-amber-500/5', urgent: false }
  return { text: `Expira em ${diffDays} dias`, color: 'text-muted-foreground', bgColor: 'border-border/40 bg-muted/30', urgent: false }
}

export default function MissoesPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [missions, setMissions] = useState<Mission[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchMissions = async () => {
      const { data } = await supabase
        .from('ai_missions')
        .select('id, title, status, xp_reward, difficulty, created_at, is_collective, description')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })

      setMissions((data ?? []) as Mission[])
      setLoading(false)
    }

    fetchMissions()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const handleAcceptMission = async (missionId: string) => {
    setAccepting(missionId)
    await supabase
      .from('ai_missions')
      .update({ status: 'in_progress' })
      .eq('id', missionId)

    setMissions(prev => prev.map(m => m.id === missionId ? { ...m, status: 'in_progress' } : m))
    setAccepting(null)
  }

  const difficultyLabel = (d: number) => {
    if (d === 1) return { text: 'Facil', color: 'bg-emerald-500/10 text-emerald-600' }
    if (d === 2) return { text: 'Medio', color: 'bg-amber-500/10 text-amber-600' }
    return { text: 'Dificil', color: 'bg-red-500/10 text-red-600' }
  }

  const individualMissions = missions.filter(m => !m.is_collective)
  const pendingMissions = individualMissions.filter(m => m.status === 'pending')
  const activeMissions = individualMissions.filter(m => m.status === 'in_progress')

  // Mock collective mission data
  const collectiveMission = {
    title: 'Meta Coletiva: 50 Reunioes no Mes',
    teamProgress: 72,
    teamGoal: 50,
    teamCurrent: 36,
    myContribution: 8,
    myPercentage: 22,
    deadline: '30/03/2026',
    xpReward: 500,
    bonus: 750,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Missoes Ativas</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {missions.length > 0
            ? `${missions.length} missao${missions.length > 1 ? 'es' : ''} em andamento`
            : 'Nenhuma missao ativa no momento'}
        </p>
      </div>

      {/* In Progress Missions */}
      {activeMissions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-3.5 w-3.5" />
            Em Progresso ({activeMissions.length})
          </h3>
          {activeMissions.map((mission) => {
            const diff = difficultyLabel(mission.difficulty)
            const bonus = Math.round(mission.xp_reward * 1.5)
            const expiration = getExpiration(mission.created_at)
            const mockProgress = 60

            return (
              <Card key={mission.id} className="border-border/50">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{mission.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-[9px] h-4 px-1.5 border-0 ${diff.color}`}>
                          {diff.text}
                        </Badge>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                          +{mission.xp_reward} XP
                        </Badge>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-emerald-500 border-emerald-500/30">
                          R$ {bonus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Progresso</span>
                      <span className="text-[10px] font-medium text-emerald-500">{mockProgress}%</span>
                    </div>
                    <Progress value={mockProgress} className="h-1.5 [&>div]:bg-emerald-500" />
                  </div>

                  {/* Expiration + Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 ${expiration.bgColor}`}>
                      {expiration.urgent ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <p className={`text-[11px] font-medium ${expiration.color}`}>
                        {expiration.text}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 shrink-0" render={<Link href="/performance/indicadores" />}>
                      <CheckSquare className="h-3 w-3" />
                      Registrar Acao
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pending Missions - Need Acceptance */}
      {pendingMissions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Aguardando Aceite ({pendingMissions.length})
          </h3>
          {pendingMissions.map((mission) => {
            const diff = difficultyLabel(mission.difficulty)
            const bonus = Math.round(mission.xp_reward * 1.5)
            const expiration = getExpiration(mission.created_at)
            const isAccepting = accepting === mission.id

            return (
              <Card key={mission.id} className="border-border/50 border-l-4 border-l-blue-500/40">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{mission.title}</p>
                      {mission.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mission.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge className={`text-[9px] h-4 px-1.5 border-0 ${diff.color}`}>
                          {diff.text}
                        </Badge>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                          +{mission.xp_reward} XP
                        </Badge>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-emerald-500 border-emerald-500/30">
                          R$ {bonus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Expiration + Accept */}
                  <div className="flex items-center justify-between gap-2">
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${expiration.bgColor}`}>
                      <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <p className={`text-[11px] font-medium ${expiration.color}`}>{expiration.text}</p>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      disabled={isAccepting}
                      onClick={() => handleAcceptMission(mission.id)}
                    >
                      {isAccepting ? (
                        <span className="flex items-center gap-1.5">
                          <div className="h-3 w-3 rounded-full border border-white border-t-transparent animate-spin" />
                          Aceitando...
                        </span>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          Aceitar Missao
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {missions.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Zap className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma missao ativa.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Missoes sao geradas pela IA com base no seu perfil e indicadores.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collective Mission */}
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{collectiveMission.title}</p>
                <Badge className="text-[9px] h-4 px-1.5 bg-violet-500/10 text-violet-600 border-0">
                  Coletiva
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Prazo: {collectiveMission.deadline}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold text-violet-600">+{collectiveMission.xpReward} XP</p>
              <p className="text-[10px] text-emerald-500 font-medium">R$ {collectiveMission.bonus}</p>
            </div>
          </div>

          {/* Team Progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">
                Progresso do Time: {collectiveMission.teamCurrent}/{collectiveMission.teamGoal} reunioes
              </span>
              <span className="text-[10px] font-medium text-violet-600">{collectiveMission.teamProgress}%</span>
            </div>
            <Progress value={collectiveMission.teamProgress} className="h-1.5 [&>div]:bg-violet-500" />
          </div>

          {/* My Contribution */}
          <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
            <Target className="h-3.5 w-3.5 text-violet-500 shrink-0" />
            <p className="text-[11px] text-violet-600 font-medium">
              Sua contribuicao: {collectiveMission.myContribution} reunioes ({collectiveMission.myPercentage}% do time)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestion */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Sugestao da IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Voce pode melhorar em ticket medio. Aceitar a Missao de Upsell Consultivo pode te render{' '}
                <strong className="text-emerald-500">+R$ 600</strong> este mes. Seu perfil tem 3x mais chances de sucesso nesse tipo de missao.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" className="h-7 text-xs gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Aceitar Missao Sugerida
                </Button>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  Impacto: +R$ 600/mes
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
