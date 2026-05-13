'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Clock, Play, Swords, Target, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'

type Mission = {
  id: string
  title: string
  description: string | null
  status: string
  xp_reward: number
  difficulty: number
  deadline: string | null
  type: string | null
  target_value: number
  current_value: number
  verification_type: 'automatic' | 'manual' | 'hybrid'
  progressPct: number
  missingValue: number
  validationLabel: string
  primaryCta: string
  kpi?: { id: string; name: string; unit: string | null; source_event: string | null } | null
  pdi_plan_id?: string | null
  pdi_plan?: { id: string; title: string | null; status: string | null } | null
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-blue-500/10 text-blue-600 border-0' },
  in_progress: { label: 'Em andamento', className: 'bg-amber-500/10 text-amber-600 border-0' },
  awaiting_approval: { label: 'Aguardando aprovação', className: 'bg-violet-500/10 text-violet-600 border-0' },
  completed: { label: 'Concluida', className: 'bg-emerald-500/10 text-emerald-600 border-0' },
  rejected: { label: 'Revisar evidência', className: 'bg-red-500/10 text-red-600 border-0' },
  expired: { label: 'Expirada', className: 'bg-muted text-muted-foreground border-0' },
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return 'Sem prazo'
  const date = new Date(deadline)
  const diffMs = date.getTime() - Date.now()
  if (diffMs < 0) return 'Prazo vencido'
  const days = Math.ceil(diffMs / 86400000)
  if (days <= 1) return 'Vence hoje'
  return `Vence em ${days} dias`
}

export default function MissoesPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const loadMissions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/missions/my', { credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar missões')
      setMissions(data.missions ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar missões')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMissions()
  }, [loadMissions])

  const grouped = useMemo(() => ({
    active: missions.filter((m) => ['pending', 'in_progress', 'rejected'].includes(m.status)),
    waiting: missions.filter((m) => m.status === 'awaiting_approval'),
    done: missions.filter((m) => ['completed', 'expired'].includes(m.status)),
  }), [missions])

  const patchMission = async (missionId: string, action: 'start' | 'complete') => {
    setBusy(missionId)
    try {
      const res = await fetch('/api/ai/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ missionId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar missão')
      toast.success(action === 'start' ? 'Missão iniciada' : 'Validação solicitada')
      await loadMissions()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar missão')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const renderMission = (mission: Mission) => {
    const status = STATUS_STYLE[mission.status] ?? STATUS_STYLE.pending
    const target = Number(mission.target_value || 0)
    const current = Number(mission.current_value || 0)
    const unit = mission.kpi?.unit || 'unid.'
    const isBusy = busy === mission.id
    const canStart = mission.status === 'pending'
    const canRequestApproval = ['pending', 'in_progress', 'rejected'].includes(mission.status) && ['manual', 'hybrid'].includes(mission.verification_type)

    return (
      <Card key={mission.id} className="border-border/50">
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{mission.title}</h2>
                <Badge className={status.className}>{status.label}</Badge>
                <Badge variant="outline">{mission.validationLabel}</Badge>
                {mission.pdi_plan && <Badge className="bg-blue-500/10 text-blue-600 border-0">Missão de PDI</Badge>}
              </div>
              {mission.description && <p className="mt-1 text-xs text-muted-foreground">{mission.description}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-amber-600">+{mission.xp_reward} XP</p>
              <p className="text-[11px] text-muted-foreground">{deadlineLabel(mission.deadline)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Indicador</p>
              <p className="text-sm font-medium">{mission.kpi?.name || mission.type || 'Missão manual'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Progresso</p>
              <p className="text-sm font-medium">{current.toLocaleString('pt-BR')} / {target.toLocaleString('pt-BR')} {unit}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faltam</p>
              <p className="text-sm font-medium">{Number(mission.missingValue || 0).toLocaleString('pt-BR')} {unit}</p>
            </div>
          </div>

          {mission.pdi_plan && (
            <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">Missão de PDI:</strong> Esta missão faz parte do seu PDI de {mission.pdi_plan.title || 'desenvolvimento'}.
              </p>
              <p>
                Ela e a aplicação prática do treino. Concluir a missão ajuda a evoluir o plano, mas a validação final depende do gestor quando houver aprovação humana.
              </p>
              <Button size="sm" variant="outline" render={<Link href="/desenvolvimento/pdi" />}>
                Abrir PDI
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Progress value={mission.progressPct} className="h-2" />
            <span className="w-12 text-right text-xs text-muted-foreground">{mission.progressPct}%</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {canStart && (
              <Button size="sm" onClick={() => patchMission(mission.id, 'start')} disabled={isBusy}>
                <Play className="mr-2 h-4 w-4" />
                Iniciar
              </Button>
            )}
            {canRequestApproval && (
              <Button size="sm" variant="outline" onClick={() => patchMission(mission.id, 'complete')} disabled={isBusy}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Solicitar validação
              </Button>
            )}
            {mission.status !== 'completed' && mission.status !== 'awaiting_approval' && (
              <Button size="sm" variant="outline" render={<Link href="/kpis/registrar" />}>
                <Target className="mr-2 h-4 w-4" />
                Registrar ação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        label="Desempenho"
        labelIcon={<Swords className="h-3 w-3" />}
        title={<>Missões <TitleHighlight>de Execução</TitleHighlight></>}
        description={missions.length ? `${missions.length} missoes com progresso real` : 'Nenhuma missão ativa no momento'}
      />

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Missão executa.</strong> Missões transformam metas e gaps em ações práticas para executar. Algumas sao validadas automaticamente; outras precisam de aprovação do gestor.
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Em execução</p><p className="text-2xl font-semibold">{grouped.active.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Aguardando gestor</p><p className="text-2xl font-semibold">{grouped.waiting.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Concluídas/encerradas</p><p className="text-2xl font-semibold">{grouped.done.length}</p></CardContent></Card>
      </div>

      {grouped.waiting.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            Aguardando aprovação
          </h2>
          {grouped.waiting.map(renderMission)}
        </div>
      )}

      {grouped.active.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Zap className="h-4 w-4" />
            Para executar
          </h2>
          {grouped.active.map(renderMission)}
        </div>
      )}

      {missions.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma missão encontrada.</p>
            <Button className="mt-3" size="sm" render={<Link href="/kpis/registrar" />}>Registrar ação comercial</Button>
          </CardContent>
        </Card>
      )}

      {grouped.done.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Histórico recente
          </h2>
          {grouped.done.slice(0, 8).map(renderMission)}
        </div>
      )}
    </div>
  )
}
