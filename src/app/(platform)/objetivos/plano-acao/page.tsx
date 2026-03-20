'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  Plus,
  ArrowLeft,
  Brain,
  Filter,
  Zap,
  DollarSign,
  Award,
  Calendar,
  User,
  Target,
  Link2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

type MissionType = 'atividade' | 'habilidade' | 'resultado' | 'habito' | 'coletiva' | 'colaboracao'
type MissionStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'expirada'

interface Mission {
  id: string
  name: string
  type: MissionType
  assignee: string
  completionCriteria: string
  criteriaMode: 'auto_crm' | 'manual'
  deadline: string
  xp: number
  bonus: number
  badge: string
  linkRecurso: string
  isAiSuggested: boolean
  aiJustification?: string
  status: MissionStatus
}

const TYPE_CONFIG: Record<MissionType, { label: string; color: string }> = {
  atividade: { label: 'Atividade', color: 'bg-blue-500/10 text-blue-500' },
  habilidade: { label: 'Habilidade', color: 'bg-violet-500/10 text-violet-500' },
  resultado: { label: 'Resultado', color: 'bg-emerald-500/10 text-emerald-500' },
  habito: { label: 'Hábito', color: 'bg-amber-500/10 text-amber-500' },
  coletiva: { label: 'Coletiva', color: 'bg-pink-500/10 text-pink-500' },
  colaboracao: { label: 'Colaboração', color: 'bg-cyan-500/10 text-cyan-500' },
}

const STATUS_CONFIG: Record<MissionStatus, { label: string; color: string }> = {
  nao_iniciada: { label: 'Não Iniciada', color: 'text-muted-foreground' },
  em_andamento: { label: 'Em Andamento', color: 'text-blue-500' },
  concluida: { label: 'Concluída', color: 'text-emerald-500' },
  expirada: { label: 'Expirada', color: 'text-red-500' },
}

const MOCK_COLLABORATORS = ['Todos', 'Carlos Silva', 'Ana Souza', 'Pedro Santos', 'Mariana Lima']

const INITIAL_MISSIONS: Mission[] = [
  {
    id: '1',
    name: 'Follow-up em 24h',
    type: 'atividade',
    assignee: 'Todos',
    completionCriteria: 'Retornar 100% das propostas abertas em até 24h',
    criteriaMode: 'auto_crm',
    deadline: '2026-04-18',
    xp: 150,
    bonus: 225,
    badge: 'Velocista',
    linkRecurso: '',
    isAiSuggested: true,
    aiJustification: 'Diagnóstico mostrou tempo médio de follow-up de 72h — reduzir para 24h aumenta conversão em 35%.',
    status: 'nao_iniciada',
  },
  {
    id: '2',
    name: 'Prospecção Ativa',
    type: 'resultado',
    assignee: 'Todos',
    completionCriteria: '5 novos contatos qualificados por dia',
    criteriaMode: 'manual',
    deadline: '2026-04-18',
    xp: 200,
    bonus: 300,
    badge: 'Caçador',
    linkRecurso: '',
    isAiSuggested: true,
    aiJustification: 'Pipeline está 40% abaixo do necessário. 5 contatos/dia repõe o funil em 15 dias.',
    status: 'nao_iniciada',
  },
  {
    id: '3',
    name: 'CRM 100% Atualizado',
    type: 'habito',
    assignee: 'Todos',
    completionCriteria: 'Atualizar todos os contatos no CRM diariamente',
    criteriaMode: 'auto_crm',
    deadline: '2026-04-18',
    xp: 100,
    bonus: 150,
    badge: 'Organizado',
    linkRecurso: '',
    isAiSuggested: true,
    aiJustification: 'Apenas 55% do time atualiza o CRM diariamente. Meta: 100% para visibilidade de pipeline.',
    status: 'nao_iniciada',
  },
  {
    id: '4',
    name: 'Taxa de Conversão +10%',
    type: 'resultado',
    assignee: 'Todos',
    completionCriteria: 'Aumentar conversão de propostas em 10% no mês',
    criteriaMode: 'auto_crm',
    deadline: '2026-04-18',
    xp: 500,
    bonus: 750,
    badge: 'Closer',
    linkRecurso: '',
    isAiSuggested: true,
    aiJustification: 'Conversão atual é 44%. Meta de 52% é realista e alinhada ao benchmark do setor (62%).',
    status: 'nao_iniciada',
  },
]

