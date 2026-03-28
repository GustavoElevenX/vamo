'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  Brain,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react'

interface MissionSummary {
  id: string
  xp_reward: number
}

export default function ProjecaoPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [activeMissions, setActiveMissions] = useState<MissionSummary[]>([])

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data } = await supabase
        .from('ai_missions')
        .select('id, xp_reward')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])

      setActiveMissions((data ?? []) as MissionSummary[])
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

  const baseSalary = 2500
  const completedMissionBonus = 0
  const pendingMissionBonus = activeMissions.reduce((s, m) => s + m.xp_reward * 1.5, 0)
  const maxMissionBonus = pendingMissionBonus * 1.4

  const scenarios = [
    {
      label: 'Cenario Atual',
      desc: 'Sem completar novas missoes',
      total: baseSalary + completedMissionBonus,
      color: 'text-muted-foreground',
      border: 'border-border/40',
      bg: 'bg-muted',
      textColor: 'text-muted-foreground',
    },
    {
      label: 'Com Missoes Ativas',
      desc: `Se completar ${activeMissions.length} missoes em andamento`,
      total: baseSalary + completedMissionBonus + pendingMissionBonus,
      color: 'text-amber-500',
      border: 'border-amber-500/20 bg-amber-500/5',
      bg: 'bg-amber-500/15',
      textColor: 'text-amber-500',
    },
    {
      label: 'Cenario Maximo',
      desc: 'Todas as missoes + KPIs no topo',
      total: baseSalary + completedMissionBonus + maxMissionBonus,
      color: 'text-emerald-500',
      border: 'border-emerald-500/20 bg-emerald-500/5',
      bg: 'bg-emerald-500/15',
      textColor: 'text-emerald-500',
    },
  ]

  const actions = [
    { action: 'Completar missao de upsell', gain: '+R$ 600' },
    { action: 'Manter streak CRM ate dia 30', gain: '+R$ 150 + badge' },
    { action: 'Fechar 2 negocios esta semana', gain: '+R$ 280' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Projecao de Ganhos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Simulacao baseada nas suas missoes e KPIs</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[9px] text-emerald-600 font-medium">Tempo real</span>
          </div>
          <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-500 border-0">
            <Brain className="h-2.5 w-2.5 mr-0.5" />VAMO IA
          </Badge>
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="space-y-3">
        {scenarios.map((scenario, i) => (
          <Card key={scenario.label} className={`${scenario.border}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${scenario.bg} ${scenario.textColor}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{scenario.label}</p>
                  <p className="text-[10px] text-muted-foreground">{scenario.desc}</p>
                </div>
                <span className={`text-lg font-bold shrink-0 ${scenario.color}`}>
                  R$ {scenario.total.toLocaleString('pt-BR')}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action x Gain Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">Acao x Ganho Adicional</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <span className="text-xs text-muted-foreground">{item.action}</span>
              <span className="text-xs font-medium text-emerald-500">{item.gain}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Link to Comissao */}
      <Link href="/ganhos/comissao">
        <Button variant="outline" size="sm" className="w-full text-xs">
          Ver comissao detalhada <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </Link>
    </div>
  )
}
