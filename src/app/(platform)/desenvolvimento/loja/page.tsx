'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Zap, ShoppingBag, Sun, Gift, BookOpen, Star,
  Lock, CheckCircle2, Trophy, Clock, Package,
} from 'lucide-react'
import type { UserXp, RewardCatalog, RewardRedemption } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  tempo: 'Tempo',
  financeiro: 'Financeiro',
  desenvolvimento: 'Desenvolvimento',
  reconhecimento: 'Reconhecimento',
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  tempo: Sun,
  financeiro: Gift,
  desenvolvimento: BookOpen,
  reconhecimento: Star,
}

const CATEGORY_COLORS: Record<string, string> = {
  tempo: 'bg-orange-500/10 text-orange-600',
  financeiro: 'bg-emerald-500/10 text-emerald-600',
  desenvolvimento: 'bg-blue-500/10 text-blue-600',
  reconhecimento: 'bg-amber-500/10 text-amber-600',
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-600 border-0' },
  approved: { label: 'Aprovado', className: 'bg-emerald-500/10 text-emerald-600 border-0' },
  rejected: { label: 'Rejeitado', className: 'bg-red-500/10 text-red-600 border-0' },
  delivered: { label: 'Entregue', className: 'bg-primary/10 text-primary border-0' },
}

// Fallback rewards shown when org has no reward_catalog entries
const FALLBACK_REWARDS: Omit<RewardCatalog, 'organization_id'>[] = [
  { id: 'fb-1', name: 'Reconhecimento Publico', description: 'Destaque no feed da equipe com mensagem personalizada do gestor e badge especial.', cost_xp: 1000, image_url: null, quantity: null, active: true, created_at: '' },
  { id: 'fb-2', name: 'Almoco com a Lideranca', description: 'Almoco exclusivo com o CEO ou gestor para conversar sobre carreira e estrategia.', cost_xp: 2000, image_url: null, quantity: null, active: true, created_at: '' },
  { id: 'fb-3', name: 'Vale-Presente R$ 100', description: 'Credito de R$ 100 em cartao presente para usar como preferir.', cost_xp: 3000, image_url: null, quantity: null, active: true, created_at: '' },
  { id: 'fb-4', name: 'Capacitacao Externa', description: 'Inscricao em curso, workshop ou evento da sua escolha.', cost_xp: 4000, image_url: null, quantity: null, active: true, created_at: '' },
  { id: 'fb-5', name: 'Folga Extra', description: 'Um dia de folga adicional para recarregar as energias. Agendar com o gestor.', cost_xp: 5000, image_url: null, quantity: null, active: true, created_at: '' },
  { id: 'fb-6', name: 'Upgrade de Equipamento', description: 'Melhoria no setup de trabalho: headset, cadeira, monitor ou acessorio a escolha.', cost_xp: 8000, image_url: null, quantity: null, active: true, created_at: '' },
]

function guessCategory(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('folga') || lower.includes('day off') || lower.includes('tempo')) return 'tempo'
  if (lower.includes('vale') || lower.includes('bonus') || lower.includes('financ')) return 'financeiro'
  if (lower.includes('curso') || lower.includes('capacit') || lower.includes('upgrade') || lower.includes('equip')) return 'desenvolvimento'
  return 'reconhecimento'
}

