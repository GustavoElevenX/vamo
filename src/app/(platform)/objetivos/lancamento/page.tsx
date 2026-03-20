'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Rocket,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Users,
  MessageSquare,
  ClipboardCheck,
  Target,
  Swords,
  Gift,
  HeartPulse,
  Send,
} from 'lucide-react'

interface ChecklistItem {
  id: string
  label: string
  description: string
  icon: React.ElementType
  checked: boolean
  autoChecked: boolean
}

interface TeamMember {
  user_id: string
  name: string
  included: boolean
  risk_level: 'healthy' | 'attention' | 'burnout'
}

export default function LancamentoPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: 'diagnostico',
      label: 'Diagnóstico da empresa concluído',
      description: 'Sessão de diagnóstico finalizada com relatório gerado',
      icon: ClipboardCheck,
      checked: false,
      autoChecked: false,
    },
    {
      id: 'metas',
      label: 'Metas definidas',
      description: 'Metas da empresa, time e individuais configuradas',
      icon: Target,
      checked: false,
      autoChecked: false,
    },
    {
      id: 'plano-acao',
      label: 'Plano de ação configurado',
      description: 'Missões gamificadas criadas com XP e prazos',
      icon: Swords,
      checked: false,
      autoChecked: false,
    },
    {
      id: 'recompensas',
      label: 'Recompensas configuradas',
      description: 'Loja de XP e bônus financeiros definidos',
      icon: Gift,
      checked: false,
      autoChecked: false,
    },
    {
      id: 'burnout',
      label: 'Colaboradores sem risco de burnout',
      description: 'Nenhum vendedor apresenta sinais de burnout',
      icon: HeartPulse,
      checked: false,
      autoChecked: false,
    },
  ])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [launchMessage, setLaunchMessage] = useState(
    'Olá equipe! Estamos lançando nosso programa de gamificação. Complete missões, ganhe XP e troque por recompensas reais. Vamos juntos bater nossas metas!'
  )
  const [launching, setLaunching] = useState(false)
  const [hasBurnoutRisk, setHasBurnoutRisk] = useState(false)

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      // Check diagnostic sessions
      const { count: diagCount } = await supabase
        .from('diagnostic_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', user.organization_id)
        .eq('status', 'completed')

      // Check missions exist
      const { count: missionCount } = await supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', user.organization_id)

      // Fetch team members with health data
      const { data: teamData } = await supabase
        .from('user_xp')
        .select('user_id, current_streak, last_activity_date, users!inner(name, role)')
        .eq('organization_id', user.organization_id)

      const sellers: TeamMember[] = (teamData as any[] ?? [])
        .filter((m) => m.users?.role === 'seller')
        .map((m) => {
          const streak = m.current_streak ?? 0
          const daysSinceActivity = m.last_activity_date
            ? Math.floor((Date.now() - new Date(m.last_activity_date).getTime()) / 86400000)
            : 99
          let risk_level: 'healthy' | 'attention' | 'burnout' = 'healthy'
          if (daysSinceActivity > 7 || streak === 0) risk_level = 'attention'
          if (daysSinceActivity > 14) risk_level = 'burnout'
          return {
            user_id: m.user_id,
            name: m.users?.name ?? 'Vendedor',
            included: risk_level !== 'burnout',
            risk_level,
          }
        })

      setTeamMembers(sellers)

      const burnoutMembers = sellers.filter((s) => s.risk_level === 'burnout')
      setHasBurnoutRisk(burnoutMembers.length > 0)

      // Auto-check items based on data
      setChecklist((prev) =>
        prev.map((item) => {
          if (item.id === 'diagnostico' && (diagCount ?? 0) > 0) {
            return { ...item, checked: true, autoChecked: true }
          }
          if (item.id === 'plano-acao' && (missionCount ?? 0) > 0) {
            return { ...item, checked: true, autoChecked: true }
          }
          if (item.id === 'burnout' && burnoutMembers.length === 0) {
            return { ...item, checked: true, autoChecked: true }
          }
          return item
        })
      )

      setLoading(false)
    }

    fetchData()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id && !item.autoChecked ? { ...item, checked: !item.checked } : item
      )
    )
  }

  const toggleMember = (userId: string) => {
    setTeamMembers((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, included: !m.included } : m))
    )
  }

  const completedCount = checklist.filter((item) => item.checked).length
  const allComplete = completedCount === checklist.length
  const progressPercent = (completedCount / checklist.length) * 100

  const handleLaunch = async () => {
    if (!allComplete) return
    setLaunching(true)
    await new Promise((r) => setTimeout(r, 1500))
    setLaunching(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Lançamento</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Checklist pré-lançamento e ativação para a equipe
        </p>
      </div>

      {/* Progress indicator */}
      <Card className="border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Progresso do Checklist
              </p>
              <p className="text-sm mt-0.5">
                <strong className="text-emerald-500">{completedCount}</strong> de{' '}
                <strong>{checklist.length}</strong> itens concluídos
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <span className="text-sm font-bold text-emerald-500">
                {Math.round(progressPercent)}%
              </span>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted/50">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pre-launch checklist */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <ClipboardCheck className="h-4 w-4 text-violet-500" />
            </div>
            <CardTitle className="text-sm font-medium">Checklist Pré-Lançamento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {checklist.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => toggleChecklist(item.id)}
                className={`w-full flex items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent/50 ${
                  item.checked ? 'bg-emerald-500/5' : ''
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.checked ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      item.checked ? 'text-emerald-600 line-through' : ''
                    }`}
                  >
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <div className="shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-muted-foreground/50" />
                </div>
                {item.autoChecked && (
                  <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-0 shrink-0 mt-0.5">
                    Auto
                  </Badge>
                )}
              </button>
            )
          })}
        </CardContent>
      </Card>

      {/* Burnout alert */}
      {hasBurnoutRisk && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-600">
                  Vendedor(es) em risco de burnout detectado
                </p>
                <p className="text-xs text-red-500/80 mt-1 leading-relaxed">
                  Gamificação de volume sobre alguém em burnout piora o problema. Converse
                  individualmente antes de lançar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team assignment panel */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-sm font-medium">Equipe Participante</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum vendedor encontrado na organização.
            </p>
          ) : (
            <div className="space-y-1">
              {teamMembers.map((member) => (
                <label
                  key={member.user_id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent/50 ${
                    member.risk_level === 'burnout' ? 'bg-red-500/5' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={member.included}
                    onChange={() => toggleMember(member.user_id)}
                    className="h-4 w-4 rounded border-border accent-emerald-500"
                  />
                  <span className="text-sm flex-1">{member.name}</span>
                  {member.risk_level === 'burnout' && (
                    <Badge className="text-[9px] h-4 px-1.5 bg-red-500/10 text-red-600 border-0">
                      Burnout
                    </Badge>
                  )}
                  {member.risk_level === 'attention' && (
                    <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-0">
                      Atenção
                    </Badge>
                  )}
                  {member.risk_level === 'healthy' && (
                    <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-0">
                      Saudável
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message editor */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-amber-500" />
            </div>
            <CardTitle className="text-sm font-medium">Mensagem de Lançamento</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            value={launchMessage}
            onChange={(e) => setLaunchMessage(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border/50 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            placeholder="Escreva uma mensagem personalizada para a equipe..."
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Esta mensagem será enviada para todos os vendedores selecionados.
          </p>
        </CardContent>
      </Card>

      {/* Launch button */}
      <div className="flex justify-center pt-2">
        <Button
          size="lg"
          onClick={handleLaunch}
          disabled={!allComplete || launching}
          className="px-8 py-6 text-base gap-2"
        >
          {launching ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Lançando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Lançar Programa
            </span>
          )}
        </Button>
      </div>

      {!allComplete && (
        <p className="text-center text-xs text-muted-foreground">
          Complete todos os {checklist.length} itens do checklist para habilitar o lançamento.
        </p>
      )}
    </div>
  )
}
