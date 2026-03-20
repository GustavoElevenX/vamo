'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Gift,
  Star,
  Utensils,
  BookOpen,
  Sun,
  Monitor,
  DollarSign,
  ShoppingBag,
  Wallet,
  ArrowRight,
  Settings2,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Save,
  Zap,
} from 'lucide-react'

interface ManagerReward {
  id: string
  title: string
  cost_xp: number
  icon: React.ElementType
  category: 'tempo' | 'financeiro' | 'desenvolvimento' | 'reconhecimento'
  badge_color: string
  active: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  tempo: 'Tempo',
  financeiro: 'Financeiro',
  desenvolvimento: 'Desenvolvimento',
  reconhecimento: 'Reconhecimento',
}

const INITIAL_REWARDS: ManagerReward[] = [
  {
    id: 'reconhecimento-publico',
    title: 'Reconhecimento Público',
    cost_xp: 1000,
    icon: Star,
    category: 'reconhecimento',
    badge_color: 'bg-amber-500/10 text-amber-600',
    active: true,
  },
  {
    id: 'almoco-lider',
    title: 'Almoço com Liderança',
    cost_xp: 2000,
    icon: Utensils,
    category: 'reconhecimento',
    badge_color: 'bg-violet-500/10 text-violet-600',
    active: true,
  },
  {
    id: 'vale-presente',
    title: 'Vale-Presente R$100',
    cost_xp: 3000,
    icon: Gift,
    category: 'financeiro',
    badge_color: 'bg-emerald-500/10 text-emerald-600',
    active: true,
  },
  {
    id: 'capacitacao',
    title: 'Capacitação Externa',
    cost_xp: 4000,
    icon: BookOpen,
    category: 'desenvolvimento',
    badge_color: 'bg-blue-500/10 text-blue-600',
    active: true,
  },
  {
    id: 'folga-extra',
    title: 'Folga Extra',
    cost_xp: 5000,
    icon: Sun,
    category: 'tempo',
    badge_color: 'bg-orange-500/10 text-orange-600',
    active: true,
  },
  {
    id: 'upgrade-equipamento',
    title: 'Upgrade Equipamento',
    cost_xp: 8000,
    icon: Monitor,
    category: 'desenvolvimento',
    badge_color: 'bg-primary/10 text-primary',
    active: false,
  },
]

export default function RecompensasPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rewards, setRewards] = useState<ManagerReward[]>(INITIAL_REWARDS)
  const [resgatesNoMes, setResgatesNoMes] = useState(0)
  const [orcamentoUsado, setOrcamentoUsado] = useState(0)
  const [missionBonus, setMissionBonus] = useState(75)
  const [kpiMultiplier, setKpiMultiplier] = useState(1.5)
  const [acceleratorRule, setAcceleratorRule] = useState('Após 3 missões seguidas, bônus sobe 20%')
  const [saving, setSaving] = useState(false)

  const orcamentoTotal = 15000

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      // Fetch redemption count for the current month
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const { count } = await supabase
        .from('reward_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', user.organization_id)
        .gte('created_at', firstOfMonth)

      setResgatesNoMes(count ?? 0)

      // Estimate budget used (count * avg reward value)
      const estimatedUsed = (count ?? 0) * 150
      setOrcamentoUsado(estimatedUsed)

      setLoading(false)
    }

    fetchData()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const toggleReward = (id: string) => {
    setRewards((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 800))
    setSaving(false)
  }

  const totalRecompensas = rewards.filter((r) => r.active).length
  const orcamentoPercent = Math.min((orcamentoUsado / orcamentoTotal) * 100, 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Recompensas</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure a loja de XP e bônus financeiros para sua equipe
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Recompensas</p>
                <p className="text-lg font-bold">{totalRecompensas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Orçamento Mensal</p>
                <p className="text-lg font-bold">R$ {orcamentoTotal.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Gift className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resgates no Mês</p>
                <p className="text-lg font-bold">{resgatesNoMes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget panel */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Usado este mês</span>
            <span className="font-semibold">
              R$ {orcamentoUsado.toLocaleString('pt-BR')} / R$ {orcamentoTotal.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted/50">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                orcamentoPercent > 80 ? 'bg-red-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${orcamentoPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {orcamentoPercent > 80
              ? 'Atenção: orçamento próximo do limite.'
              : `${(100 - orcamentoPercent).toFixed(0)}% do orçamento disponível`}
          </p>
        </CardContent>
      </Card>

      {/* Rewards grid (manager editing view) */}
      <div>
        <h3 className="text-sm font-medium mb-3">Recompensas da Loja</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((reward) => {
            const Icon = reward.icon

            return (
              <Card
                key={reward.id}
                className={`border-border/50 transition-all duration-200 ${
                  !reward.active ? 'opacity-60' : ''
                }`}
              >
                <CardContent className="pt-5 pb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${reward.badge_color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {CATEGORY_LABELS[reward.category]}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-sm">{reward.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-bold text-primary">
                        {reward.cost_xp.toLocaleString('pt-BR')} XP
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => toggleReward(reward.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {reward.active ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-emerald-500" />
                          <span>Ativa</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          <span>Inativa</span>
                        </>
                      )}
                    </button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Financial bonus config */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <CardTitle className="text-sm font-medium">Bônus Financeiros</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Bônus por Missão Concluída
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <input
                  type="number"
                  value={missionBonus}
                  onChange={(e) => setMissionBonus(Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Multiplicador de KPI
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={kpiMultiplier}
                  onChange={(e) => setKpiMultiplier(Number(e.target.value))}
                  className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-sm text-muted-foreground">x</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Regra de Acelerador
              </label>
              <input
                type="text"
                value={acceleratorRule}
                onChange={(e) => setAcceleratorRule(e.target.value)}
                className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <span className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full border border-white border-t-transparent animate-spin" />
              Salvando...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Save className="h-4 w-4" />
              Salvar Configuração
            </span>
          )}
        </Button>

        <Link href="/objetivos/lancamento">
          <Button variant="outline" className="gap-1.5">
            Avançar para Lançamento
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
