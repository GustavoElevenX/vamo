'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  Plug,
  BarChart3,
  Zap,
  CheckCircle2,
  ArrowRight,
  Link2,
  RefreshCw,
  Plus,
  Trash2,
  Settings2,
  AlertCircle,
  Activity,
  Bell,
  DollarSign,
  Flame,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Heart,
  Trophy,
  ShieldCheck,
  Target,
} from 'lucide-react'

type Tab = 'kpis' | 'comissionamento' | 'avaliacoes' | 'alertas' | 'bemestar' | 'gamificacao'

type CRMStatus = 'connected' | 'disconnected' | 'testing'

interface KPI {
  id: string
  name: string
  unit: string
  source: 'crm' | 'manual' | 'planilha'
  current: string
  target: string
  frequency: string
}

interface CRMConfig {
  id: string
  name: string
  logo: string
  status: CRMStatus
  lastSync?: string
  fields?: number
}

interface CommissionConfig {
  aliquota_base: string
  acelerador_threshold: string
  acelerador_rate: string
  bonus_missao: string
  periodo: 'mensal' | 'quinzenal' | 'semanal'
  elegibilidade: string
}

interface AlertTrigger {
  id: string
  label: string
  enabled: boolean
  value: string
  value2?: string
  unit: string
  unit2?: string
}

interface WellbeingConfig {
  frequencia_pulso: 'semanal' | 'quinzenal'
  indice_critico: string
  ausencia_dias: string
}

interface GamificationConfig {
  ranking_publico: boolean
  badges_no_feed: boolean
  level_titles: string[]
}

const DEFAULT_KPIS: KPI[] = [
  { id: '1', name: 'Taxa de conversão por etapa', unit: '%', source: 'crm', current: '8.9', target: '15', frequency: 'Diária' },
  { id: '2', name: 'Volume de ligações/atividades', unit: 'por semana', source: 'crm', current: '23', target: '40', frequency: 'Semanal' },
  { id: '3', name: 'Receita mensal por vendedor', unit: 'R$', source: 'crm', current: '18.400', target: '25.000', frequency: 'Mensal' },
  { id: '4', name: 'Ticket médio', unit: 'R$', source: 'crm', current: '7.200', target: '9.500', frequency: 'Mensal' },
  { id: '5', name: 'Ciclo médio de vendas', unit: 'dias', source: 'crm', current: '34', target: '21', frequency: 'Mensal' },
]

const CRM_LIST: CRMConfig[] = [
  { id: 'hubspot', name: 'HubSpot', logo: '🟠', status: 'disconnected' },
  { id: 'pipedrive', name: 'Pipedrive', logo: '🟢', status: 'disconnected' },
  { id: 'salesforce', name: 'Salesforce', logo: '🔵', status: 'disconnected' },
  { id: 'rdstation', name: 'RD Station', logo: '🟣', status: 'disconnected' },
]

const DEFAULT_ALERTS: AlertTrigger[] = [
  { id: 'inatividade_crm', label: 'dias sem atividade no CRM → alerta de engajamento', enabled: true, value: '3', unit: 'dias' },
  { id: 'queda_conversao', label: '% de queda na conversão em', enabled: true, value: '20', value2: '14', unit: '%', unit2: 'dias' },
  { id: 'missao_expirando', label: 'dias antes do vencimento da missão → alerta', enabled: true, value: '2', unit: 'dias' },
  { id: 'bemestar_baixo', label: 'índice de bem-estar abaixo de', enabled: true, value: '2', unit: '/5 → alerta burnout' },
]

const DEFAULT_LEVEL_TITLES = [
  'Recruta', 'Prospector', 'Negociador', 'Hunter', 'Closer', 'Elite', 'Campeão', 'Lenda',
]

const CRM_FIELD_MAP = [
  { crm: 'deal.stage', platform: 'etapa_funil', used: 'KPI + missões' },
  { crm: 'activity.calls', platform: 'ligacoes_semana', used: 'KPI + streak' },
  { crm: 'deal.amount', platform: 'receita_vendas', used: 'comissão + ROI' },
  { crm: 'contact.owner', platform: 'vendedor_id', used: 'atribuição' },
  { crm: 'deal.close_date', platform: 'data_fechamento', used: 'ciclo de vendas' },
]

