'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  Flame,
  Medal,
  ArrowRight,
  Sparkles,
  Target,
  DollarSign,
  Star,
  Brain,
  BarChart3,
  CheckSquare,
} from 'lucide-react'
import { CoachWidget } from '@/components/ai/coach-widget'
import type { UserXp, XpLevel } from '@/types'

interface MissionSummary {
  id: string
  title: string
  status: string
  xp_reward: number
  difficulty: number
}

export default function PerformancePage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [currentLevel, setCurrentLevel] = useState<XpLevel | null>(null)
  const [nextLevel, setNextLevel] = useState<XpLevel | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [todayKpiCount, setTodayKpiCount] = useState(0)
  const [activeMissions, setActiveMissions] = useState<MissionSummary[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [totalSellers, setTotalSellers] = useState(0)

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      const today = new Date().toISOString().split('T')[0]

      const [
        { data: xp },
        { count: badges },
        { count: kpis },
        { data: missions },
        { data: allXp },
        { count: sellers },
      ] = await Promise.all([
        supabase.from('user_xp').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('kpi_entries').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
          .gte('recorded_at', `${today}T00:00:00`).lte('recorded_at', `${today}T23:59:59`),
        supabase.from('ai_missions').select('id, title, status, xp_reward, difficulty')
          .eq('user_id', user.id).in('status', ['pending', 'in_progress'])
          .order('created_at', { ascending: false }).limit(4),
        supabase.from('user_xp').select('user_id, total_xp').eq('organization_id', user.organization_id)
          .order('total_xp', { ascending: false }),
        supabase.from('users').select('*', { count: 'exact', head: true })
          .eq('organization_id', user.organization_id).eq('role', 'seller').eq('active', true),
      ])

      setUserXp(xp)
      setBadgeCount(badges ?? 0)
      setTodayKpiCount(kpis ?? 0)
      setActiveMissions((missions ?? []) as MissionSummary[])
      setTotalSellers(sellers ?? 0)

      if (allXp) {
        const rank = allXp.findIndex((r) => r.user_id === user.id)
        setMyRank(rank >= 0 ? rank + 1 : null)
      }

      if (xp) {
        const { data: levels } = await supabase
          .from('xp_levels').select('*').eq('organization_id', user.organization_id).order('level', { ascending: true })
        if (levels) {
          setCurrentLevel(levels.find((l) => l.level === xp.current_level) ?? null)
          setNextLevel(levels.find((l) => l.level === xp.current_level + 1) ?? null)
        }
      }

      setLoading(false)
    }

    fetchAll().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const xpToNext = nextLevel ? nextLevel.xp_required - (userXp?.total_xp ?? 0) : 0
  const xpProgress =
    currentLevel && nextLevel
      ? Math.round(
          (((userXp?.total_xp ?? 0) - currentLevel.xp_required) /
            (nextLevel.xp_required - currentLevel.xp_required)) * 100
        )
      : 100

  return (
    <div className="space-y-6">
      {/* Header with level title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Ola, {user.name.split(' ')[0]}!
            </h2>
            {currentLevel && (
              <Badge className="bg-primary/10 text-primary border-0 text-xs">
                {currentLevel.name}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Minha Performance — resumo completo
          </p>
        </div>
        {userXp && userXp.current_streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-1.5">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-bold text-orange-500">{userXp.current_streak}</span>
            <span className="text-[10px] text-muted-foreground">dias</span>
          </div>
        )}
      </div>

      {/* XP & Level Hero */}
      <Card className="border-border/50">
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
                  strokeDasharray={`${(xpProgress / 100) * 264} 264`}
                  strokeLinecap="round" className="text-emerald-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">{userXp?.current_level ?? 1}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">nivel</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg font-bold">{(userXp?.total_xp ?? 0).toLocaleString()} XP</p>
                {currentLevel && (
                  <Badge variant="secondary" className="text-[10px]">{currentLevel.name}</Badge>
                )}
                {myRank && (
                  <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                    #{myRank} Ranking
                  </Badge>
                )}
              </div>
              {nextLevel && (
                <>
                  <Progress value={xpProgress} className="h-2 mt-2 [&>div]:bg-emerald-500" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {xpToNext.toLocaleString()} XP para Nivel {nextLevel.level} ({nextLevel.name})
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{userXp?.current_streak ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Streak (dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Medal className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{badgeCount}</p>
                <p className="text-[10px] text-muted-foreground">Conquistas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{todayKpiCount}</p>
                <p className="text-[10px] text-muted-foreground">KPIs hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Star className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{myRank ? `#${myRank}` : '—'}</p>
                <p className="text-[10px] text-muted-foreground">
                  Ranking{totalSellers > 0 ? ` / ${totalSellers}` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly AI Feedback */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Feedback Semanal da IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <strong className="text-foreground">Ponto forte:</strong> Seu streak de {userXp?.current_streak ?? 0} dias mostra consistencia acima da media da equipe.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong className="text-foreground">Oportunidade:</strong> Sua taxa de conversao esta 13pp abaixo da meta.
                {activeMissions.length > 0
                  ? ` Complete suas ${activeMissions.length} missoes ativas para ganhar ate +R$ ${(activeMissions.reduce((s, m) => s + Math.round(m.xp_reward * 1.5), 0)).toLocaleString('pt-BR')} em bonus.`
                  : ' Aceite a missao de follow-up sugerida pela IA para melhorar.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Metrics with commission link */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Metricas Rapidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-3">
            <div className="text-center space-y-0.5">
              <p className="text-lg font-bold text-emerald-500">22%</p>
              <p className="text-[10px] text-muted-foreground">Taxa Conversao</p>
              <p className="text-[9px] text-emerald-500/80 font-medium">
                <DollarSign className="h-2.5 w-2.5 inline" /> Atingir meta: +R$ 400
              </p>
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-lg font-bold text-blue-500">R$ 7.200</p>
              <p className="text-[10px] text-muted-foreground">Ticket Medio</p>
              <p className="text-[9px] text-blue-500/80 font-medium">
                <DollarSign className="h-2.5 w-2.5 inline" /> Atingir meta: +R$ 600
              </p>
            </div>
            <div className="text-center space-y-0.5">
              <p className="text-lg font-bold text-amber-500">R$ 45k</p>
              <p className="text-[10px] text-muted-foreground">Pipeline</p>
              <p className="text-[9px] text-amber-500/80 font-medium">
                <DollarSign className="h-2.5 w-2.5 inline" /> Atingir meta: +R$ 280
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-3">
        <Button variant="outline" className="h-auto py-3 flex-col gap-1" render={<Link href="/performance/indicadores" />}>
          <BarChart3 className="h-5 w-5 text-blue-500" />
          <span className="text-xs font-medium">Indicadores</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1" render={<Link href="/performance/missoes" />}>
          <CheckSquare className="h-5 w-5 text-amber-500" />
          <span className="text-xs font-medium">Missoes</span>
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1" render={<Link href="/ganhos/comissao" />}>
          <DollarSign className="h-5 w-5 text-emerald-500" />
          <span className="text-xs font-medium">Comissao</span>
        </Button>
      </div>

      {/* Coach IA */}
      <CoachWidget />
    </div>
  )
}
