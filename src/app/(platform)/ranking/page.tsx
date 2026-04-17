'use client'

import { useEffect, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, Zap } from 'lucide-react'

type Period = 'daily' | 'weekly' | 'monthly'

interface RankingUser {
  user_id: string
  name: string
  avatar_url: string | null
  period_xp: number
  total_xp: number
  current_level: number
}

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Hoje',
  weekly: 'Esta Semana',
  monthly: 'Este Mês',
}

export default function RankingPage() {
  const { user } = useRequiredAuth()
  const [period, setPeriod] = useState<Period>('weekly')
  const [rankings, setRankings] = useState<RankingUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetch(`/api/team/ranking?period=${period}`, { credentials: 'same-origin' })
      .then((res) => res.ok ? res.json() : { rankings: [] })
      .then(({ rankings: data }) => setRankings(data ?? []))
      .catch(() => setRankings([]))
      .finally(() => setLoading(false))
  }, [user, period])

  const podiumIcons = [
    <Trophy key="1" className="h-5 w-5 text-yellow-500" />,
    <Medal key="2" className="h-5 w-5 text-gray-400" />,
    <Award key="3" className="h-5 w-5 text-amber-600" />,
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ranking</h2>
        <p className="text-muted-foreground">Classificação da equipe por XP no período</p>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="daily">Diário</TabsTrigger>
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
          <TabsTrigger value="monthly">Mensal</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : rankings.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum XP registrado {PERIOD_LABELS[period].toLowerCase()}.</p>
            </div>
          ) : (
            <div className="divide-y">
              {rankings.map((r, i) => {
                const isCurrentUser = r.user_id === user.id
                const initials = r.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

                return (
                  <div
                    key={r.user_id}
                    className={`flex items-center gap-4 px-4 py-3 ${isCurrentUser ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center shrink-0">
                      {i < 3 ? podiumIcons[i] : (
                        <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
                      )}
                    </div>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.name}
                        {isCurrentUser && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">Nível {r.current_level} · {r.total_xp.toLocaleString('pt-BR')} XP total</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <Badge variant="secondary" className="font-mono">
                        {r.period_xp.toLocaleString('pt-BR')} XP
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Mostrando XP conquistado {PERIOD_LABELS[period].toLowerCase()}. Nível e XP total exibidos abaixo do nome.
      </p>
    </div>
  )
}
