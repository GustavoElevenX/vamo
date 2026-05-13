'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { getCached, setCache } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Building2,
  Users,
  User,
  Target,
  ArrowLeft,
  Sparkles,
  CheckCircle,
  TrendingUp,
  Save,
  Loader2,
  AlertCircle,
  Zap,
  DollarSign,
} from 'lucide-react'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import type { PerformanceInsight } from '@/lib/services/performance-insights.service'

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

interface IndividualGoal {
  user_id: string
  name: string
  discProfile: string
  goal: string
  xp_reward: number
  commission_bonus: number
}

interface AiSuggestion {
  text: string
  kpi: string
  valorAtual: string
  valorMeta: string
  days: number
  medicao: 'auto_crm' | 'manual'
}

const DISC_LABELS: Record<string, string> = {
  D: 'D - Dominante',
  I: 'I - Influente',
  S: 'S - Estável',
  C: 'C - Consciencioso',
}

const INSIGHT_CACHE_TTL = 60 * 1000

export default function MetasPage() {
  const { user } = useRequiredAuth()
  const router = useRouter()
  const supabase = createClient()

  const [companyGoal, setCompanyGoal] = useState<CompanyGoal>({
    kpiFinanceiro: '', valorAtual: '', valorMeta: '', prazo: '', metrica: '',
  })
  const [teamGoal, setTeamGoal] = useState<TeamGoal>({
    kpiComportamental: '', valorAtual: '', valorMeta: '', prazo: '', medicao: 'auto_crm',
  })
  const [individualGoals, setIndividualGoals] = useState<IndividualGoal[]>([])
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)
  const [aiInsight, setAiInsight] = useState<PerformanceInsight | null>(null)
  const [aiInsightLoading, setAiInsightLoading] = useState(true)
  const [aiAccepted, setAiAccepted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noSellers, setNoSellers] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setAiInsightLoading(true)
    try {
      const insightCacheKey = `performance-insight:${user.organization_id}`
      const cachedInsight = getCached<PerformanceInsight>(insightCacheKey)
      const [
        sellersRes,
        aiInsightRes,
        { data: profiles },
        { data: savedGoals },
      ] = await Promise.all([
        fetch('/api/team/sellers', { credentials: 'same-origin' }).then((r) => r.json()),
        cachedInsight
          ? Promise.resolve({ insight: cachedInsight })
          : fetch('/api/ai/performance-insights', { credentials: 'same-origin' })
              .then(async (r) => {
                const data = await r.json()
                if (!r.ok) throw new Error(data.error || 'Erro ao carregar análise')
                setCache(insightCacheKey, data.insight, INSIGHT_CACHE_TTL)
                return data as { insight: PerformanceInsight }
              })
              .catch(() => ({ insight: null })),
        supabase
          .from('behavioral_profiles')
          .select('user_id, disc_type')
          .eq('organization_id', user.organization_id),
        supabase
          .from('program_goals')
          .select('*')
          .eq('organization_id', user.organization_id)
          .maybeSingle(),
      ])

      const insight = aiInsightRes.insight
      setAiInsight(insight)

      const sellers: { id: string; name: string }[] = sellersRes.sellers ?? []

      if (!sellers || sellers.length === 0) {
        setNoSellers(true)
      }

      // Build individual goals list from real sellers
      const discMap: Record<string, string> = {}
      for (const p of profiles ?? []) {
        if (p.disc_type) discMap[p.user_id] = p.disc_type
      }

      const savedGoalsMap: Record<string, { goal: string; xp_reward?: number; commission_bonus?: number }> = {}
      for (const g of (savedGoals?.individual_goals as { user_id: string; goal: string; xp_reward?: number; commission_bonus?: number }[] ?? [])) {
        savedGoalsMap[g.user_id] = g
      }

      setIndividualGoals(
        (sellers ?? []).map((s) => ({
          user_id: s.id,
          name: s.name,
          discProfile: DISC_LABELS[discMap[s.id] ?? ''] ?? 'Sem perfil DISC',
          goal: savedGoalsMap[s.id]?.goal ?? '',
          xp_reward: savedGoalsMap[s.id]?.xp_reward ?? 50,
          commission_bonus: savedGoalsMap[s.id]?.commission_bonus ?? 0,
        }))
      )

      // Load saved company + team goals
      if (savedGoals?.company_goal) {
        const cg = savedGoals.company_goal as Record<string, string>
        setCompanyGoal({
          kpiFinanceiro: cg.kpiFinanceiro ?? '',
          valorAtual: cg.valorAtual ?? '',
          valorMeta: cg.valorMeta ?? '',
          prazo: cg.prazo ?? '',
          metrica: cg.metrica ?? '',
        })
      }
      if (savedGoals?.team_goal) {
        const tg = savedGoals.team_goal as Record<string, string>
        setTeamGoal({
          kpiComportamental: tg.kpiComportamental ?? '',
          valorAtual: tg.valorAtual ?? '',
          valorMeta: tg.valorMeta ?? '',
          prazo: tg.prazo ?? '',
          medicao: (tg.medicao as 'auto_crm' | 'manual') ?? 'auto_crm',
        })
      }

      // Build AI suggestion only from the audited performance insight API.
      if (insight?.status === 'ready' && !savedGoals?.team_goal?.kpiComportamental) {
        const recommendation = insight.kpiRecommendation
        const currentPct = Math.round(insight.source.weakestAreaPct ?? insight.source.healthPct ?? 0)
        const isPercent = recommendation?.unit === '%'
        const target = recommendation
          ? recommendation.monthlyTarget
          : Math.min(100, Math.max(currentPct + 15, Math.round(currentPct * 1.2)))

        setAiSuggestion({
          text: insight.message,
          kpi: recommendation?.name ?? insight.source.weakestArea ?? 'Desempenho comercial',
          valorAtual: isPercent || !recommendation ? `${currentPct}%` : '',
          valorMeta: isPercent ? `${target}%` : `${target}${recommendation?.unit ? ` ${recommendation.unit}` : ''}`,
          days: Number(insight.source.healthPct ?? 0) < 50 ? 30 : 60,
          medicao: recommendation?.source === 'manual' ? 'manual' : 'auto_crm',
        })
      } else {
        setAiSuggestion(null)
      }
    } finally {
      setAiInsightLoading(false)
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleIndividualGoalChange = (userId: string, value: string) => {
    setIndividualGoals((prev) => prev.map((g) => (g.user_id === userId ? { ...g, goal: value } : g)))
  }

  const handleIndividualFieldChange = (userId: string, field: 'xp_reward' | 'commission_bonus', value: number) => {
    setIndividualGoals((prev) => prev.map((g) => (g.user_id === userId ? { ...g, [field]: value } : g)))
  }

  const handleAcceptAiSuggestion = () => {
    if (!aiSuggestion) return
    const deadline = new Date(Date.now() + aiSuggestion.days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]
    setTeamGoal((prev) => ({
      ...prev,
      kpiComportamental: aiSuggestion.kpi,
      valorAtual: aiSuggestion.valorAtual,
      valorMeta: aiSuggestion.valorMeta,
      prazo: deadline,
      medicao: aiSuggestion.medicao,
    }))
    setAiAccepted(true)
    toast.success('Sugestão aplicada com base no diagnóstico')
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const res = await fetch('/api/goals/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          company_goal: companyGoal,
          team_goal: teamGoal,
          individual_goals: individualGoals.map((g) => ({
            user_id: g.user_id,
            goal: g.goal,
            xp_reward: g.xp_reward,
            commission_bonus: g.commission_bonus,
          })),
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast.success('Metas salvas! Vendedores notificados via chat e sino.')
      router.push('/objetivos')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar metas')
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
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/objetivos')} className="px-2 mt-1 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          label="Objetivos · Etapa 2"
          labelIcon={<Target className="h-3 w-3" />}
          title={<>Definir <TitleHighlight>Metas</TitleHighlight></>}
          description="Alinhe metas da empresa, do time e individuais com base no diagnóstico DISC"
          className="flex-1"
        />
      </div>

      {/* Aviso sem vendedores */}
      {noSellers && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-600">Nenhum vendedor cadastrado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  As metas individuais ficam disponíveis após cadastrar vendedores. Use o Chat IA: "Cadastre o vendedor João, email joao@empresa.com".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meta da Empresa */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Meta da Empresa</CardTitle>
              <p className="text-[10px] text-muted-foreground">KPI financeiro principal</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">KPI Financeiro</Label>
            <Input
              value={companyGoal.kpiFinanceiro}
              onChange={(e) => setCompanyGoal((p) => ({ ...p, kpiFinanceiro: e.target.value }))}
              placeholder="Ex: Receita mensal, MRR, Ticket Médio"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Valor Atual</Label>
              <Input
                value={companyGoal.valorAtual}
                onChange={(e) => setCompanyGoal((p) => ({ ...p, valorAtual: e.target.value }))}
                placeholder="Ex: R$ 150.000"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor Meta</Label>
              <Input
                value={companyGoal.valorMeta}
                onChange={(e) => setCompanyGoal((p) => ({ ...p, valorMeta: e.target.value }))}
                placeholder="Ex: R$ 200.000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Prazo</Label>
              <Input type="date" value={companyGoal.prazo} onChange={(e) => setCompanyGoal((p) => ({ ...p, prazo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Métrica de Acompanhamento</Label>
              <Input
                value={companyGoal.metrica}
                onChange={(e) => setCompanyGoal((p) => ({ ...p, metrica: e.target.value }))}
                placeholder="Ex: R$/mês"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meta do Time */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Meta do Time</CardTitle>
              <p className="text-[10px] text-muted-foreground">KPI comportamental coletivo</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">KPI Comportamental</Label>
            <Input
              value={teamGoal.kpiComportamental}
              onChange={(e) => setTeamGoal((p) => ({ ...p, kpiComportamental: e.target.value }))}
              placeholder="Ex: Taxa de conversão, retorno em 24h"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Valor Atual</Label>
              <Input value={teamGoal.valorAtual} onChange={(e) => setTeamGoal((p) => ({ ...p, valorAtual: e.target.value }))} placeholder="Ex: 44%" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor Meta</Label>
              <Input value={teamGoal.valorMeta} onChange={(e) => setTeamGoal((p) => ({ ...p, valorMeta: e.target.value }))} placeholder="Ex: 62%" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Prazo</Label>
              <Input type="date" value={teamGoal.prazo} onChange={(e) => setTeamGoal((p) => ({ ...p, prazo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Medição</Label>
              <select
                value={teamGoal.medicao}
                onChange={(e) => setTeamGoal((p) => ({ ...p, medicao: e.target.value as 'auto_crm' | 'manual' }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none"
              >
                <option value="auto_crm">Automático (CRM)</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          {(aiInsightLoading || aiInsight || aiSuggestion) && (
            <div className={`rounded-lg border p-4 transition-all ${aiAccepted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-violet-500/30 bg-violet-500/5'}`}>
              <div className="flex items-start gap-2">
                {aiInsight?.status === 'needs_diagnostic' ? (
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                ) : (
                  <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${aiAccepted ? 'text-emerald-500' : 'text-violet-500'}`} />
                )}
                <div className="flex-1">
                  <p className="text-xs font-medium mb-1">
                    {aiAccepted ? (
                      <span className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle className="h-3 w-3" /> Sugestão aplicada
                      </span>
                    ) : aiInsight?.status === 'needs_diagnostic' ? (
                      <span className="text-amber-500">Diagnóstico necessário para sugestão real</span>
                    ) : (
                      <span className="text-violet-500">Sugestão real baseada no diagnóstico</span>
                    )}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {aiInsightLoading
                      ? 'Analisando diagnóstico, KPIs e missões antes de sugerir uma meta.'
                      : aiInsight?.status === 'needs_diagnostic'
                        ? aiInsight.message
                        : aiSuggestion?.text ?? aiInsight?.message}
                  </p>

                  {aiInsight?.source?.diagnosticId && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px] border-0">
                        Fonte: diagnóstico {aiInsight.source.diagnosticDate ? new Date(aiInsight.source.diagnosticDate).toLocaleDateString('pt-BR') : ''}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] border-0">
                        Gargalo: {aiInsight.source.weakestArea} ({Math.round(aiInsight.source.weakestAreaPct ?? 0)}%)
                      </Badge>
                    </div>
                  )}

                  {!aiInsightLoading && aiInsight?.status === 'needs_diagnostic' && (
                    <Button size="sm" variant="outline" className="text-xs mt-3" render={<Link href="/diagnostico/novo" />}>
                      Fazer diagnóstico
                    </Button>
                  )}

                  {!aiAccepted && aiSuggestion && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="text-xs bg-violet-500 hover:bg-violet-600 text-white" onClick={handleAcceptAiSuggestion}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Aceitar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metas Individuais */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Metas Individuais</CardTitle>
              <p className="text-[10px] text-muted-foreground">Baseadas no perfil DISC de cada colaborador</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {individualGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum vendedor cadastrado. Adicione vendedores via Chat IA para definir metas individuais.
            </p>
          ) : (
            <>
              {individualGoals.map((collab) => (
                <div key={collab.user_id} className="p-3 rounded-lg border border-border/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{collab.name}</p>
                    <Badge variant="outline" className="text-[9px]">{collab.discProfile}</Badge>
                  </div>
                  <Input
                    value={collab.goal}
                    onChange={(e) => handleIndividualGoalChange(collab.user_id, e.target.value)}
                    placeholder="Ex: 8 contratos fechados no mês"
                    className="text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 rounded-md border border-border/40 px-2 py-1">
                      <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                      <Input
                        type="number"
                        min={0}
                        value={collab.xp_reward}
                        onChange={(e) => handleIndividualFieldChange(collab.user_id, 'xp_reward', Number(e.target.value))}
                        placeholder="XP"
                        className="h-5 border-0 p-0 text-xs focus-visible:ring-0"
                      />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">XP</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md border border-border/40 px-2 py-1">
                      <DollarSign className="h-3 w-3 text-emerald-500 shrink-0" />
                      <Input
                        type="number"
                        min={0}
                        value={collab.commission_bonus}
                        onChange={(e) => handleIndividualFieldChange(collab.user_id, 'commission_bonus', Number(e.target.value))}
                        placeholder="0"
                        className="h-5 border-0 p-0 text-xs focus-visible:ring-0"
                      />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">R$ bônus</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Metas individuais são calibradas pelo perfil DISC. Perfis <strong>D</strong> recebem metas de resultado mais agressivas,
                    enquanto perfis <strong>S</strong> e <strong>C</strong> focam em consistência e qualidade.
                    {individualGoals.some((g) => g.discProfile === 'Sem perfil DISC') && (
                      <span className="block mt-1 text-amber-600"> Alguns vendedores ainda não completaram o diagnóstico DISC.</span>
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/objetivos')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
        </Button>
        <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          {saving ? 'Salvando...' : 'Salvar Metas'}
        </Button>
      </div>
    </div>
  )
}
