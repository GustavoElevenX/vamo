'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Brain,
  Bell,
  Eye,
  MessageCircle,
  Target,
  Users,
  BarChart3,
  Flame,
} from 'lucide-react'

type AlertSeverity = 'critical' | 'warning' | 'opportunity' | 'positive'

interface AIAlert {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  timestamp: string
  read: boolean
  action: string
}

const ALERTS: AIAlert[] = [
  {
    id: '1',
    severity: 'critical',
    title: 'João Silva não acessa o CRM há 5 dias',
    description: 'Último acesso em 14/03/2026. Risco de desengajamento identificado pela VAMO IA. Recomendação: contato direto.',
    timestamp: 'Há 2 horas',
    read: false,
    action: 'Contatar',
  },
  {
    id: '2',
    severity: 'critical',
    title: 'Meta mensal em risco — equipe em 45% da meta',
    description: 'Com 60% do mês decorrido, a equipe atingiu apenas 45% da meta. Projeção atual: 75% ao final do mês.',
    timestamp: 'Há 3 horas',
    read: false,
    action: 'Ver Projeção',
  },
  {
    id: '3',
    severity: 'warning',
    title: '3 vendedores sem missão ativa',
    description: 'Carlos, Fernanda e Lucas estão sem missões atribuídas há 2+ dias. Atribuir missões mantém o engajamento.',
    timestamp: 'Há 5 horas',
    read: false,
    action: 'Atribuir Missões',
  },
  {
    id: '4',
    severity: 'warning',
    title: 'Taxa de conversão caiu 15% esta semana',
    description: 'A taxa de conversão de propostas caiu de 32% para 27%. Possível causa: aumento de leads frios no pipeline.',
    timestamp: 'Há 8 horas',
    read: true,
    action: 'Analisar',
  },
  {
    id: '5',
    severity: 'opportunity',
    title: 'Cliente X mostrou interesse em upgrade',
    description: 'Cliente acessou página de planos 3x esta semana. Oportunidade de upsell estimada em R$ 4.200/mês.',
    timestamp: 'Há 1 dia',
    read: false,
    action: 'Ver Oportunidade',
  },
  {
    id: '6',
    severity: 'opportunity',
    title: 'Padrão detectado: vendas sobem às terças',
    description: 'Análise de 90 dias mostra que terças-feiras têm 23% mais fechamentos. Considere concentrar follow-ups nesse dia.',
    timestamp: 'Há 1 dia',
    read: true,
    action: 'Ver Padrão',
  },
  {
    id: '7',
    severity: 'positive',
    title: 'Maria atingiu 120% da meta',
    description: 'Parabéns! Maria superou a meta mensal com 12 dias de antecedência. Considere reconhecimento público.',
    timestamp: 'Há 2 dias',
    read: true,
    action: 'Reconhecer',
  },
  {
    id: '8',
    severity: 'positive',
    title: 'Streak recorde: Ana com 15 dias consecutivos',
    description: 'Ana completou missões por 15 dias seguidos — novo recorde da equipe. Engajamento exemplar.',
    timestamp: 'Há 2 dias',
    read: false,
    action: 'Parabenizar',
  },
]

const severityConfig = {
  critical: {
    label: 'Crítico',
    icon: AlertTriangle,
    borderColor: 'border-l-red-500',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/5',
    badgeColor: 'text-red-500 bg-red-500/10',
  },
  warning: {
    label: 'Atenção',
    icon: AlertCircle,
    borderColor: 'border-l-amber-500',
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-500/5',
    badgeColor: 'text-amber-500 bg-amber-500/10',
  },
  opportunity: {
    label: 'Oportunidade',
    icon: TrendingUp,
    borderColor: 'border-l-blue-500',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/5',
    badgeColor: 'text-blue-500 bg-blue-500/10',
  },
  positive: {
    label: 'Positivo',
    icon: CheckCircle2,
    borderColor: 'border-l-emerald-500',
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/5',
    badgeColor: 'text-emerald-500 bg-emerald-500/10',
  },
}

type FilterTab = 'all' | 'critical' | 'warning' | 'opportunity' | 'positive'

export default function AlertasPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [alerts, setAlerts] = useState<AIAlert[]>(ALERTS)

  if (!user) return null

  const unreadCount = alerts.filter((a) => !a.read).length

  const filteredAlerts = activeTab === 'all'
    ? alerts
    : alerts.filter((a) => a.severity === activeTab)

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: alerts.length },
    { key: 'critical', label: 'Críticos', count: alerts.filter((a) => a.severity === 'critical').length },
    { key: 'warning', label: 'Atenção', count: alerts.filter((a) => a.severity === 'warning').length },
    { key: 'opportunity', label: 'Oportunidade', count: alerts.filter((a) => a.severity === 'opportunity').length },
    { key: 'positive', label: 'Positivos', count: alerts.filter((a) => a.severity === 'positive').length },
  ]

  const markAsRead = (id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            Alertas da VAMO IA
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white text-[10px] h-5 min-w-5 flex items-center justify-center">
                {unreadCount}
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Insights e alertas gerados automaticamente pela VAMO IA
          </p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Brain className="h-5 w-5 text-violet-500" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 min-w-4">
              {tab.count}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Alert Feed */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => {
          const config = severityConfig[alert.severity]
          const Icon = config.icon

          return (
            <Card
              key={alert.id}
              className={`border-border/50 border-l-4 ${config.borderColor} ${!alert.read ? config.bgColor : ''} transition-colors`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg ${config.badgeColor} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`h-4 w-4 ${config.iconColor}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-medium ${!alert.read ? '' : 'text-muted-foreground'}`}>
                        {alert.title}
                      </p>
                      {!alert.read && (
                        <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">{alert.timestamp}</p>
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="text-[10px] h-7 px-2">
                      {alert.action}
                    </Button>
                    {!alert.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-7 px-2"
                        onClick={() => markAsRead(alert.id)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Marcar lido
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
