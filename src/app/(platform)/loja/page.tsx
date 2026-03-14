'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingBag, Coins } from 'lucide-react'
import type { RewardCatalog, UserXp } from '@/types'

export default function LojaPage() {
  const { user } = useAuth()
  const [rewards, setRewards] = useState<RewardCatalog[]>([])
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const [{ data: r }, { data: xp }] = await Promise.all([
        supabase
          .from('rewards_catalog')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .order('cost_xp', { ascending: true }),
        supabase
          .from('user_xp')
          .select('*')
          .eq('user_id', user.id)
          .eq('organization_id', user.organization_id)
          .maybeSingle(),
      ])
      setRewards(r ?? [])
      setUserXp(xp)
      setLoading(false)
    }
    fetch()
  }, [user])

  if (!user) return null

  const handleRedeem = async (reward: RewardCatalog) => {
    if (!userXp || userXp.total_xp < reward.cost_xp || redeeming) return
    setRedeeming(reward.id)

    await supabase.from('reward_redemptions').insert({
      user_id: user.id,
      reward_id: reward.id,
      organization_id: user.organization_id,
      xp_spent: reward.cost_xp,
      status: 'pending',
    })

    setRedeeming(null)
    alert('Resgate solicitado! Aguarde aprovação do gestor.')
  }

  const availableXp = userXp?.total_xp ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Loja de Recompensas</h2>
          <p className="text-muted-foreground">Troque seu XP por recompensas</p>
        </div>
        <Badge variant="secondary" className="text-base px-4 py-2">
          <Coins className="mr-2 h-4 w-4" />
          {availableXp.toLocaleString()} XP
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : rewards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma recompensa disponível ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {rewards.map((reward) => {
            const canAfford = availableXp >= reward.cost_xp
            const outOfStock = reward.quantity !== null && reward.quantity <= 0

            return (
              <Card key={reward.id}>
                <CardHeader>
                  <CardTitle className="text-base">{reward.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{reward.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono">
                      <Coins className="mr-1 h-3 w-3" />
                      {reward.cost_xp} XP
                    </Badge>
                    {reward.quantity !== null && (
                      <span className="text-xs text-muted-foreground">
                        {reward.quantity} disponível(is)
                      </span>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    disabled={!canAfford || outOfStock || redeeming === reward.id}
                    onClick={() => handleRedeem(reward)}
                  >
                    {redeeming === reward.id ? 'Resgatando...' : outOfStock ? 'Esgotado' : !canAfford ? 'XP Insuficiente' : 'Resgatar'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
