'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Sparkles,
  Plus,
  ArrowLeft,
  Brain,
  Filter,
  Zap,
  Calendar,
  User,
  Target,
  X,
  MessageSquare,
  Loader2,
} from 'lucide-react'

type MissionArea = 'lead_generation' | 'sales_process' | 'team_management' | 'tools_technology'
type MissionStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

interface Seller {
  id: string
  name: string
}

interface Mission {
  id: string
  title: string
  description: string
  area: MissionArea
  difficulty: number
  xp_reward: number
  status: MissionStatus
  user_id: string
  seller_name: string
  created_at: string
}

const AREA_CONFIG: Record<MissionArea, { label: string; color: string }> = {
  lead_generation: { label: 'Geração de Leads', color: 'bg-emerald-500/10 text-emerald-500' },
  sales_process: { label: 'Processo de Vendas', color: 'bg-blue-500/10 text-blue-500' },
  team_management: { label: 'Gestão de Equipe', color: 'bg-amber-500/10 text-amber-500' },
  tools_technology: { label: 'Ferramentas', color: 'bg-violet-500/10 text-violet-500' },
}

const STATUS_CONFIG: Record<MissionStatus, { label: string; color: string }> = {
  pending: { label: 'Não Iniciada', color: 'text-muted-foreground' },
  in_progress: { label: 'Em Andamento', color: 'text-blue-500' },
  completed: { label: 'Concluída', color: 'text-emerald-500' },
  skipped: { label: 'Ignorada', color: 'text-red-400' },
}

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' }

