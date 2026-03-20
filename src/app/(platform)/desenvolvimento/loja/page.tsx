'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Zap, ShoppingBag, Sun, Gift, Utensils, BookOpen, Monitor, Star,
  Lock, CheckCircle2, Trophy,
} from 'lucide-react'
import type { UserXp } from '@/types'

interface Reward {
  id: string
  title: string
  description: string
  cost_xp: number
  icon: React.ElementType
  category: 'tempo' | 'financeiro' | 'desenvolvimento' | 'reconhecimento'
  badge_color: string
  popular?: boolean
}

const STATIC_REWARDS: Reward[] = [
  {
    id: 'reconhecimento-publico',
    title: 'Reconhecimento Publico',
    description: 'Destaque no feed da equipe com mensagem personalizada do gestor e badge especial.',
    cost_xp: 1000,
    icon: Star,
    category: 'reconhecimento',
    badge_color: 'bg-amber-500/10 text-amber-600',
    popular: true,
  },
  {
    id: 'almoco-lider',
    title: 'Almoco com a Lideranca',
    description: 'Almoco exclusivo com o CEO ou gestor para conversar sobre carreira e estrategia.',
    cost_xp: 2000,
    icon: Utensils,
    category: 'reconhecimento',
    badge_color: 'bg-violet-500/10 text-violet-600',
  },
  {
    id: 'vale-presente',
    title: 'Vale-Presente R$ 100',
    description: 'Credito de R$ 100 em cartao presente para usar como preferir.',
    cost_xp: 3000,
    icon: Gift,
    category: 'financeiro',
    badge_color: 'bg-emerald-500/10 text-emerald-600',
    popular: true,
  },
  {
    id: 'capacitacao',
    title: 'Capacitacao Externa',
    description: 'Inscricao em curso, workshop ou evento da sua escolha. Invista no seu crescimento.',
    cost_xp: 4000,
    icon: BookOpen,
    category: 'desenvolvimento',
    badge_color: 'bg-blue-500/10 text-blue-600',
  },
  {
    id: 'folga-extra',
    title: 'Folga Extra',
    description: 'Um dia de folga adicional para recarregar as energias. Agendar com o gestor.',
    cost_xp: 5000,
    icon: Sun,
    category: 'tempo',
    badge_color: 'bg-orange-500/10 text-orange-600',
  },
  {
    id: 'upgrade-equipamento',
    title: 'Upgrade de Equipamento',
    description: 'Melhoria no seu setup de trabalho: headset, cadeira, monitor ou acessorio a escolha.',
    cost_xp: 8000,
    icon: Monitor,
    category: 'desenvolvimento',
    badge_color: 'bg-primary/10 text-primary',
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  tempo: 'Tempo',
  financeiro: 'Financeiro',
  desenvolvimento: 'Desenvolvimento',
  reconhecimento: 'Reconhecimento',
}

export default function DesenvolvimentoLojaPage() {
  const { user } = useAuth()
  const [userXp, setUserXp] = useState<UserXp | null>(null)
  const [redeemed, setRedeemed] = useState<Set<string>>(new Set())
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_xp')
      .select('*')
      .eq('user_id', user.id)
      .eq('organization_id', user.organization_id)
      .maybeSingle()
      .then(({ data }) => setUserXp(data))
  }, [user])

  if (!user) return null

  const availableXp = userXp?.total_xp ?? 0

  const handleRedeem = async (reward: Reward) => {
    if (availableXp < reward.cost_xp || redeeming) return
    setRedeeming(reward.id)
    await new Promise((r) => setTimeout(r, 800))
    setRedeemed((prev) => new Set([...prev, reward.id]))
    setRedeeming(null)
  }

  const sortedRewards = [...STATIC_REWARDS].sort((a, b) => a.cost_xp - b.cost_xp)

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
        {sortedRewards.map((reward) => {
          const Icon = reward.icon
          const canAfford = availableXp >= reward.cost_xp
          const isRedeemed = redeemed.has(reward.id)
          const isRedeeming = redeeming === reward.id

          return (
            <Card
              key={reward.id}
              className={`border-border/50 transition-all duration-200 ${
                !canAfford && !isRedeemed ? 'opacity-70' : ''
              } ${isRedeemed ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}
            >
              <CardContent className="pt-5 pb-4 space-y-3">
                {/* Icon + badges */}
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${reward.badge_color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {reward.popular && !isRedeemed && (
                      <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-0">
                        Popular
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {CATEGORY_LABELS[reward.category]}
                    </Badge>
                  </div>
                </div>

                {/* Title + desc */}
                <div>
                  <p className="font-semibold text-sm">{reward.title}</p>
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
                      ) : !canAfford ? (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          {(reward.cost_xp - availableXp).toLocaleString('pt-BR')} XP
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
