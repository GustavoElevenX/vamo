'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  Building2,
  Users,
  User,
  Target,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Zap,
  DollarSign,
  Loader2,
  ListChecks,
  Flame,
} from 'lucide-react'

interface CompanyGoal {
  kpiFinanceiro: string
  valorAtual: string
  valorMeta: string
  prazo: string
  metrica: string
}

interface TeamGoal {
  kpiComportamental: string
  valorAtual: string
  valorMeta: string
  prazo: string
  medicao: 'auto_crm' | 'manual'
}

interface IndividualGoalData {
  user_id: string
  goal: string
  xp_reward?: number
  commission_bonus?: number
  status?: 'pending' | 'in_progress' | 'completed'
  progresso?: string
  completed_at?: string
}

interface ProgramGoals {
  company_goal: CompanyGoal | null
  team_goal: TeamGoal | null
  myGoal: IndividualGoalData | null
}

interface Mission {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  xp_reward: number
  commission_bonus: number
  difficulty: number
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  skipped: 'Ignorada',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-muted-foreground border-border/40',
  in_progress: 'text-blue-500 border-blue-500/30 bg-blue-500/5',
  completed: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5',
  skipped: 'text-red-400 border-red-400/30',
}

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Fácil', 2: 'Média', 3: 'Difícil' }
const DIFFICULTY_COLOR: Record<number, string> = { 1: 'text-emerald-500', 2: 'text-amber-500', 3: 'text-red-500' }

function formatDate(dateStr: string) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

function daysUntil(dateStr: string) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function DeadlineBadge({ prazo }: { prazo: string }) {
  const days = daysUntil(prazo)
  if (days === null) return null
  if (days < 0) return <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30 bg-red-500/5">Encerrado</Badge>
  if (days <= 7) return <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/5">{days}d restantes</Badge>
  return <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/5">{days}d restantes</Badge>
}

function GoalProgressBar({ valorAtual, valorMeta }: { valorAtual: string; valorMeta: string }) {
  const parseNum = (v: string) => parseFloat(v.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
  const current = parseNum(valorAtual)
  const target = parseNum(valorMeta)
  if (!target) return null
  const pct = Math.min(100, Math.round((current / target) * 100))
  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Atual: <strong className="text-foreground">{valorAtual}</strong></span>
        <span>Meta: <strong className="text-foreground">{valorMeta}</strong></span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <p className="text-[10px] text-muted-foreground text-right">{pct}% concluído</p>
    </div>
  )
}

function RewardBadges({ xpReward, commissionBonus }: { xpReward?: number; commissionBonus?: number }) {
  if (!xpReward && !commissionBonus) return null
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {!!xpReward && (
        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 rounded-full px-2 py-0.5">
          <Zap className="h-2.5 w-2.5" />{xpReward} XP
        </span>
      )}
      {!!commissionBonus && (
        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-500/10 rounded-full px-2 py-0.5">
          <DollarSign className="h-2.5 w-2.5" />R$ {commissionBonus} bônus
        </span>
      )}
    </div>
  )
}

