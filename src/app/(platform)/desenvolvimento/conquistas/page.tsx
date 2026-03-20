'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Medal,
  Lock,
  Zap,
  Trophy,
  Calendar,
} from 'lucide-react'
import { BADGE_RARITIES, DEFAULT_XP_LEVELS } from '@/lib/constants'
import type { UserXp, XpLevel, Badge as BadgeType, UserBadge } from '@/types'

interface EarnedBadge extends BadgeType {
  earned_at?: string
}

export default function ConquistasPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [currentLevel, setCurrentLevel] = useState<XpLevel | null>(null)
  const [nextLevel, setNextLevel] = useState<XpLevel | null>(null)
  const [allLevels, setAllLevels] = useState<XpLevel[]>([])
  const [allBadges, setAllBadges] = useState<BadgeType[]>([])
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Map<string, string>>(new Map())
  const [totalBadgeCount, setTotalBadgeCount] = useState(0)

  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      const [
        { data: xp },
        { data: levels },
        { data: badges },
        { data: userBadges },
      ] = await Promise.all([
        supabase.from('user_xp').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('xp_levels').select('*').eq('organization_id', user.organization_id).order('level', { ascending: true }),
        supabase.from('badges').select('*').eq('organization_id', user.organization_id).eq('active', true),
        supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user.id),
      ])

      setUserXp(xp)
      setAllLevels((levels ?? []) as XpLevel[])
      setAllBadges((badges ?? []) as BadgeType[])
      setTotalBadgeCount(badges?.length ?? 0)

      const earnedMap = new Map<string, string>()
      if (userBadges) {
        for (const ub of userBadges) {
          earnedMap.set(ub.badge_id, ub.earned_at)
        }
      }
      setEarnedBadgeIds(earnedMap)

      if (xp && levels) {
        setCurrentLevel(levels.find((l: XpLevel) => l.level === xp.current_level) ?? null)
        setNextLevel(levels.find((l: XpLevel) => l.level === xp.current_level + 1) ?? null)
      }

      setLoading(false)
    }

    fetchAll()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const xpProgress =
    currentLevel && nextLevel
      ? Math.round(
          (((userXp?.total_xp ?? 0) - currentLevel.xp_required) /
            (nextLevel.xp_required - currentLevel.xp_required)) * 100
        )
      : 100
  const xpToNext = nextLevel ? nextLevel.xp_required - (userXp?.total_xp ?? 0) : 0
  const earnedCount = earnedBadgeIds.size

  const rarityColor = (rarity: string) => {
    const r = BADGE_RARITIES[rarity as keyof typeof BADGE_RARITIES]
    return r?.color ?? '#9ca3af'
  }

  const rarityLabel = (rarity: string) => {
    const r = BADGE_RARITIES[rarity as keyof typeof BADGE_RARITIES]
    return r?.label ?? 'Comum'
  }

  // Sort: earned first, then by rarity
  const sortedBadges = [...allBadges].sort((a, b) => {
    const aEarned = earnedBadgeIds.has(a.id) ? 0 : 1
    const bEarned = earnedBadgeIds.has(b.id) ? 0 : 1
    return aEarned - bEarned
  })

  // Last 5 earned
  const recentEarned = allBadges
    .filter((b) => earnedBadgeIds.has(b.id))
    .map((b) => ({ ...b, earned_at: earnedBadgeIds.get(b.id)! }))
    .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Conquistas e XP</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {earnedCount} de {totalBadgeCount} badges conquistados
        </p>
      </div>

      {/* Level Info Card */}
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

      {/* XP Levels Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Niveis de XP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {(allLevels.length > 0 ? allLevels : DEFAULT_XP_LEVELS.map((l) => ({ ...l, id: String(l.level), organization_id: '', icon_url: null }))).map((level) => {
              const isCurrent = level.level === (userXp?.current_level ?? 1)
              return (
                <div
                  key={level.level}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                    isCurrent ? 'bg-emerald-500/10 border border-emerald-500/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${isCurrent ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      {level.level}
                    </span>
                    <span className={`text-xs ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`}>
                      {level.name}
                    </span>
                    {isCurrent && (
                      <Badge className="text-[8px] h-3.5 px-1 bg-emerald-500/10 text-emerald-600 border-0">
                        Atual
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {level.xp_required.toLocaleString()} XP
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Badge Grid */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Badges</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedBadges.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Medal className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum badge cadastrado.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedBadges.map((badge) => {
                const isEarned = earnedBadgeIds.has(badge.id)
                const earnedAt = earnedBadgeIds.get(badge.id)
                return (
                  <div
                    key={badge.id}
                    className={`rounded-lg border p-3 text-center ${
                      isEarned ? 'border-border/50' : 'border-border/30 opacity-50 grayscale'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center mx-auto ${
                      isEarned ? 'bg-violet-500/10' : 'bg-muted/30'
                    }`}>
                      {isEarned ? (
                        <Medal className="h-5 w-5 text-violet-500" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs font-medium mt-2">{badge.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{badge.description}</p>
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <Badge variant="secondary" className="text-[9px]">+{badge.xp_reward} XP</Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px]"
                        style={{ color: rarityColor(badge.rarity), borderColor: `${rarityColor(badge.rarity)}40` }}
                      >
                        {rarityLabel(badge.rarity)}
                      </Badge>
                    </div>
                    {isEarned && earnedAt && (
                      <p className="text-[9px] text-muted-foreground mt-1">
                        Conquistado em {new Date(earnedAt).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Earned */}
      {recentEarned.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ultimas Conquistas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentEarned.map((badge) => (
              <div key={badge.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Medal className="h-4 w-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{badge.name}</p>
                  <p className="text-[10px] text-muted-foreground">{badge.description}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(badge.earned_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
