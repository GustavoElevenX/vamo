'use client'

import { Medal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BADGE_RARITIES } from '@/lib/constants'
import type { BadgeRarity } from '@/types'

interface BadgeCardProps {
  name: string
  description: string
  rarity: BadgeRarity
  xpReward: number
  earned?: boolean
  earnedAt?: string
}

export function BadgeCard({ name, description, rarity, xpReward, earned = false, earnedAt }: BadgeCardProps) {
  const rarityInfo = BADGE_RARITIES[rarity]

  return (
    <div className={`flex flex-col items-center p-4 text-center ${!earned ? 'opacity-50 grayscale' : ''}`}>
      <div
        className="mb-2 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: `${rarityInfo.color}20`, color: rarityInfo.color }}
      >
        <Medal className="h-7 w-7" />
      </div>
      <h4 className="text-sm font-semibold">{name}</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <Badge variant="outline" className="mt-1.5" style={{ borderColor: rarityInfo.color, color: rarityInfo.color }}>
        {rarityInfo.label}
      </Badge>
      <span className="mt-1 text-xs font-medium text-primary">+{xpReward} XP</span>
      {earned && earnedAt && (
        <span className="mt-1 text-xs text-muted-foreground">
          {new Date(earnedAt).toLocaleDateString('pt-BR')}
        </span>
      )}
    </div>
  )
}