export default function MinhasMetasPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [goals, setGoals] = useState<ProgramGoals | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingGoal, setUpdatingGoal] = useState(false)
  const [updatingMission, setUpdatingMission] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: pgRow }, missionsRes] = await Promise.all([
        supabase
          .from('program_goals')
          .select('company_goal, team_goal, individual_goals')
          .eq('organization_id', user.organization_id)
          .maybeSingle(),
        fetch('/api/ai/missions', { credentials: 'same-origin' }).then((r) => r.json()),
      ])

      if (pgRow) {
        const allIndividual = (pgRow.individual_goals as IndividualGoalData[]) ?? []
        setGoals({
          company_goal: (pgRow.company_goal as CompanyGoal) ?? null,
          team_goal: (pgRow.team_goal as TeamGoal) ?? null,
          myGoal: allIndividual.find((g) => g.user_id === user.id) ?? null,
        })
      }

      setMissions((missionsRes.missions ?? []) as Mission[])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  const updateGoalStatus = async (status: 'pending' | 'in_progress' | 'completed') => {
    setUpdatingGoal(true)
    try {
      const res = await fetch('/api/goals/my-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGoals((prev) => prev ? {
        ...prev,
        myGoal: prev.myGoal ? { ...prev.myGoal, status } : prev.myGoal,
      } : prev)
      toast.success(status === 'completed' ? 'Meta concluída! Parabéns!' : 'Status da meta atualizado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar meta')
    } finally {
      setUpdatingGoal(false)
    }
  }

  const updateMissionStatus = async (missionId: string, action: 'start' | 'complete' | 'skip') => {
    setUpdatingMission(missionId)
    try {
      const res = await fetch('/api/ai/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ missionId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newStatus = action === 'complete' ? 'completed' : action === 'start' ? 'in_progress' : 'skipped'
      setMissions((prev) => prev.map((m) => m.id === missionId ? { ...m, status: newStatus } : m))
      if (action === 'complete') toast.success(`Missão concluída! +${missions.find(m => m.id === missionId)?.xp_reward ?? 0} XP`)
      else toast.success('Status da missão atualizado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar missão')
    } finally {
      setUpdatingMission(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const activeMissions = missions.filter((m) => m.status !== 'completed' && m.status !== 'skipped')
  const completedMissions = missions.filter((m) => m.status === 'completed')
  const hasAnyContent = goals?.myGoal || goals?.team_goal?.kpiComportamental || goals?.company_goal?.kpiFinanceiro || missions.length > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Minhas Metas</h2>
            <p className="text-sm text-muted-foreground">Metas e missões do programa</p>
          </div>
        </div>
      </div>

      {!hasAnyContent ? (
        <Card className="border-border/50">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma meta ou missão definida ainda</p>
            <p className="text-xs text-muted-foreground/70 max-w-xs">
              Aguarde seu gestor definir as metas do programa. Você será notificado assim que estiverem disponíveis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Minha Meta Individual */}
          {goals?.myGoal && (
            <Card className={`border-amber-500/30 ${goals.myGoal.status === 'completed' ? 'bg-emerald-500/5' : 'bg-amber-500/5'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${goals.myGoal.status === 'completed' ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                      <User className={`h-3.5 w-3.5 ${goals.myGoal.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">Minha Meta Individual</CardTitle>
                      <p className="text-[10px] text-muted-foreground">Definida especialmente para você</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[goals.myGoal.status ?? 'pending']}`}>
                    {STATUS_LABELS[goals.myGoal.status ?? 'pending']}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{goals.myGoal.goal}</p>
                <RewardBadges xpReward={goals.myGoal.xp_reward} commissionBonus={goals.myGoal.commission_bonus} />

                {/* Status action buttons */}
                {goals.myGoal.status !== 'completed' && (
                  <div className="flex gap-2 pt-1">
                    {(goals.myGoal.status === 'pending' || !goals.myGoal.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 border-blue-500/40 text-blue-500 hover:bg-blue-500/10"
                        disabled={updatingGoal}
                        onClick={() => updateGoalStatus('in_progress')}
                      >
                        {updatingGoal ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                        Iniciar
                      </Button>
                    )}
                    {goals.myGoal.status === 'in_progress' && (
                      <Button
                        size="sm"
                        className="text-xs h-7 bg-emerald-500 hover:bg-emerald-600 text-white"
                        disabled={updatingGoal}
                        onClick={() => updateGoalStatus('completed')}
                      >
                        {updatingGoal ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Marcar como concluída
                      </Button>
                    )}
                  </div>
                )}

                {goals.myGoal.status === 'completed' && goals.myGoal.completed_at && (
                  <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Concluída em {formatDate(goals.myGoal.completed_at)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Missões Ativas */}
          {activeMissions.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ListChecks className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-medium">Missões Ativas</CardTitle>
                    <p className="text-[10px] text-muted-foreground">{activeMissions.length} missão(ões) pendente(s)</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeMissions.map((mission) => (
                  <div key={mission.id} className="p-3 rounded-lg border border-border/40 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{mission.title}</p>
                          <span className={`text-[10px] font-medium ${DIFFICULTY_COLOR[mission.difficulty] ?? 'text-muted-foreground'}`}>
                            {DIFFICULTY_LABEL[mission.difficulty] ?? ''}
                          </span>
                        </div>
                        {mission.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mission.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[mission.status]}`}>
                        {STATUS_LABELS[mission.status]}
                      </Badge>
                    </div>
                    <RewardBadges xpReward={mission.xp_reward} commissionBonus={mission.commission_bonus} />
                    <div className="flex gap-2">
                      {mission.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-blue-500/40 text-blue-500 hover:bg-blue-500/10"
                          disabled={updatingMission === mission.id}
                          onClick={() => updateMissionStatus(mission.id, 'start')}
                        >
                          {updatingMission === mission.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                          Iniciar
                        </Button>
                      )}
                      {(mission.status === 'pending' || mission.status === 'in_progress') && (
                        <Button
                          size="sm"
                          className="text-xs h-7 bg-emerald-500 hover:bg-emerald-600 text-white"
                          disabled={updatingMission === mission.id}
                          onClick={() => updateMissionStatus(mission.id, 'complete')}
                        >
                          {updatingMission === mission.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                          Concluir
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Meta do Time */}
          {goals?.team_goal?.kpiComportamental && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Users className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">Meta do Time</CardTitle>
                      <p className="text-[10px] text-muted-foreground">KPI comportamental coletivo</p>
                    </div>
                  </div>
                  {goals.team_goal.prazo && <DeadlineBadge prazo={goals.team_goal.prazo} />}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                  <p className="text-sm font-medium">{goals.team_goal.kpiComportamental}</p>
                </div>
                {goals.team_goal.prazo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Prazo: {formatDate(goals.team_goal.prazo)}</span>
                  </div>
                )}
                {goals.team_goal.medicao && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Medição: {goals.team_goal.medicao === 'auto_crm' ? 'Automático (CRM)' : 'Manual'}</span>
                  </div>
                )}
                {goals.team_goal.valorAtual && goals.team_goal.valorMeta && (
                  <GoalProgressBar valorAtual={goals.team_goal.valorAtual} valorMeta={goals.team_goal.valorMeta} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Meta da Empresa */}
          {goals?.company_goal?.kpiFinanceiro && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Building2 className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium">Meta da Empresa</CardTitle>
                      <p className="text-[10px] text-muted-foreground">KPI financeiro principal</p>
                    </div>
                  </div>
                  {goals.company_goal.prazo && <DeadlineBadge prazo={goals.company_goal.prazo} />}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <p className="text-sm font-medium">{goals.company_goal.kpiFinanceiro}</p>
                </div>
                {goals.company_goal.prazo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Prazo: {formatDate(goals.company_goal.prazo)}</span>
                  </div>
                )}
                {goals.company_goal.metrica && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>Métrica: {goals.company_goal.metrica}</span>
                  </div>
                )}
                {goals.company_goal.valorAtual && goals.company_goal.valorMeta && (
                  <GoalProgressBar valorAtual={goals.company_goal.valorAtual} valorMeta={goals.company_goal.valorMeta} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Missões concluídas (collapsible summary) */}
          {completedMissions.length > 0 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-600">
                    {completedMissions.length} missão(ões) concluída(s)
                  </p>
                  <span className="text-xs text-muted-foreground ml-auto">
                    +{completedMissions.reduce((s, m) => s + (m.xp_reward ?? 0), 0)} XP total
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
