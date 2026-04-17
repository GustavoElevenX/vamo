'use client'

import { useEffect, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
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
  PartyPopper,
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

interface ProgramLaunch {
  id: string
  launch_message: string
  team_member_ids: string[]
  created_at: string
}

export default function LancamentoPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [existingLaunch, setExistingLaunch] = useState<ProgramLaunch | null>(null)
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
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [hasBurnoutRisk, setHasBurnoutRisk] = useState(false)

  // Chave de persistência de checkboxes manuais no localStorage
  const persistKey = user ? `launch-checklist-manual-${user.organization_id}` : null

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      // Verificar se já existe um lançamento
      const launchRes = await fetch('/api/launch')
      if (launchRes.ok) {
        const { launch } = await launchRes.json()
        if (launch) {
          setExistingLaunch(launch)
          setLoading(false)
          return
        }
      }

      // Carregar checkboxes manuais persistidos
      let savedManual: Record<string, boolean> = {}
      if (persistKey) {
        try {
          savedManual = JSON.parse(localStorage.getItem(persistKey) ?? '{}')
        } catch {
          savedManual = {}
        }
      }

      // Verificações automáticas em paralelo
      const [
        { count: diagCount },
        { count: missionCount },
        { count: kpiCount },
        { count: rewardsCount },
      ] = await Promise.all([
        supabase
          .from('diagnostic_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', user.organization_id)
          .eq('status', 'completed'),
        supabase
          .from('ai_missions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', user.organization_id),
        supabase
          .from('kpi_definitions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', user.organization_id)
          .eq('active', true),
        supabase
          .from('rewards_catalog')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', user.organization_id)
          .eq('active', true),
      ])

      // Fetch all active sellers in the org
      const sellersRes = await fetch('/api/team/sellers', { credentials: 'same-origin' })
      const sellersJson = sellersRes.ok ? await sellersRes.json() : { sellers: [] }
      const sellerUsers: { id: string; name: string }[] = sellersJson.sellers ?? []

      // Fetch XP data for those sellers (left-join equivalent)
      const sellerIds = sellerUsers.map((s) => s.id)
      const { data: xpData } = sellerIds.length > 0
        ? await supabase
            .from('user_xp')
            .select('user_id, current_streak, last_activity_date')
            .in('user_id', sellerIds)
        : { data: [] }

      const xpByUser: Record<string, { current_streak: number; last_activity_date: string | null }> = {}
      for (const xp of xpData ?? []) {
        xpByUser[xp.user_id] = xp
      }

      const sellers: TeamMember[] = (sellerUsers ?? []).map((seller) => {
        const xp = xpByUser[seller.id]
        const daysSinceActivity = xp?.last_activity_date
          ? Math.floor((Date.now() - new Date(xp.last_activity_date).getTime()) / 86400000)
          : 99
        let risk_level: 'healthy' | 'attention' | 'burnout' = 'healthy'
        if (daysSinceActivity > 7 || (xp?.current_streak ?? 0) === 0) risk_level = 'attention'
        if (daysSinceActivity > 14) risk_level = 'burnout'
        return {
          user_id: seller.id,
          name: seller.name,
          included: risk_level !== 'burnout',
          risk_level,
        }
      })

      setTeamMembers(sellers)

      const burnoutMembers = sellers.filter((s) => s.risk_level === 'burnout')
      setHasBurnoutRisk(burnoutMembers.length > 0)

      // Auto-check itens com base em dados + restaurar checkboxes manuais
      setChecklist((prev) =>
        prev.map((item) => {
          if (item.id === 'diagnostico' && (diagCount ?? 0) > 0) {
            return { ...item, checked: true, autoChecked: true }
          }
          if (item.id === 'metas' && (kpiCount ?? 0) > 0) {
            return { ...item, checked: true, autoChecked: true }
          }
          if (item.id === 'plano-acao' && (missionCount ?? 0) > 0) {
            return { ...item, checked: true, autoChecked: true }
          }
          if (item.id === 'recompensas' && (rewardsCount ?? 0) > 0) {
            return { ...item, checked: true, autoChecked: true }
          }
          if (item.id === 'burnout' && sellers.length > 0 && burnoutMembers.length === 0) {
            return { ...item, checked: true, autoChecked: true }
          }
          // Restaurar estado manual salvo
          if (savedManual[item.id] !== undefined) {
            return { ...item, checked: savedManual[item.id] }
          }
          return item
        })
      )

      setLoading(false)
    }

    fetchData().catch(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  // Estado: programa já foi lançado
  if (existingLaunch) {
    const launchedAt = new Date(existingLaunch.created_at)
    const formatted = launchedAt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Lançamento</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Checklist pré-lançamento e ativação para a equipe
          </p>
        </div>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <PartyPopper className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-600">Programa Lançado!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Lançado em {formatted} para{' '}
                  <strong>{existingLaunch.team_member_ids.length}</strong>{' '}
                  {existingLaunch.team_member_ids.length === 1 ? 'vendedor' : 'vendedores'}
                </p>
              </div>
              <div className="w-full max-w-md rounded-lg border border-emerald-500/20 bg-background px-4 py-3 text-sm text-left text-muted-foreground italic">
                "{existingLaunch.launch_message}"
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const toggleChecklist = (id: string) => {
    setChecklist((prev) => {
      const next = prev.map((item) =>
        item.id === id && !item.autoChecked ? { ...item, checked: !item.checked } : item
      )
      // Persistir apenas os checkboxes manuais
      if (persistKey) {
        const manual: Record<string, boolean> = {}
        next.forEach((item) => {
          if (!item.autoChecked) manual[item.id] = item.checked
        })
        localStorage.setItem(persistKey, JSON.stringify(manual))
      }
      return next
    })
  }

  const toggleMember = (userId: string) => {
    setTeamMembers((prev) =>
      prev.map((m) => (m.user_id === userId ? { ...m, included: !m.included } : m))
    )
  }

  const completedCount = checklist.filter((item) => item.checked).length
  const allComplete = completedCount === checklist.length
  const progressPercent = (completedCount / checklist.length) * 100
  const selectedMembers = teamMembers.filter((m) => m.included)

  const handleLaunch = async () => {
    if (!allComplete) return
    if (selectedMembers.length === 0) {
      setLaunchError('Selecione ao menos um vendedor para o lançamento.')
      return
    }
    setLaunching(true)
    setLaunchError(null)

    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          launch_message: launchMessage,
          team_member_ids: selectedMembers.map((m) => m.user_id),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setLaunchError(data.error ?? 'Erro ao lançar programa.')
        setLaunching(false)
        return
      }

      // Limpar persistência e mostrar estado de sucesso
      if (persistKey) localStorage.removeItem(persistKey)
      setExistingLaunch({
        id: data.launch.id,
        launch_message: launchMessage,
        team_member_ids: selectedMembers.map((m) => m.user_id),
        created_at: data.launch.created_at,
      })
    } catch {
      setLaunchError('Erro de conexão. Tente novamente.')
      setLaunching(false)
    }
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <CardTitle className="text-sm font-medium">Equipe Participante</CardTitle>
            </div>
            {teamMembers.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedMembers.length}/{teamMembers.length} selecionados
              </span>
            )}
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
            Esta mensagem será enviada via chat da plataforma para os{' '}
            <strong>{selectedMembers.length}</strong> vendedor(es) selecionados.
          </p>
        </CardContent>
      </Card>

      {/* Launch button */}
      <div className="flex flex-col items-center gap-3 pt-2">
        {launchError && (
          <p className="text-sm text-red-500 text-center">{launchError}</p>
        )}
        <Button
          size="lg"
          onClick={handleLaunch}
          disabled={!allComplete || launching || selectedMembers.length === 0}
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
        {!allComplete && (
          <p className="text-center text-xs text-muted-foreground">
            Complete todos os {checklist.length} itens do checklist para habilitar o lançamento.
          </p>
        )}
        {allComplete && selectedMembers.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Selecione ao menos um vendedor para lançar.
          </p>
        )}
      </div>
    </div>
  )
}
