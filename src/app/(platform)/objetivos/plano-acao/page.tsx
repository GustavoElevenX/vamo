'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Clock, Filter, Plus, Target, User, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

type Seller = { id: string; name: string }
type Kpi = { id: string; name: string; unit: string; sourceEvent: string | null }
type Mission = {
  id: string
  title: string
  description: string | null
  status: string
  user_id: string
  xp_reward: number
  target_value: number
  current_value: number
  deadline: string | null
  verification_type: string
  type: string
  user?: { id: string; name: string } | null
  kpi?: { id: string; name: string; unit: string | null; source_event: string | null } | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  awaiting_approval: 'Aguardando aprovacao',
  completed: 'Concluida',
  rejected: 'Rejeitada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  skipped: 'Ignorada',
}

type MissionManagementVariant = 'goals' | 'team'

function isMissionOverdue(mission: Pick<Mission, 'deadline' | 'status'>) {
  return Boolean(
    mission.deadline &&
      !['completed', 'expired', 'cancelled', 'skipped'].includes(mission.status) &&
      new Date(mission.deadline).getTime() < Date.now(),
  )
}

function executionRate(missions: Mission[]) {
  const considered = missions.filter((mission) => !['cancelled', 'skipped'].includes(mission.status))
  if (considered.length === 0) return 0
  return Math.round((considered.filter((mission) => mission.status === 'completed').length / considered.length) * 100)
}