const EMPTY_MISSION: Omit<Mission, 'id'> = {
  name: '',
  type: 'atividade',
  assignee: 'Todos',
  completionCriteria: '',
  criteriaMode: 'auto_crm',
  deadline: '',
  xp: 100,
  bonus: 0,
  badge: '',
  linkRecurso: '',
  isAiSuggested: false,
  status: 'nao_iniciada',
}

export default function PlanoAcaoPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS)
  const [filterType, setFilterType] = useState<MissionType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<MissionStatus | 'all'>('all')
  const [filterCollaborator, setFilterCollaborator] = useState('Todos')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newMission, setNewMission] = useState(EMPTY_MISSION)

  if (!user) return null

  const filteredMissions = missions.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false
    if (filterStatus !== 'all' && m.status !== filterStatus) return false
    if (filterCollaborator !== 'Todos' && m.assignee !== 'Todos' && m.assignee !== filterCollaborator) return false
    return true
  })

  const totalXp = missions.reduce((sum, m) => sum + m.xp, 0)
  const totalBonus = missions.reduce((sum, m) => sum + m.bonus, 0)

  const handleAddMission = () => {
    if (!newMission.name.trim()) {
      toast.error('Nome da missão é obrigatório')
      return
    }
    const mission: Mission = {
      ...newMission,
      id: Date.now().toString(),
    }
    setMissions((prev) => [...prev, mission])
    setNewMission(EMPTY_MISSION)
    setShowNewForm(false)
    toast.success('Missão criada com sucesso!')
  }

  const handleRemoveMission = (id: string) => {
    setMissions((prev) => prev.filter((m) => m.id !== id))
  }

  // Per-collaborator XP/bonus panel
  const collaboratorStats = MOCK_COLLABORATORS.filter((c) => c !== 'Todos').map((name) => {
    const assigned = missions.filter((m) => m.assignee === 'Todos' || m.assignee === name)
    return {
      name,
      xp: assigned.reduce((s, m) => s + m.xp, 0),
      bonus: assigned.reduce((s, m) => s + m.bonus, 0),
    }
  })

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
              Etapa 2
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-10">
            Central de missões gamificadas para o time
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNewForm(true)} className="bg-violet-500 hover:bg-violet-600 text-white">
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova Missão
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as MissionType | 'all')}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Todos os tipos</option>
              {Object.entries(TYPE_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as MissionStatus | 'all')}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Todos os status</option>
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <select
              value={filterCollaborator}
              onChange={(e) => setFilterCollaborator(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {MOCK_COLLABORATORS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* New Mission Form */}
      {showNewForm && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4 text-violet-500" />
                Nova Missão
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)} className="px-2">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Nome da Missão</Label>
                <Input
                  value={newMission.name}
                  onChange={(e) => setNewMission((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Follow-up em 24h"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tipo</Label>
                <select
                  value={newMission.type}
                  onChange={(e) => setNewMission((p) => ({ ...p, type: e.target.value as MissionType }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {Object.entries(TYPE_CONFIG).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Atribuição</Label>
                <select
                  value={newMission.assignee}
                  onChange={(e) => setNewMission((p) => ({ ...p, assignee: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {MOCK_COLLABORATORS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Critério de Conclusão</Label>
                <select
                  value={newMission.criteriaMode}
                  onChange={(e) => setNewMission((p) => ({ ...p, criteriaMode: e.target.value as 'auto_crm' | 'manual' }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="auto_crm">Automático (CRM)</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Descrição do Critério</Label>
              <Input
                value={newMission.completionCriteria}
                onChange={(e) => setNewMission((p) => ({ ...p, completionCriteria: e.target.value }))}
                placeholder="Ex: Retornar 100% das propostas abertas em 24h"
              />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Prazo</Label>
                <Input
                  type="date"
                  value={newMission.deadline}
                  onChange={(e) => setNewMission((p) => ({ ...p, deadline: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">XP</Label>
                <Input
                  type="number"
                  value={newMission.xp}
                  onChange={(e) => setNewMission((p) => ({ ...p, xp: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Bônus R$</Label>
                <Input
                  type="number"
                  value={newMission.bonus}
                  onChange={(e) => setNewMission((p) => ({ ...p, bonus: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Badge</Label>
                <Input
                  value={newMission.badge}
                  onChange={(e) => setNewMission((p) => ({ ...p, badge: e.target.value }))}
                  placeholder="Ex: Closer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Link Recurso (opcional)</Label>
              <Input
                value={newMission.linkRecurso}
                onChange={(e) => setNewMission((p) => ({ ...p, linkRecurso: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500 mb-1">
                O vendedor verá:
              </p>
              <p className="text-xs text-muted-foreground">
                Complete <strong className="text-foreground">{newMission.name || '...'}</strong> em{' '}
                <strong className="text-foreground">{newMission.deadline ? new Date(newMission.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : '...'}</strong> e ganhe{' '}
                <strong className="text-amber-500">+{newMission.xp} XP</strong>
                {newMission.bonus > 0 && <> + <strong className="text-emerald-500">R$ {newMission.bonus}</strong></>}
                {newMission.badge && <> + Badge <strong className="text-violet-500">{newMission.badge}</strong></>}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewForm(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleAddMission} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                Criar Missão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mission Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredMissions.map((mission) => {
          const typeConf = TYPE_CONFIG[mission.type]
          const statusConf = STATUS_CONFIG[mission.status]
          return (
            <Card
              key={mission.id}
              className={`border-border/50 transition-all ${
                mission.isAiSuggested ? 'border-violet-500/30' : ''
              }`}
            >
              <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium">{mission.name}</span>
                      <Badge className={`text-[9px] border-0 ${typeConf.color}`}>
                        {typeConf.label}
                      </Badge>
                      {mission.isAiSuggested && (
                        <Badge variant="secondary" className="text-[9px] bg-violet-500/10 text-violet-500 border-0">
                          <Brain className="h-2.5 w-2.5 mr-0.5" /> IA
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{mission.completionCriteria}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="px-1.5 shrink-0" onClick={() => handleRemoveMission(mission.id)}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {mission.assignee}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {mission.deadline ? new Date(mission.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                  </span>
                  <span className={`flex items-center gap-1 ${statusConf.color}`}>
                    {statusConf.label}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> {mission.xp} XP
                  </span>
                  {mission.bonus > 0 && (
                    <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> R$ {mission.bonus}
                    </span>
                  )}
                  {mission.badge && (
                    <span className="text-xs text-violet-500 flex items-center gap-1">
                      <Award className="h-3 w-3" /> {mission.badge}
                    </span>
                  )}
                </div>

                {mission.isAiSuggested && mission.aiJustification && (
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2">
                    <p className="text-[10px] text-muted-foreground">
                      <Sparkles className="inline h-2.5 w-2.5 text-violet-500 mr-0.5" />
                      {mission.aiJustification}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredMissions.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-8 text-center">
            <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma missão encontrada com esses filtros.</p>
          </CardContent>
        </Card>
      )}

      {/* XP/Bonus per collaborator panel */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            XP e Bônus por Colaborador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {collaboratorStats.map((collab) => (
              <div key={collab.name} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40">
                <span className="text-sm font-medium">{collab.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-amber-500">{collab.xp} XP</span>
                  <span className="text-xs font-semibold text-emerald-500">R$ {collab.bonus}</span>
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total em jogo</span>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-amber-500">{totalXp} XP</span>
              <span className="text-sm font-bold text-emerald-500">R$ {totalBonus}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
