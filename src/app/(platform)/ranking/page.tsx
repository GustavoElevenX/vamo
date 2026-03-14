'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award } from 'lucide-react'
import type { PeriodType } from '@/types'

interface RankingUser {
  user_id: string
  name: string
  avatar_url: string | null
  total_xp: number
  current_level: number
}

export default function RankingPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<PeriodType>('weekly')
  const [rankings, setRankings] = useState<RankingUser[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('user_xp')
        .select('user_id, total_xp, current_level, users!inner(name, avatar_url)')
        .eq('organization_id', user.organization_id)
        .order('total_xp', { ascending: false })
        .limit(50)

      const mapped = (data ?? []).map((row: any) => ({
        user_id: row.user_id,
        name: row.users?.name ?? 'Usuário',
        avatar_url: row.users?.avatar_url ?? null,
        total_xp: row.total_xp,
        current_level: row.current_level,
      }))

      setRankings(mapped)
      setLoading(false)
    }
    fetch()
  }, [user, period])

  if (!user) return null

  const podiumIcons = [
    <Trophy key="1" className="h-5 w-5 text-yellow-500" />,
    <Medal key="2" className="h-5 w-5 text-gray-400" />,
    <Award key="3" className="h-5 w-5 text-amber-600" />,
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ranking</h2>
        <p className="text-muted-foreground">Classificação da equipe por XP</p>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
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
              Nenhum dado de ranking ainda.
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
                    <div className="flex h-8 w-8 items-center justify-center">
                      {i < 3 ? podiumIcons[i] : (
                        <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
                      )}
                    </div>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {r.name}
                        {isCurrentUser && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">Nível {r.current_level}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {r.total_xp.toLocaleString()} XP
                    </Badge>
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