export function MissionManagementPage({ variant = 'goals' }: { variant?: MissionManagementVariant }) {
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[]>([])
  const [approvals, setApprovals] = useState<Mission[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeller, setFilterSeller] = useState('all')
  const [form, setForm] = useState({
    title: '',
    description: '',
    userId: '',
    type: 'kpi_target',
    kpiId: '',
    sourceEvent: '',
    targetValue: '3',
    deadline: '',
    verificationType: 'automatic',
    xpReward: '100',
    difficulty: '2',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const approvalsRequest = variant === 'team'
        ? fetch('/api/missions/approvals', { credentials: 'same-origin' }).then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        : Promise.resolve({ ok: true, data: { approvals: [] } })

      const [missionsRes, sellersRes, kpisRes, approvalsRes] = await Promise.all([
        fetch('/api/missions', { credentials: 'same-origin' }).then((res) => res.json().then((data) => ({ ok: res.ok, data }))),
        fetch('/api/team/sellers', { credentials: 'same-origin' }).then((res) => res.json().then((data) => ({ ok: res.ok, data }))),
        fetch('/api/kpis', { credentials: 'same-origin' }).then((res) => res.json().then((data) => ({ ok: res.ok, data }))),
        approvalsRequest,
      ])
      if (!missionsRes.ok) throw new Error(missionsRes.data.error || 'Erro ao carregar missoes')
      if (!sellersRes.ok) throw new Error(sellersRes.data.error || 'Erro ao carregar vendedores')
      if (!kpisRes.ok) throw new Error(kpisRes.data.error || 'Erro ao carregar indicadores')
      if (!approvalsRes.ok) throw new Error(approvalsRes.data.error || 'Erro ao carregar aprovacoes')

      const sellerList = sellersRes.data.sellers ?? []
      const kpiList = (kpisRes.data.kpis ?? []) as Kpi[]
      setMissions(missionsRes.data.missions ?? [])
      setApprovals(approvalsRes.data.approvals ?? [])
      setSellers(sellerList)
      setKpis(kpiList)
      setForm((prev) => ({
        ...prev,
        userId: prev.userId || sellerList[0]?.id || '',
        kpiId: prev.kpiId || kpiList[0]?.id || '',
        sourceEvent: prev.sourceEvent || kpiList[0]?.sourceEvent || 'crm_activity_follow_up',
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar plano')
    } finally {
      setLoading(false)
    }
  }, [variant])

  useEffect(() => {
    loadData()
  }, [loadData])

  const selectedKpi = kpis.find((kpi) => kpi.id === form.kpiId)
  const isTeamView = variant === 'team'
  const backHref = isTeamView ? '/monitoramento' : '/objetivos'
  const pageTitle = isTeamView ? 'Missões da Equipe' : 'Plano de acao'
  const pageDescription = isTeamView
    ? 'Acompanhe, filtre, aprove e crie missões reais para os vendedores do time.'
    : 'Crie missoes verificaveis por KPI, evento, prazo e validacao.'
  const createTitle = isTeamView ? 'Nova missao operacional' : 'Nova missao para vendedor'

  const filtered = useMemo(() => missions.filter((mission) => {
    if (filterStatus !== 'all' && mission.status !== filterStatus) return false
    if (filterSeller !== 'all' && mission.user_id !== filterSeller) return false
    return true
  }), [missions, filterSeller, filterStatus])

  const summary = useMemo(() => {
    const awaiting = approvals.length || missions.filter((mission) => mission.status === 'awaiting_approval').length
    return {
      active: missions.filter((mission) => ['pending', 'in_progress', 'rejected'].includes(mission.status)).length,
      awaiting,
      overdue: missions.filter(isMissionOverdue).length,
      completed: missions.filter((mission) => mission.status === 'completed').length,
      execution: executionRate(missions),
    }
  }, [approvals.length, missions])

  const createMission = async () => {
    if (!form.title.trim() || !form.userId) {
      toast.error('Titulo e vendedor sao obrigatorios')
      return
    }

    setSaving(true)
    try {
      const criteria = {
        type: form.type,
        target_value: Number(form.targetValue || 0),
        source_event: selectedKpi?.sourceEvent || form.sourceEvent || null,
        kpi_id: form.kpiId || null,
      }

      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          userId: form.userId,
          type: form.type,
          kpiId: form.kpiId || null,
          sourceEvent: selectedKpi?.sourceEvent || form.sourceEvent,
          targetValue: form.targetValue,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
          verificationType: form.verificationType,
          xpReward: form.xpReward,
          difficulty: form.difficulty,
          criteria,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar missao')

      toast.success('Missao criada')
      setForm((prev) => ({ ...prev, title: '', description: '' }))
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar missao')
    } finally {
      setSaving(false)
    }
  }

  const approve = async (missionId: string, approveMission: boolean) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/missions/${missionId}/${approveMission ? 'approve' : 'reject'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reason: approveMission ? undefined : 'Evidencia insuficiente' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao revisar missao')
      toast.success(approveMission ? 'Missao aprovada' : 'Missao rejeitada')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao revisar missao')
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(backHref)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{pageDescription}</p>
          </div>
        </div>
        <Badge variant="secondary">{missions.length} missoes</Badge>
      </div>

      {isTeamView && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Zap className="h-3.5 w-3.5" />Ativas</p>
              <p className="mt-1 text-2xl font-semibold">{summary.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Aguardando aprovacao</p>
              <p className="mt-1 text-2xl font-semibold">{summary.awaiting}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />Atrasadas</p>
              <p className="mt-1 text-2xl font-semibold">{summary.overdue}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" />Concluidas</p>
              <p className="mt-1 text-2xl font-semibold">{summary.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" />Taxa de execucao</p>
              <p className="mt-1 text-2xl font-semibold">{summary.execution}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isTeamView && approvals.length > 0 && (
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              Missoes aguardando aprovacao
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {approvals.map((mission) => (
              <div key={mission.id} className="rounded-lg border border-amber-500/20 bg-background/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{mission.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{mission.user?.name || 'Vendedor'} - {mission.kpi?.name || mission.type}</p>
                  </div>
                  <Badge variant="outline">+{mission.xp_reward} XP</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => approve(mission.id, true)} disabled={saving}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => approve(mission.id, false)} disabled={saving}>Reprovar</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />
            {createTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Titulo</Label>
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Realizar 5 follow-ups com proximas acoes" />
            </div>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={form.userId} onValueChange={(value) => value && setForm({ ...form, userId: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Explique a entrega esperada e o criterio de sucesso." />

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(value) => value && setForm({ ...form, type: value, verificationType: value === 'manual_validation' ? 'manual' : form.verificationType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kpi_target">Meta de KPI</SelectItem>
                  <SelectItem value="pipeline_cleanup">Limpeza de pipeline</SelectItem>
                  <SelectItem value="revenue_target">Receita/fechamento</SelectItem>
                  <SelectItem value="manual_validation">Validacao manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Indicador</Label>
              <Select value={form.kpiId} onValueChange={(value) => {
                if (!value) return
                const kpi = kpis.find((item) => item.id === value)
                setForm({ ...form, kpiId: value, sourceEvent: kpi?.sourceEvent || form.sourceEvent })
              }}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {kpis.map((kpi) => <SelectItem key={kpi.id} value={kpi.id}>{kpi.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meta</Label>
              <Input type="number" min="0" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>XP</Label>
              <Input type="number" min="0" value={form.xpReward} onChange={(event) => setForm({ ...form, xpReward: event.target.value })} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Evento de origem</Label>
              <Input value={form.sourceEvent} onChange={(event) => setForm({ ...form, sourceEvent: event.target.value })} placeholder="crm_activity_follow_up" />
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="datetime-local" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Validacao</Label>
              <Select value={form.verificationType} onValueChange={(value) => value && setForm({ ...form, verificationType: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automatica</SelectItem>
                  <SelectItem value="hybrid">Automatica + gestor</SelectItem>
                  <SelectItem value="manual">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={createMission} disabled={saving || sellers.length === 0}>
            {saving ? 'Criando...' : 'Criar missao'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={(value) => value && setFilterStatus(value)}>
            <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSeller} onValueChange={(value) => value && setFilterSeller(value)}>
            <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {sellers.map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((mission) => {
          const target = Number(mission.target_value || 0)
          const current = Number(mission.current_value || 0)
          const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : current > 0 ? 100 : 0
          return (
            <Card key={mission.id}>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{mission.title}</h2>
                      <Badge variant="secondary">{STATUS_LABEL[mission.status] || mission.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{mission.description || 'Sem descricao.'}</p>
                  </div>
                  <p className="text-sm font-semibold text-amber-600">+{mission.xp_reward} XP</p>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <span className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /> {mission.user?.name || 'Vendedor'}</span>
                  <span className="flex items-center gap-2 text-muted-foreground"><Target className="h-4 w-4" /> {mission.kpi?.name || mission.type}</span>
                  <span className="flex items-center gap-2 text-muted-foreground"><Zap className="h-4 w-4" /> {mission.verification_type}</span>
                  <span className="text-muted-foreground">{mission.deadline ? new Date(mission.deadline).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Progress value={pct} className="h-2" />
                  <span className="w-12 text-right text-xs text-muted-foreground">{pct}%</span>
                </div>

                {mission.status === 'awaiting_approval' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(mission.id, true)} disabled={saving}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => approve(mission.id, false)} disabled={saving}>Reprovar</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma missao com esses filtros.</CardContent>
        </Card>
      )}
    </div>
  )
}

export default function PlanoAcaoPage() {
  return <MissionManagementPage />
}
