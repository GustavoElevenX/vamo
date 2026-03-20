'use client'

import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  TrendingUp,
  Clock,
  BarChart3,
  Download,
  ArrowRight,
  Sparkles,
  Users,
  Target,
  RefreshCw,
} from 'lucide-react'

export default function ROIPage() {
  const { user } = useAuth()

  if (!user) return null

  const roi = {
    investimento: 2500,
    receitaAdicional: 18700,
    economiaTempo: 32,
    roiMultiplier: 7.5,
  }

  const breakdown = [
    {
      label: 'Aumento de vendas atribuído a missões',
      value: 12400,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Redução de turnover (economia contratação)',
      value: 4200,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Economia de tempo gestão manual',
      value: 2100,
      icon: Clock,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">ROI da Plataforma</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Retorno sobre investimento da gamificação
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5 mr-1" />
          Exportar PDF
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ {roi.investimento.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-muted-foreground">Investimento Mensal</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">R$ {roi.receitaAdicional.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-muted-foreground">Receita Adicional Estimada</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roi.economiaTempo}h/mês</p>
                <p className="text-[10px] text-muted-foreground">Economia de Tempo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-500">{roi.roiMultiplier}x</p>
                <p className="text-[10px] text-muted-foreground">ROI</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ROI Calculation */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" />
            Cálculo do ROI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-3 py-4 flex-wrap">
            <div className="text-center p-3 rounded-lg bg-muted/50 border border-border/30">
              <p className="text-[10px] text-muted-foreground mb-1">Receita Adicional</p>
              <p className="text-lg font-bold text-emerald-500">R$ 18.700</p>
            </div>
            <span className="text-xl text-muted-foreground">+</span>
            <div className="text-center p-3 rounded-lg bg-muted/50 border border-border/30">
              <p className="text-[10px] text-muted-foreground mb-1">Economia</p>
              <p className="text-lg font-bold text-blue-500">R$ 2.100</p>
            </div>
            <span className="text-xl text-muted-foreground">/</span>
            <div className="text-center p-3 rounded-lg bg-muted/50 border border-border/30">
              <p className="text-[10px] text-muted-foreground mb-1">Investimento</p>
              <p className="text-lg font-bold text-red-500">R$ 2.500</p>
            </div>
            <span className="text-xl text-muted-foreground">=</span>
            <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] text-emerald-500 mb-1">ROI</p>
              <p className="text-2xl font-bold text-emerald-500">7.5x</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Detalhamento do Retorno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {breakdown.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-accent/30 transition-colors"
                >
                  <div className={`h-10 w-10 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                  </div>
                  <p className={`text-sm font-bold ${item.color} shrink-0`}>
                    +R$ {item.value.toLocaleString('pt-BR')}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Turnover Reduction */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-500" />
            Redução de Turnover
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-[10px] text-red-500 mb-1">Antes</p>
              <p className="text-3xl font-bold text-red-500">18%</p>
              <p className="text-[10px] text-muted-foreground">Taxa de turnover</p>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] text-emerald-500 mb-1">Depois</p>
              <p className="text-3xl font-bold text-emerald-500">9%</p>
              <p className="text-[10px] text-muted-foreground">Taxa de turnover</p>
            </div>
          </div>
          <div className="text-center mt-2">
            <Badge variant="secondary" className="text-xs">
              Redução de 50% no turnover
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Renewal Text */}
      <Card className="border-border/50 border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-600">Valor Gerado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Com ROI de <strong>7.5x</strong>, cada R$ 1 investido retorna R$ 7,50 em valor gerado.
                A plataforma se paga em menos de 5 dias úteis por mês.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
