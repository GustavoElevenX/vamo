'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Coins } from 'lucide-react'

interface RewardCardProps {
  name: string
  description: string
  costXp: number
  quantity?: number | null
  availableXp: number
  onRedeem?: () => void
  redeeming?: boolean
}

export function RewardCard({ name, description, costXp, quantity, availableXp, onRedeem, redeeming }: RewardCardProps) {
  const canAfford = availableXp >= costXp
  const outOfStock = quantity !== null && quantity !== undefined && quantity <= 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono">
            <Coins className="mr-1 h-3 w-3" />{costXp} XP
          </Badge>
          {quantity !== null && quantity !== undefined && (
            <span className="text-xs text-muted-foreground">{quantity} disponível(is)</span>
          )}
        </div>
        {onRedeem && (
          <Button
            className="w-full"
            disabled={!canAfford || outOfStock || redeeming}
            onClick={onRedeem}
          >
            {redeeming ? 'Resgatando...' : outOfStock ? 'Esgotado' : !canAfford ? 'XP Insuficiente' : 'Resgatar'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
