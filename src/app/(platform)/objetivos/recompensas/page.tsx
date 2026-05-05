'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowRight, Gift, Plus, Save, ShoppingBag, ToggleLeft, ToggleRight, Trash2, Wallet, Zap } from 'lucide-react'
import { toast } from 'sonner'

interface RewardRow {
  id?: string
  name: string
  description: string
  cost_xp: string
  quantity: string
  active: boolean
}

export default function RecompensasPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rewards, setRewards] = useState<RewardRow[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [redemptionsCount, setRedemptionsCount] = useState(0)
  const [xpCommitted, setXpCommitted] = useState(0)

  const load = async () => {
    if (!user) return
    setLoading(true)
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [catalogResult, redemptionsResult] = await Promise.all([
      supabase
        .from('rewards_catalog')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('cost_xp', { ascending: true }),
      supabase
        .from('reward_redemptions')
        .select('xp_spent')
        .eq('organization_id', user.organization_id)
        .gte('created_at', firstOfMonth),
    ])

    if (catalogResult.error) {
      toast.error('Nao foi possivel carregar recompensas.')
    } else {
      setRewards((catalogResult.data ?? []).map((reward: any) => ({
        id: reward.id,
        name: reward.name,
        description: reward.description,
        cost_xp: String(reward.cost_xp),
        quantity: reward.quantity == null ? '' : String(reward.quantity),
        active: Boolean(reward.active),
      })))
    }

    const redemptions = redemptionsResult.data ?? []
    setRedemptionsCount(redemptions.length)
    setXpCommitted(redemptions.reduce((sum: number, item: any) => sum + Number(item.xp_spent ?? 0), 0))
    setRemovedIds([])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const patchReward = (index: number, patch: Partial<RewardRow>) => {
    setRewards((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  const addReward = () => {
    setRewards((prev) => [
      ...prev,
      { name: '', description: '', cost_xp: '1000', quantity: '', active: true },
    ])
  }

  const removeReward = (index: number) => {
    setRewards((prev) => {
      const item = prev[index]
      if (item?.id) setRemovedIds((ids) => [...ids, item.id as string])
      return prev.filter((_, i) => i !== index)
    })
  }

  const save = async () => {
    if (!user) return
    setSaving(true)

    try {
      for (const id of removedIds) {
        await supabase
          .from('rewards_catalog')
          .update({ active: false })
          .eq('id', id)
          .eq('organization_id', user.organization_id)
      }

      for (const reward of rewards) {
        const name = reward.name.trim()
        const cost = Number(reward.cost_xp)
        if (!name || cost <= 0) continue

        const payload = {
          organization_id: user.organization_id,
          name,
          description: reward.description.trim() || 'Recompensa configurada pelo gestor.',
          cost_xp: cost,
          quantity: reward.quantity ? Number(reward.quantity) : null,
          active: reward.active,
        }

        if (reward.id) {
          const { error } = await supabase
            .from('rewards_catalog')
            .update(payload)
            .eq('id', reward.id)
            .eq('organization_id', user.organization_id)
          if (error) throw new Error(error.message)
        } else {
          const { error } = await supabase.from('rewards_catalog').insert(payload)
          if (error) throw new Error(error.message)
        }
      }

      toast.success('Recompensas salvas na loja.')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar recompensas.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const activeCount = rewards.filter((reward) => reward.active && reward.name.trim()).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Recompensas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Catalogo real da loja de XP. O que estiver ativo aparece para vendedores em Loja.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <ShoppingBag className="h-5 w-5 text-violet-500" />
            <div>
              <p className="text-xs text-muted-foreground">Ativas na loja</p>
              <p className="text-lg font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <Gift className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Resgates no mes</p>
              <p className="text-lg font-bold">{redemptionsCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <Wallet className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">XP comprometido</p>
              <p className="text-lg font-bold">{xpCommitted.toLocaleString('pt-BR')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={addReward}>
          <Plus className="h-3.5 w-3.5" />
          Nova recompensa
        </Button>
      </div>

      <div className="space-y-3">
        {rewards.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-10 text-center">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhuma recompensa cadastrada.</p>
              <p className="mt-1 text-xs text-muted-foreground">Crie a primeira recompensa para liberar a loja.</p>
            </CardContent>
          </Card>
        ) : (
          rewards.map((reward, index) => (
            <Card key={reward.id ?? index} className={`border-border/50 ${!reward.active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">Recompensa {index + 1}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {reward.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                    <button onClick={() => patchReward(index, { active: !reward.active })}>
                      {reward.active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeReward(index)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[1fr_0.35fr_0.35fr]">
                <div className="space-y-1.5">
                  <Input value={reward.name} onChange={(event) => patchReward(index, { name: event.target.value })} placeholder="Nome da recompensa" />
                  <Textarea value={reward.description} onChange={(event) => patchReward(index, { description: event.target.value })} placeholder="Descricao e regra de entrega" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Custo XP</label>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <Input value={reward.cost_xp} onChange={(event) => patchReward(index, { cost_xp: event.target.value })} inputMode="numeric" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Quantidade</label>
                  <Input value={reward.quantity} onChange={(event) => patchReward(index, { quantity: event.target.value })} placeholder="Ilimitada" inputMode="numeric" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" render={<Link href="/objetivos/lancamento" />}>
          Avancar para Lancamento
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
