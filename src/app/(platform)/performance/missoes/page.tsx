'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Zap,
  Clock,
  Brain,
  Target,
  TrendingUp,
} from 'lucide-react'

interface Mission {
  id: string
  title: string
  status: string
  xp_reward: number
  difficulty: number
  created_at: string
}

export default function MissoesPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [missions, setMissions] = useState<Mission[]>([])

  useEffect(() => {
    if (!user) return

    const fetchMissions = async () => {
      const { data } = await supabase
        .from('ai_missions')
        .select('id, title, status, xp_reward, difficulty, created_at')
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
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const difficultyLabel = (d: number) => {
    if (d === 1) return { text: 'Facil', color: 'bg-emerald-500/10 text-emerald-600' }
    if (d === 2) return { text: 'Medio', color: 'bg-amber-500/10 text-amber-600' }
    return { text: 'Dificil', color: 'bg-red-500/10 text-red-600' }
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

      {/* Missions */}
      {missions.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          {missions.map((mission) => {
            const diff = difficultyLabel(mission.difficulty)
            const bonus = Math.round(mission.xp_reward * 1.5)
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
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                          {mission.status === 'in_progress' ? 'Em progresso' : 'Pendente'}
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

                  {/* Expiration Alert */}
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-600 font-medium">
                      Expira em 3 dias
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* AI Suggestion */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Sugestao da IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A IA sugere aceitar a missao de Upsell — impacto estimado: +R$ 600.
                Seu perfil tem 3x mais chances de sucesso nesse tipo de missao.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
