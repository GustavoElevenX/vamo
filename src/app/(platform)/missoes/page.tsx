'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sparkles, Rocket, ListFilter, Users, Swords } from 'lucide-react'
import { MissionCard } from '@/components/ai/mission-card'
import { AILoadingSkeleton } from '@/components/ai/loading-skeleton'
import type { AIMission } from '@/types'
import { toast } from 'sonner'

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed'

export default function MissoesPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [missions, setMissions] = useState<AIMission[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [diagnosticSessions, setDiagnosticSessions] = useState<{ id: string; respondent_name: string; health_pct: number }[]>([])
  const [teamMissions, setTeamMissions] = useState<any[]>([])

  const isManager = user?.role === 'manager' || user?.role === 'admin'

  const fetchMissions = async () => {
    const res = await fetch('/api/ai/missions')
    if (res.ok) {
      const data = await res.json()
      setMissions(data.missions ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    fetchMissions().catch(() => setLoading(false))

    if (isManager) {
      // Fetch team missions overview
      const loadTeamMissions = async () => {
        const { data } = await supabase
          .from('ai_missions')
          .select('*, users!inner(name)')
          .eq('organization_id', user.organization_id)
          .in('status', ['pending', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(20)
        setTeamMissions(data ?? [])
      }
      loadTeamMissions()

      // Fetch diagnostic sessions for generation
      const loadSessions = async () => {
        const { data } = await supabase
          .from('diagnostic_sessions')
          .select('id, respondent_name, health_pct')
          .eq('organization_id', user.organization_id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5)
        setDiagnosticSessions(data ?? [])
      }
      loadSessions()
    }
  }, [user])

  const handleGenerateMissions = async (sessionId: string) => {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate-missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar missões')
      }
      const data = await res.json()
      setMissions((prev) => [...data.missions, ...prev])
      toast.success(`${data.missions.length} missões geradas com sucesso!`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleMissionAction = async (missionId: string, action: 'start' | 'complete' | 'skip') => {
    setActionLoading(missionId)
    try {
      const res = await fetch('/api/ai/missions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId, action }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao atualizar missão')
      }

      if (action === 'complete') {
        const data = await res.json()
        toast.success(`Missão concluída! +${data.mission.xp_reward} XP`)
      }

      await fetchMissions()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (!user) return null

  const filteredMissions = filter === 'all' ? missions : missions.filter((m) => m.status === filter)

  const stats = {
    total: missions.length,
    pending: missions.filter((m) => m.status === 'pending').length,
    in_progress: missions.filter((m) => m.status === 'in_progress').length,
    completed: missions.filter((m) => m.status === 'completed').length,
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {isManager ? 'Missões & Desafios' : 'Missões Ativas'}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isManager
            ? 'Gestão de missões individuais e coletivas, com sugestões automáticas da IA'
            : 'Missões com progresso em tempo real e sugestões da IA'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendentes</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-blue-500">{stats.in_progress}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Em Andamento</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-emerald-500">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Concluídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Manager: Team missions overview */}
      {isManager && teamMissions.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Missões da Equipe</CardTitle>
              <Badge variant="secondary" className="text-[10px]">{teamMissions.length} ativas</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamMissions.slice(0, 6).map((m: any) => {
                const name = m.users?.name ?? 'Vendedor'
                const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[9px] bg-emerald-500/10 text-emerald-600">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-[10px] text-muted-foreground">{name}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        m.status === 'in_progress'
                          ? 'text-blue-500 border-blue-500/30'
                          : 'text-amber-500 border-amber-500/30'
                      }`}
                    >
                      {m.status === 'in_progress' ? 'Ativa' : 'Pendente'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager: Generate Missions */}
      {isManager && diagnosticSessions.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Gerar Novas Missões
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generating ? (
              <AILoadingSkeleton />
            ) : (
              <div>
                <p className="text-xs text-muted-foreground mb-3">
                  Selecione um diagnóstico para gerar missões personalizadas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {diagnosticSessions.map((s) => (
                    <Button
                      key={s.id}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleGenerateMissions(s.id)}
                    >
                      <Rocket className="mr-1 h-3 w-3" />
                      {s.respondent_name} ({s.health_pct}%)
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      {missions.length > 0 && (
        <div className="flex items-center gap-2">
          <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
          {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : f === 'in_progress' ? 'Em Andamento' : 'Concluídas'}
            </button>
          ))}
        </div>
      )}

      {/* Missions List */}
      {filteredMissions.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {missions.length === 0
                  ? isManager
                    ? 'Nenhuma missão gerada. Complete um diagnóstico e gere missões personalizadas.'
                    : 'Nenhuma missão atribuída. Aguarde o gestor gerar missões para você.'
                  : 'Nenhuma missão neste filtro.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredMissions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onAction={handleMissionAction}
              loading={actionLoading === mission.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
