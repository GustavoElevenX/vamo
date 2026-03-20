'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  BarChart3,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  Trash2,
} from 'lucide-react'

interface KPI {
  id: string
  name: string
  source: 'CRM' | 'manual'
  target: number
  current: number
  unit: string
  alertTolerance: number
  active: boolean
}

const MAX_KPIS = 5

const INITIAL_KPIS: KPI[] = [
  {
    id: '1',
    name: 'Taxa de conversão',
    source: 'CRM',
    target: 30,
    current: 27,
    unit: '%',
    alertTolerance: 10,
    active: true,
  },
  {
    id: '2',
    name: 'Ligações por semana',
    source: 'CRM',
    target: 50,
    current: 42,
    unit: 'ligações',
    alertTolerance: 15,
    active: true,
  },
  {
    id: '3',
    name: 'Receita mensal',
    source: 'CRM',
    target: 100000,
    current: 115000,
    unit: 'R$',
    alertTolerance: 10,
    active: true,
  },
]

function getKpiStatus(kpi: KPI): 'verde' | 'amarelo' | 'vermelho' {
  const ratio = kpi.current / kpi.target
  if (ratio >= 1) return 'verde'
  if (ratio >= 1 - kpi.alertTolerance / 100) return 'amarelo'
  return 'vermelho'
}

function StatusDot({ status }: { status: 'verde' | 'amarelo' | 'vermelho' }) {
  const colors = {
    verde: 'bg-emerald-500',
    amarelo: 'bg-amber-500',
    vermelho: 'bg-red-500',
  }
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[status]}`} />
}

function StatusBadge({ status }: { status: 'verde' | 'amarelo' | 'vermelho' }) {
  const variants = {
    verde: 'bg-emerald-500/10 text-emerald-600 border-0',
    amarelo: 'bg-amber-500/10 text-amber-600 border-0',
    vermelho: 'bg-red-500/10 text-red-600 border-0',
  }
  const labels = { verde: 'No alvo', amarelo: 'Atenção', vermelho: 'Abaixo' }
  return (
    <Badge className={`text-[10px] h-5 px-2 ${variants[status]}`}>
      {labels[status]}
    </Badge>
  )
}

export default function KpisPage() {
  const { user } = useAuth()
  const [kpis, setKpis] = useState<KPI[]>(INITIAL_KPIS)
  const [aiAccepted, setAiAccepted] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newKpi, setNewKpi] = useState({
    name: '',
    source: 'CRM' as 'CRM' | 'manual',
    target: '',
    unit: '',
  })

  if (!user) return null

  const activeCount = kpis.filter((k) => k.active).length

  const handleAddKpi = () => {
    if (!newKpi.name || !newKpi.target || activeCount >= MAX_KPIS) return
    const kpi: KPI = {
      id: Date.now().toString(),
      name: newKpi.name,
      source: newKpi.source,
      target: Number(newKpi.target),
      current: 0,
      unit: newKpi.unit || 'unid.',
      alertTolerance: 10,
      active: true,
    }
    setKpis([...kpis, kpi])
    setNewKpi({ name: '', source: 'CRM', target: '', unit: '' })
    setDialogOpen(false)
  }

  const handleRemoveKpi = (id: string) => {
    setKpis(kpis.filter((k) => k.id !== id))
  }

  const handleToleranceChange = (id: string, value: string) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0))
    setKpis(kpis.map((k) => (k.id === id ? { ...k, alertTolerance: num } : k)))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">KPIs</h2>
              <Badge variant="outline" className="text-[10px] h-5 px-2">
                Etapa 3
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Indicadores que serão acompanhados ao longo do ciclo
            </p>
          </div>
        </div>

        {/* Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/50 px-3 py-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">
              {activeCount}/{MAX_KPIS} KPIs ativos
            </span>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger>
              <Button size="sm" className="h-8 text-xs" disabled={activeCount >= MAX_KPIS}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Adicionar KPI
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo KPI</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="kpi-name">Nome do indicador</Label>
                  <Input
                    id="kpi-name"
                    placeholder="Ex: Taxa de conversão"
                    value={newKpi.name}
                    onChange={(e) => setNewKpi({ ...newKpi, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fonte de dados</Label>
                  <Select
                    value={newKpi.source}
                    onValueChange={(v) => setNewKpi({ ...newKpi, source: v as 'CRM' | 'manual' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CRM">CRM (automático)</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="kpi-target">Meta</Label>
                    <Input
                      id="kpi-target"
                      type="number"
                      placeholder="100"
                      value={newKpi.target}
                      onChange={(e) => setNewKpi({ ...newKpi, target: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kpi-unit">Unidade</Label>
                    <Input
                      id="kpi-unit"
                      placeholder="%, R$, unid."
                      value={newKpi.unit}
                      onChange={(e) => setNewKpi({ ...newKpi, unit: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleAddKpi} className="w-full">
                  Adicionar KPI
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* AI Suggestion */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Sugestão da IA</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                A IA sugere: Sua maior perda é em proposta — sugiro taxa de conversão como KPI
                principal. Confirma?
              </p>
              {!aiAccepted ? (
                <Button
                  size="sm"
                  className="h-7 text-xs mt-3"
                  onClick={() => setAiAccepted(true)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Aceitar sugestão
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 mt-3 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Sugestão aceita</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="space-y-3">
        {kpis.map((kpi) => {
          const status = getKpiStatus(kpi)
          const ratio = Math.min(100, Math.round((kpi.current / kpi.target) * 100))

          return (
            <Card key={kpi.id} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Left: name, source, status */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StatusDot status={status} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{kpi.name}</p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Fonte: {kpi.source} · Meta: {kpi.target.toLocaleString('pt-BR')} {kpi.unit}
                      </p>
                    </div>
                  </div>

                  {/* Center: current value + progress */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {kpi.current.toLocaleString('pt-BR')}
                        <span className="text-xs font-normal text-muted-foreground ml-1">{kpi.unit}</span>
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {status === 'verde' ? (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className="text-[11px] text-muted-foreground">{ratio}% da meta</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: alert tolerance + remove */}
                  <div className="flex items-center gap-3">
                    <Separator orientation="vertical" className="h-8 hidden sm:block" />
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">Alerta se cair</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          className="h-7 w-14 text-xs text-center"
                          value={kpi.alertTolerance}
                          onChange={(e) => handleToleranceChange(kpi.id, e.target.value)}
                          min={0}
                          max={100}
                        />
                        <Percent className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">abaixo da meta</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      onClick={() => handleRemoveKpi(kpi.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty state */}
      {kpis.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum KPI configurado. Adicione indicadores para acompanhar o desempenho.
          </p>
        </div>
      )}
    </div>
  )
}
