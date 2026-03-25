'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Medal } from 'lucide-react'
import { BADGE_RARITIES } from '@/lib/constants'
import type { Badge as BadgeType, UserBadge, BadgeRarity } from '@/types'

export default function ConquistasPage() {
  const { user } = useAuth()
  const [badges, setBadges] = useState<BadgeType[]>([])
  const [earned, setEarned] = useState<UserBadge[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const [{ data: allBadges }, { data: userBadges }] = await Promise.all([
        supabase
          .from('badges')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .order('rarity', { ascending: true }),
        supabase
          .from('user_badges')
          .select('*')
          .eq('user_id', user.id),
      ])

      setBadges(allBadges ?? [])
      setEarned(userBadges ?? [])
      setLoading(false)
    }
    fetch().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  const earnedIds = new Set(earned.map((e) => e.badge_id))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Conquistas</h2>
        <p className="text-muted-foreground">
          {earned.length} de {badges.length} badges conquistados
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : badges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Medal className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum badge configurado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {badges.map((badge) => {
            const isEarned = earnedIds.has(badge.id)
            const rarity = BADGE_RARITIES[badge.rarity as BadgeRarity]
            const earnDate = earned.find((e) => e.badge_id === badge.id)?.earned_at

            return (
              <Card key={badge.id} className={!isEarned ? 'opacity-50 grayscale' : ''}>
                <CardContent className="flex flex-col items-center p-6 text-center">
                  <div
                    className="mb-3 flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${rarity.color}20`, color: rarity.color }}
                  >
                    <Medal className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold">{badge.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{badge.description}</p>
                  <Badge
                    variant="outline"
                    className="mt-2"
                    style={{ borderColor: rarity.color, color: rarity.color }}
                  >
                    {rarity.label}
                  </Badge>
                  <p className="mt-1 text-xs font-medium text-primary">+{badge.xp_reward} XP</p>
                  {isEarned && earnDate && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Conquistado em {new Date(earnDate).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
