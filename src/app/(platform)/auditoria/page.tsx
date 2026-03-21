'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
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
import type { DiagnosticSession } from '@/types'

interface Bottleneck {
  area: string
  label: string
  severity: 'critical' | 'at_risk' | 'developing'
  lossPerMonth: number
  description: string
  missionSuggestion: string
}

export default function AuditoriaComercialPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<DiagnosticSession[]>([])

  // Simulated bottleneck data (from AI analysis in production)
  const bottlenecks: Bottleneck[] = [
    {
      area: 'sales_process',
      label: 'Processo de Vendas',
      severity: 'critical',
      lossPerMonth: 23400,
      description: 'Taxa de conversão de proposta para negociação caiu 18% nos últimos 30 dias. Vendedores não estão seguindo o script de follow-up.',
      missionSuggestion: 'Criar missão: "Follow-up em 24h" — cada vendedor deve retornar propostas abertas dentro de 24h',
    },
    {
      area: 'lead_generation',
      label: 'Geração de Leads',
      severity: 'at_risk',
      lossPerMonth: 12800,
      description: 'Volume de leads qualificados reduziu 15%. Canal orgânico em queda desde a última semana.',
      missionSuggestion: 'Criar missão: "Prospecção ativa" — 5 novos contatos qualificados por dia',
    },
    {
      area: 'team_management',
      label: 'Gestão de Equipe',
      severity: 'developing',
      lossPerMonth: 5200,
      description: '2 vendedores com queda consistente de performance. Possível desmotivação ou sobrecarga.',
      missionSuggestion: 'Criar missão: "Check-in semanal" — reunião individual de 15min com cada membro',
    },
  ]

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

    fetchData()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const totalLoss = bottlenecks.reduce((sum, b) => sum + b.lossPerMonth, 0)

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
              <p className="text-[11px] font-medium uppercase tracking-wider text-red-500/70">Perda Estimada Total</p>
              <p className="text-3xl font-bold text-red-500">
                R$ {totalLoss.toLocaleString('pt-BR')}<span className="text-base font-normal">/mês</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {bottlenecks.length} gargalos identificados pela IA
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottlenecks */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Gargalos por Criticidade</h3>

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
                      -R$ {bottleneck.lossPerMonth.toLocaleString('pt-BR')}/mês
                    </span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-3">{bottleneck.description}</p>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <p className="text-xs text-muted-foreground">{bottleneck.missionSuggestion}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0">
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
