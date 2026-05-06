'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Bell, Briefcase, CheckCircle2, DollarSign, LineChart, MessageSquare, Target, Zap } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface Seller {
  id: string
  name: string
  avatar_url: string | null
  revenue_won: number
  individual_goal: number
  goal_pct: number
  forecast_weighted: number
  open_pipeline: number
  pipeline_at_risk: number
  won_deals_count: number
  avg_ticket: number
  conversion_rate: number
  activities_count: number
  kpi_execution_pct: number
  followups_done: number
  meetings_booked: number
  proposals_sent: number
  missions_active: number
  missions_completed: number
  missions_overdue: number
  xp: number
  streak: number
  checkin_energy: number | null
  commercial_score: number
  commercial_score_label: string
  status_label: string
  status_message: string
  recommended_action: { label: string; reason: string; href: string }
}

interface ProfileData {
  seller: Seller
  deals: Array<{ id: string; title: string; value: number; stage: string; probability: number; next_action_title: string | null; next_action_due_at: string | null }>
  missions: Array<{ id: string; title: string; status: string; current_value: number; target_value: number; deadline: string | null }>
  nudges: Array<{ id: string; title: string | null; message: string; created_at: string }>
  recommendations: Array<{ id: string; title: string; description: string | null; priority: string; status: string }>
}

interface ApiData {
  seller_profile: ProfileData | null
}

function currency(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function dueLabel(value: string | null) {
  if (!value) return 'Sem prazo'
  const diff = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d atrasado`
  if (diff === 0) return 'Hoje'
  return new Date(value).toLocaleDateString('pt-BR')
}

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/team/commercial-performance?period=month&seller_id=${id}`, { credentials: 'same-origin' })
        const data: ApiData & { error?: string } = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar perfil comercial')
        if (!cancelled) setProfile(data.seller_profile)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar perfil comercial')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Perfil comercial nao encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/monitoramento/equipe')}>Voltar</Button>
      </div>
    )
  }

  const seller = profile.seller
  const openDeals = profile.deals.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage))
  const riskDeals = openDeals.filter((deal) => !deal.next_action_title || (deal.next_action_due_at && new Date(deal.next_action_due_at).getTime() < Date.now()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/monitoramento/equipe')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">{initials(seller.name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Perfil comercial de {seller.name}</h1>
              <Badge variant="secondary">{seller.commercial_score_label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{seller.status_label}: {seller.status_message}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href={`/crm?owner_id=${seller.id}`} />}>Ver pipeline</Button>
          <Button render={<Link href={`/objetivos/plano-acao?seller=${seller.id}`} />}>Criar missao</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={DollarSign} label="Vendido" value={currency(seller.revenue_won)} hint={`${seller.goal_pct}% da meta`} />
        <Metric icon={LineChart} label="Forecast" value={currency(seller.forecast_weighted)} hint={`${currency(seller.open_pipeline)} pipeline`} />
        <Metric icon={Target} label="Meta" value={currency(seller.individual_goal)} hint={`gap ${currency(Math.max(0, seller.individual_goal - seller.revenue_won))}`} />
        <Metric icon={Briefcase} label="Ticket medio" value={currency(seller.avg_ticket)} hint={`${seller.won_deals_count} vendas`} />
        <Metric icon={CheckCircle2} label="Conversao" value={`${seller.conversion_rate}%`} hint={`${seller.activities_count} acoes`} />
        <Metric icon={Zap} label="Execucao" value={`${seller.kpi_execution_pct}%`} hint={`${seller.missions_completed} missoes concluidas`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Diagnostico comercial</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Score comercial {seller.commercial_score}</p>
              <p className="text-sm text-muted-foreground">{seller.recommended_action.reason}</p>
            </div>
            <Button render={<Link href={seller.recommended_action.href} />}>{seller.recommended_action.label}</Button>
          </div>
          <Progress value={seller.commercial_score} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Abertos" value={openDeals.length} />
              <MiniStat label="Em risco" value={riskDeals.length} />
              <MiniStat label="Valor em risco" value={currency(seller.pipeline_at_risk)} />
            </div>
            {openDeals.slice(0, 6).map((deal) => (
              <Link key={deal.id} href={`/crm/${deal.id}`} className="block rounded-md border p-3 hover:border-primary/40">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-medium">{deal.title}</p>
                    <p className="text-xs text-muted-foreground">{deal.next_action_title || 'Sem proxima acao'} · {dueLabel(deal.next_action_due_at)}</p>
                  </div>
                  <p className="text-sm font-semibold">{currency(Number(deal.value || 0))}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Execucao e missoes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Follow-ups" value={seller.followups_done} />
              <MiniStat label="Reunioes" value={seller.meetings_booked} />
              <MiniStat label="Propostas" value={seller.proposals_sent} />
            </div>
            {profile.missions.slice(0, 6).map((mission) => {
              const target = Number(mission.target_value || 0)
              const current = Number(mission.current_value || 0)
              const pct = target ? Math.min(100, Math.round(current / target * 100)) : current > 0 ? 100 : 0
              return (
                <div key={mission.id} className="rounded-md border p-3">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{mission.title}</p>
                    <Badge variant="outline">{mission.status}</Badge>
                  </div>
                  <Progress value={pct} className="mt-2 h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">{current}/{target || 1} · {dueLabel(mission.deadline)}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4" />Historico de nudges</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {profile.nudges.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum nudge enviado ainda.</p>
            ) : profile.nudges.slice(0, 8).map((nudge) => (
              <div key={nudge.id} className="rounded-md border p-3">
                <p className="font-medium">{nudge.title || 'Nudge do gestor'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{nudge.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(nudge.created_at).toLocaleString('pt-BR')}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" />Recomendacoes e 1:1</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {profile.recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma recomendacao aberta.</p>
            ) : profile.recommendations.slice(0, 8).map((recommendation) => (
              <div key={recommendation.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{recommendation.title}</p>
                  <Badge variant="outline">{recommendation.priority}</Badge>
                </div>
                {recommendation.description && <p className="mt-1 text-sm text-muted-foreground">{recommendation.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof DollarSign; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <Icon className="mb-3 h-4 w-4 text-primary" />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
