'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ArrowRight,
  Sparkles,
  Plus,
  FileSearch,
  BarChart3,
  CheckCircle2,
} from 'lucide-react'
import type { DiagnosticArea, DiagnosticSession } from '@/types'

interface Bottleneck {
  area: DiagnosticArea
  label: string
  severity: 'critical' | 'at_risk' | 'developing'
  lossPerMonth: number | null
  description: string
  missionSuggestion: string
  scorePct: number
  sourceDate: string
}

const AREA_LABELS: Record<DiagnosticArea, string> = {
  lead_generation: 'Geração de Leads',
  sales_process: 'Processo de Vendas',
  team_management: 'Gestão de Equipe',
  tools_technology: 'Ferramentas e Tecnologia',
}

const MISSION_BY_AREA: Record<DiagnosticArea, string> = {
  lead_generation: 'Criar missão: prospecção diária com leads qualificados e revisão semanal de qualidade',
  sales_process: 'Criar missão: follow-up em até 24h para propostas abertas e medição de conversão',
  team_management: 'Criar missão: check-in semanal de performance com cada vendedor',
  tools_technology: 'Criar missão: CRM atualizado no mesmo dia para todas as oportunidades',
}

function parseMonthlyGoal(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (normalized.includes('abaixo') && normalized.includes('50')) return 50_000
  if (normalized.includes('50') && normalized.includes('200')) return 125_000
  if (normalized.includes('200') && normalized.includes('500')) return 350_000
  if (normalized.includes('500') && normalized.includes('2m')) return 1_250_000
  if (normalized.includes('2m')) return 2_000_000
  return null
}

function buildBottlenecks(sessions: DiagnosticSession[]): Bottleneck[] {
  const latest = sessions.find((session) => session.status === 'completed' && session.area_scores)
  if (!latest) return []

  const monthlyGoal = parseMonthlyGoal((latest.company_context as Record<string, unknown> | null)?.meta_mensal)

  return (Object.entries(latest.area_scores ?? {}) as [DiagnosticArea, { pct: number }][])
    .filter(([, score]) => typeof score?.pct === 'number')
    .sort(([, a], [, b]) => a.pct - b.pct)
    .slice(0, 3)
    .map(([area, score]) => {
      const scorePct = Math.round(score.pct)
      const severity = scorePct < 35 ? 'critical' : scorePct < 60 ? 'at_risk' : 'developing'
      const lossPerMonth = monthlyGoal
        ? Math.round(monthlyGoal * ((100 - Number(latest.health_pct ?? 0)) / 100) * ((100 - scorePct) / 100) * 0.25)
        : null

      return {
        area,
        label: AREA_LABELS[area],
        severity,
        lossPerMonth,
        scorePct,
        sourceDate: latest.completed_at ?? latest.created_at,
        description: `No diagnóstico de ${new Date(latest.completed_at ?? latest.created_at).toLocaleDateString('pt-BR')}, esta área ficou com ${scorePct}%. Isso indica prioridade de correção antes de criar novas metas agressivas.`,
        missionSuggestion: MISSION_BY_AREA[area],
      }
    })
}

export default function AuditoriaComercialPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<DiagnosticSession[]>([])

  const severityConfig = {
    critical: { label: 'Crítico', color: 'bg-red-500', textColor: 'text-red-500', bgLight: 'bg-red-500/5 border-red-500/10' },
    at_risk: { label: 'Em Risco', color: 'bg-amber-500', textColor: 'text-amber-500', bgLight: 'bg-amber-500/5 border-amber-500/10' },
    developing: { label: 'Em Desenvolvimento', color: 'bg-blue-500', textColor: 'text-blue-500', bgLight: 'bg-blue-500/5 border-blue-500/10' },
  }

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data } = await supabase
        .from('diagnostic_sessions')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('created_at', { ascending: false })
        .limit(5)

      setSessions((data ?? []) as DiagnosticSession[])
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

  const bottlenecks = buildBottlenecks(sessions)
  const totalLoss = bottlenecks.reduce((sum, b) => sum + (b.lossPerMonth ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Auditoria Comercial</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gargalos ranqueados por criticidade com perdas financeiras estimadas
          </p>
        </div>
        <Button size="sm" render={<Link href="/diagnostico/novo" />}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Novo Diagnóstico
        </Button>
      </div>

      {/* Loss Summary */}
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-red-500/70">
                {totalLoss > 0 ? 'Perda Estimada Total' : 'Diagnóstico Necessário'}
              </p>
              <p className="text-3xl font-bold text-red-500">
                {totalLoss > 0 ? (
                  <>R$ {totalLoss.toLocaleString('pt-BR')}<span className="text-base font-normal">/mês</span></>
                ) : (
                  'Sem base real'
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {bottlenecks.length > 0
                  ? `${bottlenecks.length} gargalos calculados a partir do último diagnóstico`
                  : 'Faça o diagnóstico comercial para estimar gargalos e impacto financeiro'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottlenecks */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Gargalos por Criticidade</h3>

        {bottlenecks.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center py-8 text-center">
              <FileSearch className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum diagnóstico concluído para auditar.</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" render={<Link href="/diagnostico/novo" />}>
                <Plus className="h-3 w-3 mr-1" />
                Fazer diagnóstico
              </Button>
            </CardContent>
          </Card>
        )}

        {bottlenecks.map((bottleneck, i) => {
          const config = severityConfig[bottleneck.severity]
          return (
            <Card key={i} className={`border ${config.bgLight}`}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${config.color}`} />
                    <span className="text-sm font-medium">{bottleneck.label}</span>
                    <Badge variant="outline" className={`text-[9px] ${config.textColor} border-current`}>
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-sm font-bold text-red-500">
                      {bottleneck.lossPerMonth
                        ? `-R$ ${bottleneck.lossPerMonth.toLocaleString('pt-BR')}/mês`
                        : `Score ${bottleneck.scorePct}%`}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-3">{bottleneck.description}</p>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-xs text-muted-foreground">{bottleneck.missionSuggestion}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0" render={<Link href="/objetivos/plano-acao" />}>
                    <Plus className="h-3 w-3 mr-1" />
                    Criar Missão
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Diagnostics */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Diagnósticos Recentes</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7" render={<Link href="/diagnostico" />}>
              Ver todos <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <FileSearch className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum diagnóstico realizado.</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" render={<Link href="/diagnostico/novo" />}>
                <Plus className="h-3 w-3 mr-1" />
                Iniciar Diagnóstico
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/diagnostico/${session.id}/relatorio`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    session.status === 'completed'
                      ? 'bg-emerald-500/10'
                      : 'bg-amber-500/10'
                  }`}>
                    {session.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <BarChart3 className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.respondent_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(session.created_at).toLocaleDateString('pt-BR')} ·{' '}
                      {session.status === 'completed' ? 'Concluído' : 'Em andamento'}
                    </p>
                  </div>
                  {session.health_pct > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {Math.round(session.health_pct)}%
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