export default function LojaPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [rewards, setRewards] = useState<RewardCatalog[]>([])
  const [redemptions, setRedemptions] = useState<(RewardRedemption & { reward_name?: string })[]>([])
  const [redeemedIds, setRedeemedIds] = useState<Set<string>>(new Set())
  const [redeeming, setRedeeming] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const [{ data: xp }, { data: catalogData }, { data: redemptionData }] = await Promise.all([
        supabase
          .from('user_xp')
          .select('*')
          .eq('user_id', user.id)
          .eq('organization_id', user.organization_id)
          .maybeSingle(),
        supabase
          .from('reward_catalog')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .order('cost_xp', { ascending: true }),
        supabase
          .from('reward_redemptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('organization_id', user.organization_id)
          .order('created_at', { ascending: false }),
      ])

      setUserXp(xp)

      const catalogItems = (catalogData && catalogData.length > 0)
        ? (catalogData as RewardCatalog[])
        : (FALLBACK_REWARDS as RewardCatalog[])
      setRewards(catalogItems)

      const redeems = (redemptionData ?? []) as RewardRedemption[]
      const redeemMap = new Map(catalogItems.map(r => [r.id, r.name]))
      setRedemptions(redeems.map(r => ({ ...r, reward_name: redeemMap.get(r.reward_id) ?? 'Recompensa' })))
      setRedeemedIds(new Set(redeems.filter(r => r.status !== 'rejected').map(r => r.reward_id)))

      setLoading(false)
    }

    fetchData().catch(() => setLoading(false))
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const availableXp = userXp?.total_xp ?? 0

  const handleRedeem = async (reward: RewardCatalog) => {
    if (availableXp < reward.cost_xp || redeeming) return
    setRedeeming(reward.id)

    const { error } = await supabase.from('reward_redemptions').insert({
      user_id: user.id,
      reward_id: reward.id,
      organization_id: user.organization_id,
      xp_spent: reward.cost_xp,
      status: 'pending',
    })

    if (!error) {
      setRedeemedIds(prev => new Set([...prev, reward.id]))
      setRedemptions(prev => [{
        id: crypto.randomUUID(),
        user_id: user.id,
        reward_id: reward.id,
        organization_id: user.organization_id,
        xp_spent: reward.cost_xp,
        status: 'pending' as const,
        approved_by: null,
        created_at: new Date().toISOString(),
        reward_name: reward.name,
      }, ...prev])
    }

    setRedeeming(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Loja de Recompensas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Troque seu XP conquistado por recompensas reais</p>
        </div>

        {/* XP Balance */}
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 w-fit">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground leading-none">Seu saldo</p>
            <p className="text-base font-bold text-primary leading-tight">
              {availableXp.toLocaleString('pt-BR')} XP
            </p>
          </div>
        </div>
      </div>

      {/* Level info */}
      {userXp && (
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-accent/20 px-4 py-3">
          <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Voce esta no <strong>Nivel {userXp.current_level}</strong> com {availableXp.toLocaleString('pt-BR')} XP acumulados.
            Continue completando missoes para desbloquear mais recompensas.
          </p>
        </div>
      )}

      {/* Rewards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => {
          const category = guessCategory(reward.name)
          const Icon = CATEGORY_ICONS[category] ?? Star
          const badgeColor = CATEGORY_COLORS[category] ?? 'bg-primary/10 text-primary'
          const canAfford = availableXp >= reward.cost_xp
          const isRedeemed = redeemedIds.has(reward.id)
          const isRedeeming = redeeming === reward.id
          const deficit = reward.cost_xp - availableXp
          const isAlmostThere = !canAfford && deficit <= reward.cost_xp * 0.3

          return (
            <Card
              key={reward.id}
              className={`border-border/50 transition-all duration-200 ${
                !canAfford && !isRedeemed && !isAlmostThere ? 'opacity-70' : ''
              } ${isRedeemed ? 'border-emerald-500/30 bg-emerald-500/5' : ''} ${
                isAlmostThere ? 'border-amber-500/30 bg-amber-500/5' : ''
              }`}
            >
              <CardContent className="pt-5 pb-4 space-y-3">
                {/* Icon + badges */}
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${badgeColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {CATEGORY_LABELS[category] ?? category}
                  </Badge>
                </div>

                {/* Title + desc */}
                <div>
                  <p className="font-semibold text-sm">{reward.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {reward.description}
                  </p>
                </div>

                {/* Cost + CTA */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <span className={`text-sm font-bold ${canAfford ? 'text-primary' : 'text-muted-foreground'}`}>
                      {reward.cost_xp.toLocaleString('pt-BR')} XP
                    </span>
                  </div>

                  {isRedeemed ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Solicitado
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3"
                      disabled={!canAfford || isRedeeming}
                      onClick={() => handleRedeem(reward)}
                    >
                      {isRedeeming ? (
                        <span className="flex items-center gap-1.5">
                          <div className="h-3 w-3 rounded-full border border-white border-t-transparent animate-spin" />
                          Aguarde...
                        </span>
                      ) : isAlmostThere ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          Faltam {deficit.toLocaleString('pt-BR')} XP
                        </span>
                      ) : !canAfford ? (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          {deficit.toLocaleString('pt-BR')} XP
                        </span>
                      ) : (
                        'Resgatar'
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Meus Resgates */}
      {redemptions.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Meus Resgates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {redemptions.slice(0, 10).map((r) => {
              const status = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.reward_name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(r.created_at).toLocaleDateString('pt-BR')}
                        <span className="mx-1">·</span>
                        {r.xp_spent.toLocaleString('pt-BR')} XP
                      </p>
                    </div>
                  </div>
                  <Badge className={`text-[9px] h-4 px-1.5 shrink-0 ${status.className}`}>
                    {status.label}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Footer note */}
      <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <ShoppingBag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Os resgates sao solicitacoes enviadas ao seu gestor para aprovacao. O XP
            e descontado somente apos a confirmacao. Novas recompensas sao adicionadas
            periodicamente conforme politicas da empresa.
          </p>
        </div>
      </div>
    </div>
  )
}
