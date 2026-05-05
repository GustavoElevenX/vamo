'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { MeetingAgendaSheet } from '@/components/hoje-gestor/meeting-agenda-sheet'
import { ContextualRecommendationCard, type ContextualRecommendation } from '@/components/performance-os/ContextualRecommendationCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowRight, BarChart3, Eye, Target, Trophy, UserRound, Zap } from 'lucide-react'

type Alert = { id: string; title?: string; message?: string; severity?: string; entity_name?: string }
type Seller = { id: string; name: string; role: string; active: boolean }
type Ranking = { user_id: string; total_xp: number; users?: { name: string } }
type KpiEntry = { value: number; points_earned?: number; recorded_at: string }

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function HojeGestorPage() {
  const { user } = useRequiredAuth()
  const supabase = useMemo(() => createClient(), [])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [kpis, setKpis] = useState<KpiEntry[]>([])
  const [ranking, setRanking] = useState<Ranking[]>([])
  const [team, setTeam] = useState<Seller[]>([])
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      const monthStart = new Date()
      monthStart.setDate(1)
      const [alertsRes, kpiRes, rankingRes, teamRes, recommendationsRes] = await Promise.allSettled([
        fetch('/api/ai/alerts'),
        supabase
          .from('kpi_entries')
          .select('value, points_earned, recorded_at')
          .eq('organization_id', user.organization_id)
          .gte('recorded_at', monthStart.toISOString().slice(0, 10)),
        supabase
          .from('user_xp')
          .select('user_id, total_xp, users(name)')
          .eq('organization_id', user.organization_id)
          .order('total_xp', { ascending: false })
          .limit(3),
        supabase
          .from('users')
          .select('id, name, role, active')
          .eq('organization_id', user.organization_id)
          .eq('role', 'seller')
          .eq('active', true),
        fetch('/api/action-recommendations'),
      ])

      if (cancelled) return
      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const body = await alertsRes.value.json()
        setAlerts(((body.alerts ?? []) as (Alert & { read?: boolean })[]).filter((alert) => alert.read === false).slice(0, 4))
      }
      if (kpiRes.status === 'fulfilled') setKpis(kpiRes.value.data ?? [])
      if (rankingRes.status === 'fulfilled') setRanking((rankingRes.value.data ?? []) as Ranking[])
      if (teamRes.status === 'fulfilled') setTeam(teamRes.value.data ?? [])
      if (recommendationsRes.status === 'fulfilled' && recommendationsRes.value.ok) {
        const body = await recommendationsRes.value.json().catch(() => ({ recommendations: [] }))
        setRecommendations(((body.recommendations ?? []) as ContextualRecommendation[]).slice(0, 4))
      }
      setLoading(false)
    }
    fetchData().catch(() => setLoading(false))
    return () => { cancelled = true }
  }, [supabase, user.organization_id])

  const totalValue = kpis.reduce((sum, entry) => sum + Number(entry.value || 0), 0)
  const totalPoints = kpis.reduce((sum, entry) => sum + Number(entry.points_earned || 0), 0)
  const attention = team.slice(0, alerts.length ? 3 : 0)
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting()}, {user.name.split(' ')[0]}.</h1>
          <p className="text-sm capitalize text-muted-foreground">{date}</p>
        </div>
        <MeetingAgendaSheet />
      </div>

      {!!alerts.length && (
        <Card className="border-amber-500/25">
          <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" />Alertas ativos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                <p className="text-sm">{alert.title || alert.message || 'Alerta da VAMO IA'}</p>
                <Link href="/monitoramento/alertas"><Button variant="outline" size="sm">Ver</Button></Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!!attention.length && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Quem precisa de atencao</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {attention.map((seller) => (
              <div key={seller.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                <span className="flex items-center gap-2 text-sm font-medium"><UserRound className="h-4 w-4" />{seller.name}</span>
                <span className="text-xs text-muted-foreground">cruze com alertas ativos</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!!kpis.length && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Registros no mes</p><p className="text-2xl font-bold">{kpis.length}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Volume registrado</p><p className="text-2xl font-bold">{totalValue.toLocaleString('pt-BR')}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">XP gerado</p><p className="text-2xl font-bold">{totalPoints.toLocaleString('pt-BR')}</p></CardContent></Card>
        </div>
      )}

      {(alerts.length || kpis.length) > 0 && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge><Target className="h-3 w-3" />Acao recomendada</Badge>
              <p className="mt-2 text-sm font-medium">Resolva primeiro o alerta de maior impacto e use a pauta para alinhar o proximo passo com a equipe.</p>
            </div>
            <Link href={alerts.length ? '/monitoramento/alertas' : '/crm'}>
              <Button><ArrowRight className="h-4 w-4" />Agir</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!!recommendations.length && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Decisoes prioritarias</CardTitle></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {recommendations.map((recommendation) => (
              <ContextualRecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </CardContent>
        </Card>
      )}

      {!!ranking.length && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Top desta semana</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ranking.map((item, index) => (
              <div key={item.user_id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <span className="text-sm font-medium">{index + 1}. {item.users?.name || 'Vendedor'}</span>
                <span className="flex items-center gap-1 text-sm"><BarChart3 className="h-4 w-4" />{item.total_xp.toLocaleString('pt-BR')} XP</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!alerts.length && !kpis.length && !ranking.length && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Sem dados reais suficientes para montar o painel de hoje.</CardContent></Card>
      )}
    </div>
  )
}