export default function PlanoAcaoPage() {
  const { user } = useRequiredAuth()
  const router = useRouter()
  const supabase = createClient()

  const [missions, setMissions] = useState<Mission[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<MissionStatus | 'all'>('all')
  const [filterSeller, setFilterSeller] = useState('all')

  const [newMission, setNewMission] = useState({
    title: '',
    description: '',
    area: 'sales_process' as MissionArea,
    difficulty: 2,
    xp_reward: 100,
    user_id: '',
  })

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: missionsData }, sellersRes] = await Promise.all([
        supabase
          .from('ai_missions')
          .select('id, title, description, area, difficulty, xp_reward, status, user_id, created_at')
          .eq('organization_id', user.organization_id)
          .order('created_at', { ascending: false }),
        fetch('/api/team/sellers', { credentials: 'same-origin' }).then((r) => r.json()),
      ])

      const sellerList: Seller[] = sellersRes.sellers ?? []
      setSellers(sellerList)

      const sellerMap = Object.fromEntries(sellerList.map((s) => [s.id, s.name]))
      const mapped: Mission[] = (missionsData ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        area: m.area as MissionArea,
        difficulty: m.difficulty,
        xp_reward: m.xp_reward,
        status: m.status as MissionStatus,
        user_id: m.user_id,
        seller_name: sellerMap[m.user_id] ?? 'Gestor',
        created_at: m.created_at,
      }))

      setMissions(mapped)

      if (sellerList.length > 0 && !newMission.user_id) {
        setNewMission((p) => ({ ...p, user_id: sellerList[0].id }))
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = async () => {
    if (!newMission.title.trim() || !newMission.user_id) {
      toast.error('Nome e vendedor são obrigatórios')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/ai/chat/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'create_mission',
          params: {
            title: newMission.title,
            description: newMission.description || newMission.title,
            area: newMission.area,
            difficulty: newMission.difficulty,
            xp_reward: newMission.xp_reward,
            user_id: newMission.user_id,
          },
        }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.message)
      toast.success('Missão criada com sucesso!')
      setShowNewForm(false)
      setNewMission((p) => ({ ...p, title: '', description: '' }))
      await fetchData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar missão')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/ai/chat/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'delete_mission',
          params: { mission_id: id },
        }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.message)
      setMissions((prev) => prev.filter((m) => m.id !== id))
      toast.success('Missão removida')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover')
    } finally {
      setSaving(false)
    }
  }

  const filtered = missions.filter((m) => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false
    if (filterSeller !== 'all' && m.user_id !== filterSeller) return false
    return true
  })

  const totalXp = missions.reduce((s, m) => s + m.xp_reward, 0)

  const sellerStats = sellers.map((seller) => {
    const assigned = missions.filter((m) => m.user_id === seller.id)
    return { ...seller, xp: assigned.reduce((s, m) => s + m.xp_reward, 0), count: assigned.length }
  })

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/objetivos')} className="px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold tracking-tight">Plano de Ação</h2>
            <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-500 border-0">
              {missions.length} missões
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-10">
            Missões criadas pela VAMO IA e salvas no banco de dados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/chat-ia')}
            className="text-violet-500 border-violet-500/30 hover:bg-violet-500/10"
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Pedir à IA
          </Button>
          <Button size="sm" onClick={() => setShowNewForm(true)} className="bg-violet-500 hover:bg-violet-600 text-white">
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova Missão
          </Button>
        </div>
      </div>

      {/* Banner IA */}
      {missions.length === 0 && (
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4.5 w-4.5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Nenhuma missão criada ainda</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Peça à VAMO IA para montar o plano de ação. Exemplo: "Monte um plano de ação para minha equipe bater a meta deste mês".
                  As missões aparecem aqui automaticamente assim que forem criadas.
                </p>
                <Button
                  size="sm"
                  className="mt-3 h-7 text-xs bg-violet-500 hover:bg-violet-600 text-white"
                  onClick={() => router.push('/chat-ia')}
                >
                  <MessageSquare className="h-3 w-3 mr-1.5" />
                  Abrir Chat IA
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {missions.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as MissionStatus | 'all')}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none"
              >
                <option value="all">Todos os status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                value={filterSeller}
                onChange={(e) => setFilterSeller(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none"
              >
                <option value="all">Todos os vendedores</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Mission Form */}
      {showNewForm && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4 text-violet-500" />
                Nova Missão Manual
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)} className="px-2">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título da Missão *</Label>
                <Input
                  value={newMission.title}
                  onChange={(e) => setNewMission((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Follow-up em 24h"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vendedor *</Label>
                {sellers.length === 0 ? (
                  <div className="flex h-9 w-full items-center rounded-md border border-amber-500/40 bg-amber-500/5 px-3 text-xs text-amber-600">
                    Nenhum vendedor cadastrado
                  </div>
                ) : (
                  <select
                    value={newMission.user_id}
                    onChange={(e) => setNewMission((p) => ({ ...p, user_id: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none"
                  >
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição / Critério de conclusão</Label>
              <Input
                value={newMission.description}
                onChange={(e) => setNewMission((p) => ({ ...p, description: e.target.value }))}
                placeholder="Ex: Retornar 100% das propostas abertas em até 24h"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Área</Label>
                <select
                  value={newMission.area}
                  onChange={(e) => setNewMission((p) => ({ ...p, area: e.target.value as MissionArea }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none"
                >
                  {Object.entries(AREA_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dificuldade</Label>
                <select
                  value={newMission.difficulty}
                  onChange={(e) => setNewMission((p) => ({ ...p, difficulty: Number(e.target.value) }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none"
                >
                  <option value={1}>Fácil</option>
                  <option value={2}>Médio</option>
                  <option value={3}>Difícil</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Recompensa XP</Label>
                <Input
                  type="number"
                  value={newMission.xp_reward}
                  onChange={(e) => setNewMission((p) => ({ ...p, xp_reward: Number(e.target.value) }))}
                  min={10} max={500}
                />
              </div>
            </div>

            {sellers.length === 0 && (
              <p className="text-xs text-amber-600">
                Cadastre vendedores antes de criar missões manualmente, ou use a{' '}
                <button onClick={() => router.push('/chat-ia')} className="underline font-medium">VAMO IA</button>{' '}
                — ela cadastra o vendedor e cria a missão automaticamente.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving || sellers.length === 0} className="bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Criar Missão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mission Cards */}
      {missions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((mission) => {
            const areaConf = AREA_CONFIG[mission.area]
            const statusConf = STATUS_CONFIG[mission.status]
            return (
              <Card
                key={mission.id}
                className="border-border/50 border-violet-500/20"
              >
                <CardContent className="pt-4 pb-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium">{mission.title}</span>
                        <Badge className={`text-[9px] border-0 ${areaConf.color}`}>
                          {areaConf.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[9px] bg-violet-500/10 text-violet-500 border-0">
                          <Brain className="h-2.5 w-2.5 mr-0.5" /> VAMO IA
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{mission.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-1.5 shrink-0"
                      onClick={() => handleDelete(mission.id)}
                      disabled={saving}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {mission.seller_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(mission.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className={`font-medium ${statusConf.color}`}>{statusConf.label}</span>
                    <span className="text-muted-foreground/60">{DIFFICULTY_LABEL[mission.difficulty]}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                      <Zap className="h-3 w-3" /> {mission.xp_reward} XP
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {filtered.length === 0 && (
            <div className="col-span-2">
              <Card className="border-border/50">
                <CardContent className="py-8 text-center">
                  <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma missão com esses filtros.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* XP por vendedor */}
      {sellerStats.length > 0 && missions.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              XP por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sellerStats.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40">
                  <span className="text-sm font-medium">{s.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">{s.count} missões</span>
                    <span className="text-xs font-semibold text-amber-500">{s.xp} XP</span>
                  </div>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total em jogo</span>
              <span className="text-sm font-bold text-amber-500">{totalXp} XP</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
