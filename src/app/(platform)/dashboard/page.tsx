'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Trophy,
  Target,
  Swords,
  TrendingUp,
  Flame,
  Medal,
  ArrowRight,
  Plus,
} from 'lucide-react'
import type { UserXp, XpLevel, Challenge } from '@/types'

interface RankEntry {
  user_id: string
  name: string
  total_xp: number
  current_level: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [currentLevel, setCurrentLevel] = useState<XpLevel | null>(null)
  const [nextLevel, setNextLevel] = useState<XpLevel | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([])
  const [todayKpiCount, setTodayKpiCount] = useState(0)
  const [topRanking, setTopRanking] = useState<RankEntry[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      const today = new Date().toISOString().split('T')[0]

      const [
        { data: xp },
        { count: badges },
        { data: challenges },
        { count: kpis },
        { data: rankData },
      ] = await Promise.all([
        supabase
          .from('user_xp')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_badges')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('challenges')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .lte('start_date', new Date().toISOString())
          .gte('end_date', new Date().toISOString())
          .limit(3),
        supabase
          .from('kpi_entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('recorded_at', `${today}T00:00:00`)
          .lte('recorded_at', `${today}T23:59:59`),
        supabase
          .from('user_xp')
          .select('user_id, total_xp, current_level, users!inner(name)')
          .eq('organization_id', user.organization_id)
          .order('total_xp', { ascending: false })
          .limit(5),
      ])

      setUserXp(xp)
      setBadgeCount(badges ?? 0)
      setActiveChallenges(challenges ?? [])
      setTodayKpiCount(kpis ?? 0)

      if (rankData) {
        const mapped = (rankData as any[]).map((r) => ({
          user_id: r.user_id,
          name: r.users?.name ?? 'Usuário',
          total_xp: r.total_xp,
          current_level: r.current_level,
        }))
        setTopRanking(mapped)
        const rank = mapped.findIndex((r) => r.user_id === user.id)
        setMyRank(rank >= 0 ? rank + 1 : null)
      }

      if (xp) {
        const { data: levels } = await supabase
          .from('xp_levels')
          .select('*')
          .eq('organization_id', user.organization_id)
          .order('level', { ascending: true })

        if (levels) {
          setCurrentLevel(levels.find((l) => l.level === xp.current_level) ?? null)
          setNextLevel(levels.find((l) => l.level === xp.current_level + 1) ?? null)
        }
      }

      setLoading(false)
    }

    fetchAll()
  }, [user])

  if (!user) return null

  const xpToNext = nextLevel ? nextLevel.xp_required - (userXp?.total_xp ?? 0) : 0
  const xpProgress =
    currentLevel && nextLevel
      ? Math.round(
          (((userXp?.total_xp ?? 0) - currentLevel.xp_required) /
            (nextLevel.xp_required - currentLevel.xp_required)) *
            100
        )
      : 100

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Olá, {user.name.split(' ')[0]}!</h2>
        <p className="text-muted-foreground">Aqui está o resumo da sua performance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">XP Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{(userXp?.total_xp ?? 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Nível {userXp?.current_level ?? 1}{currentLevel ? ` — ${currentLevel.name}` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">KPIs Hoje</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{todayKpiCount}</p>
            <p className="text-xs text-muted-foreground">registros hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conquistas</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{badgeCount}</p>
            <p className="text-xs text-muted-foreground">badges conquistados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{userXp?.current_streak ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              dias (recorde: {userXp?.longest_streak ?? 0})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* XP Progress Bar */}
      {nextLevel && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Progresso — Nível {userXp?.current_level ?? 1}
                {currentLevel ? ` (${currentLevel.name})` : ''}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {xpToNext.toLocaleString()} XP para Nível {nextLevel.level} ({nextLevel.name})
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={xpProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active Challenges */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Desafios Ativos</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/desafios" />}>
              Ver todos <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {activeChallenges.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Swords className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum desafio ativo.</p>
                {(user.role === 'admin' || user.role === 'manager') && (
                  <Button variant="outline" size="sm" className="mt-3" render={<Link href="/configuracoes/gamificacao" />}>
                    <Plus className="mr-1 h-3 w-3" />
                    Criar Desafio
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {activeChallenges.map((c) => {
                  const daysLeft = Math.max(
                    0,
                    Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000)
                  )
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{daysLeft}d restantes</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">+{c.xp_reward} XP</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Ranking */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ranking da Equipe</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/ranking" />}>
              Ver todos <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {topRanking.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Trophy className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum dado ainda.</p>
                <Button variant="outline" size="sm" className="mt-3" render={<Link href="/kpis/registrar" />}>
                  <Plus className="mr-1 h-3 w-3" />
                  Registrar KPI
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {topRanking.map((r, i) => {
                  const isMe = r.user_id === user.id
                  const initials = r.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                  const medals = ['🥇', '🥈', '🥉']
                  return (
                    <div
                      key={r.user_id}
                      className={`flex items-center gap-3 rounded-lg p-2 ${isMe ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}
                    >
                      <span className="w-5 text-center text-sm font-bold text-muted-foreground">
                        {i < 3 ? medals[i] : i + 1}
                      </span>
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.name}
                          {isMe && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">Nível {r.current_level}</p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-primary">
                        {r.total_xp.toLocaleString()} XP
                      </span>
                    </div>
                  )
                })}
                {myRank !== null && myRank > 5 && (
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    Sua posição: #{myRank}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<Link href="/kpis/registrar" />}>
              <Target className="mr-1 h-3 w-3" />
              Registrar KPI
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/conquistas" />}>
              <Medal className="mr-1 h-3 w-3" />
              Conquistas
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/padronizacao" />}>
              Playbooks
            </Button>
            {(user.role === 'admin' || user.role === 'manager') && (
              <Button variant="outline" size="sm" render={<Link href="/diagnostico/novo" />}>
                <Plus className="mr-1 h-3 w-3" />
                Novo Diagnóstico
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