const FREQ_OPTIONS = ['Tempo real', 'A cada 15 min', 'Horária', 'Diária', 'Semanal', 'Mensal']
const SOURCE_OPTIONS: { value: KPI['source']; label: string }[] = [
  { value: 'crm', label: 'CRM (automático)' },
  { value: 'manual', label: 'Manual' },
  { value: 'planilha', label: 'Planilha' },
]

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative shrink-0 h-5 w-9 rounded-full transition-colors ${
        enabled ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default function CriteriosPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('kpis')
  const [kpis, setKpis] = useState<KPI[]>(DEFAULT_KPIS)
  const [crms, setCrms] = useState<CRMConfig[]>(CRM_LIST)
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [expandedCrm, setExpandedCrm] = useState<string | null>(null)

  const [commission, setCommission] = useState<CommissionConfig>({
    aliquota_base: '4',
    acelerador_threshold: '110',
    acelerador_rate: '6',
    bonus_missao: '100',
    periodo: 'mensal',
    elegibilidade: '80',
  })

  const [evaluationMode, setEvaluationMode] = useState<'automatic' | 'mixed' | 'manual'>('mixed')
  const [alerts, setAlerts] = useState<AlertTrigger[]>(DEFAULT_ALERTS)

  const [wellbeing, setWellbeing] = useState<WellbeingConfig>({
    frequencia_pulso: 'semanal',
    indice_critico: '2',
    ausencia_dias: '5',
  })

  const [gamification, setGamification] = useState<GamificationConfig>({
    ranking_publico: true,
    badges_no_feed: true,
    level_titles: [...DEFAULT_LEVEL_TITLES],
  })

  if (!user) return null

  const connectedCrm = crms.find((c) => c.status === 'connected')
  const enabledAlerts = alerts.filter((a) => a.enabled).length

  const handleConnectCRM = async (crmId: string) => {
    setConnecting(crmId)
    setCrms((prev) => prev.map((c) => (c.id === crmId ? { ...c, status: 'testing' } : c)))
    await new Promise((r) => setTimeout(r, 2000))
    setCrms((prev) =>
      prev.map((c) =>
        c.id === crmId
          ? { ...c, status: 'connected', lastSync: 'Agora', fields: 5 }
          : c.status === 'connected'
          ? { ...c, status: 'disconnected' }
          : c
      )
    )
    setConnecting(null)
    setExpandedCrm(crmId)
    toast.success(`${crms.find((c) => c.id === crmId)?.name} conectado com sucesso!`)
  }

  const handleDisconnect = (crmId: string) => {
    setCrms((prev) =>
      prev.map((c) =>
        c.id === crmId ? { ...c, status: 'disconnected', lastSync: undefined, fields: undefined } : c
      )
    )
    toast.success('CRM desconectado.')
  }

  const handleKpiChange = (id: string, field: keyof KPI, value: string) => {
    setKpis((prev) => prev.map((k) => (k.id === id ? { ...k, [field]: value } : k)))
  }

  const addKpi = () => {
    if (kpis.length >= 5) {
      toast.warning('Máximo de 5 KPIs prioritários atingido.')
      return
    }
    setKpis((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', unit: '', source: 'manual', current: '', target: '', frequency: 'Mensal' },
    ])
  }

  const removeKpi = (id: string) => setKpis((prev) => prev.filter((k) => k.id !== id))

  const sourceLabel = (source: KPI['source']) =>
    SOURCE_OPTIONS.find((o) => o.value === source)?.label ?? source

  // Commission preview calc
  const exampleRevenue = 25000
  const baseComm = Math.round(exampleRevenue * (parseFloat(commission.aliquota_base) / 100))
  const missionBonus = parseFloat(commission.bonus_missao) * 3 || 0
  const totalCommExample = baseComm + missionBonus

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'kpis', label: 'KPIs', icon: BarChart3 },
    { key: 'comissionamento', label: 'Comissão', icon: DollarSign },
    { key: 'avaliacoes', label: 'Avaliações', icon: ShieldCheck },
    { key: 'alertas', label: 'Alertas', icon: Bell },
    { key: 'bemestar', label: 'Bem-Estar', icon: Heart },
    { key: 'gamificacao', label: 'Gamificação', icon: Trophy },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30">
            Etapa 3
          </Badge>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Critérios & Configuração</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          KPIs, comissionamento, avaliações, alertas, bem-estar e gamificação
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border/50 p-3 text-center">
          <p className="text-2xl font-bold">{kpis.length}/5</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">KPIs Ativos</p>
        </div>
        <div className="rounded-lg border border-border/50 p-3 text-center">
          <p className="text-2xl font-bold text-primary">{commission.aliquota_base}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comissão Base</p>
        </div>
        <div className="rounded-lg border border-border/50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">{enabledAlerts}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gatilhos Ativos</p>
        </div>
        <div className="rounded-lg border border-border/50 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-500 capitalize text-sm leading-tight mt-1">
            {evaluationMode === 'automatic' ? 'Auto' : evaluationMode === 'mixed' ? 'Mista' : 'Manual'}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avaliação</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-full overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
              activeTab === key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── TAB: KPIs ─── */}
      {activeTab === 'kpis' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Máximo de <strong>5 KPIs prioritários</strong> vinculados a missões e comissões.
            </p>
            <Button size="sm" variant="outline" onClick={addKpi} disabled={kpis.length >= 5}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar KPI
            </Button>
          </div>

          <div className="space-y-3">
            {kpis.map((kpi) => {
              const isExpanded = expandedKpi === kpi.id
              const pct =
                kpi.current && kpi.target
                  ? Math.min(100, Math.round((parseFloat(kpi.current) / parseFloat(kpi.target)) * 100))
                  : 0

              return (
                <Card key={kpi.id} className="border-border/50">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/20 rounded-lg transition-colors"
                    onClick={() => setExpandedKpi(isExpanded ? null : kpi.id)}
                  >
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{kpi.name || 'Novo KPI'}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Atual: {kpi.current || '—'} {kpi.unit}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Meta: {kpi.target || '—'} {kpi.unit}
                        </span>
                        <Badge variant="secondary" className="text-[9px]">
                          {sourceLabel(kpi.source)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {pct > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16">
                            <Progress
                              value={pct}
                              className={`h-1.5 ${pct >= 80 ? '[&>div]:bg-emerald-500' : pct >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`}
                            />
                          </div>
                          <span className="text-[10px] font-medium">{pct}%</span>
                        </div>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 px-4 border-t border-border/30">
                      <div className="grid gap-3 sm:grid-cols-2 mt-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nome do Indicador</Label>
                          <Input
                            value={kpi.name}
                            onChange={(e) => handleKpiChange(kpi.id, 'name', e.target.value)}
                            placeholder="Ex: Taxa de conversão"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Unidade</Label>
                          <Input
                            value={kpi.unit}
                            onChange={(e) => handleKpiChange(kpi.id, 'unit', e.target.value)}
                            placeholder="Ex: %, R$, dias"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Valor Atual</Label>
                          <Input
                            value={kpi.current}
                            onChange={(e) => handleKpiChange(kpi.id, 'current', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Meta</Label>
                          <Input
                            value={kpi.target}
                            onChange={(e) => handleKpiChange(kpi.id, 'target', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Fonte dos Dados</Label>
                          <select
                            value={kpi.source}
                            onChange={(e) => handleKpiChange(kpi.id, 'source', e.target.value)}
                            className="w-full h-8 text-sm rounded-md border border-input bg-background px-3 py-1"
                          >
                            {SOURCE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Frequência</Label>
                          <select
                            value={kpi.frequency}
                            onChange={(e) => handleKpiChange(kpi.id, 'frequency', e.target.value)}
                            className="w-full h-8 text-sm rounded-md border border-input bg-background px-3 py-1"
                          >
                            {FREQ_OPTIONS.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs h-7"
                          onClick={() => removeKpi(kpi.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remover KPI
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>

          <Button className="w-full" onClick={() => toast.success('KPIs salvos com sucesso!')}>
            Salvar Configuração de KPIs
          </Button>
        </div>
      )}

      {/* ─── TAB: COMISSIONAMENTO ─── */}
      {activeTab === 'comissionamento' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure as regras de comissionamento que se aplicam a toda a equipe.
          </p>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Alíquota Base e Acelerador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota Base (%)</Label>
                  <Input
                    type="number"
                    value={commission.aliquota_base}
                    onChange={(e) => setCommission((prev) => ({ ...prev, aliquota_base: e.target.value }))}
                    placeholder="Ex: 4"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bônus por Missão Concluída (R$)</Label>
                  <Input
                    type="number"
                    value={commission.bonus_missao}
                    onChange={(e) => setCommission((prev) => ({ ...prev, bonus_missao: e.target.value }))}
                    placeholder="Ex: 100"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-accent/20 p-3 space-y-2">
                <p className="text-xs font-medium">Acelerador de Meta</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Se atingir</span>
                  <Input
                    type="number"
                    value={commission.acelerador_threshold}
                    onChange={(e) => setCommission((prev) => ({ ...prev, acelerador_threshold: e.target.value }))}
                    className="h-7 text-xs w-16"
                  />
                  <span className="text-xs text-muted-foreground">% da meta → alíquota sobe para</span>
                  <Input
                    type="number"
                    value={commission.acelerador_rate}
                    onChange={(e) => setCommission((prev) => ({ ...prev, acelerador_rate: e.target.value }))}
                    className="h-7 text-xs w-16"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Período de Apuração</Label>
                  <div className="flex gap-1.5">
                    {(['mensal', 'quinzenal', 'semanal'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setCommission((prev) => ({ ...prev, periodo: p }))}
                        className={`flex-1 text-xs py-1.5 rounded-md border transition-colors capitalize ${
                          commission.periodo === p
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-accent/40'
                        }`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Elegibilidade (% mínimo da meta)</Label>
                  <Input
                    type="number"
                    value={commission.elegibilidade}
                    onChange={(e) => setCommission((prev) => ({ ...prev, elegibilidade: e.target.value }))}
                    placeholder="Ex: 80"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                Exemplo de Comissão Este Mês
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receita fechada (exemplo)</span>
                  <span className="font-medium">R$ {exampleRevenue.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comissão base ({commission.aliquota_base}%)</span>
                  <span className="font-medium">R$ {baseComm.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bônus de missões (3 missões)</span>
                  <span className="font-medium">R$ {missionBonus.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-1.5 mt-1.5">
                  <span className="font-semibold">Total estimado</span>
                  <span className="font-bold text-primary">R$ {totalCommExample.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={() => toast.success('Comissionamento salvo com sucesso!')}>
            Salvar Configuração de Comissão
          </Button>
        </div>
      )}

      {/* ─── TAB: AVALIAÇÃO DE MISSÕES ─── */}
      {activeTab === 'avaliacoes' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina como as missões são avaliadas e quais eventos do CRM disparam conclusão automática.
          </p>

          <div className="space-y-3">
            {[
              {
                id: 'automatic' as const,
                title: 'Automática',
                desc: 'CRM registra o evento → missão concluída automaticamente. Zero trabalho manual para o gestor.',
                icon: Zap,
                color: 'emerald',
              },
              {
                id: 'mixed' as const,
                title: 'Mista',
                desc: 'CRM registra o evento + gestor valida a qualidade antes de concluir. Equilíbrio entre automação e controle.',
                icon: Settings2,
                color: 'blue',
              },
              {
                id: 'manual' as const,
                title: 'Manual',
                desc: 'Gestor confirma a conclusão diretamente na plataforma. Máximo controle, mais trabalho.',
                icon: CheckCircle2,
                color: 'amber',
              },
            ].map((mode) => {
              const Icon = mode.icon
              const isSelected = evaluationMode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => setEvaluationMode(mode.id)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    isSelected
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/40 hover:border-border hover:bg-accent/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary/10' : 'bg-muted'
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{mode.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  </div>
                </button>
              )
            })}
          </div>

          {evaluationMode === 'automatic' && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-3">
                  Eventos CRM que disparam conclusão
                </p>
                <div className="space-y-2">
                  {[
                    { event: 'deal.stage = "fechado_ganho"', label: 'Deal fechado', type: 'RESULTADO' },
                    { event: 'activity.calls_count >= N', label: 'Volume de ligações', type: 'ATIVIDADE' },
                    { event: 'activity.crm_updates >= 7 (streak)', label: 'Atualização diária', type: 'HÁBITO' },
                    { event: 'deal.amount >= meta', label: 'KPI de receita atingido', type: 'RESULTADO' },
                  ].map((ev, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <code className="font-mono text-emerald-600 text-[11px] flex-1 bg-emerald-500/10 px-2 py-1 rounded">
                        {ev.event}
                      </code>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <Badge variant="secondary" className="text-[9px] shrink-0">{ev.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button className="w-full" onClick={() => toast.success('Modo de avaliação salvo!')}>
            Salvar Modo de Avaliação
          </Button>
        </div>
      )}

      {/* ─── TAB: ALERTAS ─── */}
      {activeTab === 'alertas' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure os gatilhos que notificam o gestor sobre riscos no engajamento e performance.
          </p>

          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert.id} className={`border-border/50 transition-all ${!alert.enabled ? 'opacity-60' : ''}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Toggle
                      enabled={alert.enabled}
                      onChange={(v) =>
                        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, enabled: v } : a)))
                      }
                    />
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        value={alert.value}
                        onChange={(e) =>
                          setAlerts((prev) =>
                            prev.map((a) => (a.id === alert.id ? { ...a, value: e.target.value } : a))
                          )
                        }
                        className="h-7 w-16 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">{alert.unit}</span>
                      {alert.value2 !== undefined && (
                        <>
                          <Input
                            type="number"
                            value={alert.value2}
                            onChange={(e) =>
                              setAlerts((prev) =>
                                prev.map((a) => (a.id === alert.id ? { ...a, value2: e.target.value } : a))
                              )
                            }
                            className="h-7 w-16 text-xs"
                          />
                          {alert.unit2 && (
                            <span className="text-xs text-muted-foreground">{alert.unit2}</span>
                          )}
                        </>
                      )}
                      <span className="text-xs text-muted-foreground">{alert.label}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>{enabledAlerts} gatilho(s) ativo(s).</strong> Alertas são enviados por
                notificação na plataforma e por e-mail quando configurado.
              </p>
            </div>
          </div>

          <Button className="w-full" onClick={() => toast.success('Gatilhos salvos com sucesso!')}>
            Salvar Gatilhos de Alerta
          </Button>
        </div>
      )}

      {/* ─── TAB: BEM-ESTAR ─── */}
      {activeTab === 'bemestar' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <div className="flex items-start gap-2">
              <Heart className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Atenção:</strong> Gamificação de volume sobre alguém em burnout piora o problema.
                Configure os limites de bem-estar para proteger sua equipe.
              </p>
            </div>
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pesquisa de Pulso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Frequência da Pesquisa de Pulso</Label>
                <div className="flex gap-2">
                  {(['semanal', 'quinzenal'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setWellbeing((prev) => ({ ...prev, frequencia_pulso: f }))}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                        wellbeing.frequencia_pulso === f
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-accent/40'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Limites de Proteção</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Índice Crítico de Bem-Estar</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Se bem-estar cair abaixo de</span>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={wellbeing.indice_critico}
                    onChange={(e) => setWellbeing((prev) => ({ ...prev, indice_critico: e.target.value }))}
                    className="h-7 w-14 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    /5 → pausa missões de volume automaticamente
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ausência Prolongada</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Se ficar</span>
                  <Input
                    type="number"
                    value={wellbeing.ausencia_dias}
                    onChange={(e) => setWellbeing((prev) => ({ ...prev, ausencia_dias: e.target.value }))}
                    className="h-7 w-14 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    dias sem logar → notifica gestor antes de qualquer ação
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={() => toast.success('Configurações de bem-estar salvas!')}>
            Salvar Configurações de Bem-Estar
          </Button>
        </div>
      )}

      {/* ─── TAB: GAMIFICAÇÃO ─── */}
      {activeTab === 'gamificacao' && (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Visibilidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Ranking Público</p>
                  <p className="text-xs text-muted-foreground">
                    {gamification.ranking_publico
                      ? 'Todos os colaboradores veem o ranking completo'
                      : 'Cada um vê apenas a própria posição'}
                  </p>
                </div>
                <Toggle
                  enabled={gamification.ranking_publico}
                  onChange={(v) => setGamification((prev) => ({ ...prev, ranking_publico: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Badges no Feed</p>
                  <p className="text-xs text-muted-foreground">
                    {gamification.badges_no_feed
                      ? 'Conquistas aparecem no feed da equipe'
                      : 'Conquistas aparecem apenas no perfil individual'}
                  </p>
                </div>
                <Toggle
                  enabled={gamification.badges_no_feed}
                  onChange={(v) => setGamification((prev) => ({ ...prev, badges_no_feed: v }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Títulos dos Níveis de XP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {gamification.level_titles.map((title, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {i + 1}
                    </div>
                    <Input
                      value={title}
                      onChange={(e) =>
                        setGamification((prev) => {
                          const titles = [...prev.level_titles]
                          titles[i] = e.target.value
                          return { ...prev, level_titles: titles }
                        })
                      }
                      className="h-7 text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {i === 0
                        ? '0 XP'
                        : i === 1
                        ? '500 XP'
                        : i === 2
                        ? '1.5k XP'
                        : i === 3
                        ? '3k XP'
                        : i === 4
                        ? '5.5k XP'
                        : i === 5
                        ? '9k XP'
                        : i === 6
                        ? '14k XP'
                        : '21k XP'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Personalize os títulos para refletir a cultura da sua empresa.
              </p>
            </CardContent>
          </Card>

          <div className="rounded-lg border border-border/40 bg-accent/20 p-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Para configurar recompensas disponíveis na loja, acesse a{' '}
                <strong>Loja de Recompensas</strong> no menu do vendedor.
              </p>
            </div>
          </div>

          <Button className="w-full" onClick={() => toast.success('Configurações de gamificação salvas!')}>
            Salvar Configurações de Gamificação
          </Button>
        </div>
      )}
    </div>
  )
}
