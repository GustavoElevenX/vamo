'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Brain,
  Eye,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'

type AlertSeverity = 'critical' | 'warning' | 'opportunity' | 'positive'

interface AIAlert {
  id: string
  organization_id: string
  type: string
  severity: AlertSeverity
  title: string
  description: string | null
  entity_type: string | null
  entity_id: string | null
  entity_name?: string | null
  quick_action: string | null
  read: boolean
  created_at: string
}

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

const ACTION_LABELS: Record<string, string> = {
  contact: 'Contatar',
  assign_mission: 'Atribuir Missão',
  award_xp: 'Dar XP',
  review_kpi: 'Revisar KPI',
  chat: 'Falar com a IA',
}

type FilterTab = 'all' | 'critical' | 'warning' | 'opportunity' | 'positive'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days > 1 ? 's' : ''}`
}

export default function AlertasPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [alerts, setAlerts] = useState<AIAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/alerts')
      if (!res.ok) throw new Error('Erro ao carregar alertas')
      const data = await res.json()
      setAlerts(data.alerts || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  const generateAlerts = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/alerts/generate', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao gerar alertas')
      }
      await loadAlerts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  // Se não há alertas e não estamos carregando, gerar automaticamente
  useEffect(() => {
    if (!loading && alerts.length === 0 && !generating && !error) {
      generateAlerts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const markAsRead = async (id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a))
    await fetch('/api/ai/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: id }),
    })
  }

  const markAllRead = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
    await fetch('/api/ai/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
  }

  const handleAction = (alert: AIAlert) => {
    if (!alert.quick_action) return
    markAsRead(alert.id)

    const name = alert.entity_name || 'vendedor'
    switch (alert.quick_action) {
      case 'contact':
        if (alert.entity_id) router.push(`/equipe/${alert.entity_id}`)
        else router.push('/equipe')
        break
      case 'assign_mission':
        // Navegar para chat com prompt pré-preenchido
        sessionStorage.setItem('chat_prefill', `Crie uma missão para ${name} baseada no que está acontecendo: ${alert.title}`)
        router.push('/chat-ia')
        break
      case 'award_xp':
        sessionStorage.setItem('chat_prefill', `Dê XP de bônus para ${name}: ${alert.title}`)
        router.push('/chat-ia')
        break
      case 'review_kpi':
        router.push('/kpis')
        break
      case 'chat':
        sessionStorage.setItem('chat_prefill', alert.title)
        router.push('/chat-ia')
        break
    }
  }

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

  return (
    <div className="space-y-6">
      <PageHeader
        label="Monitoramento · IA"
        title={<>Alertas <TitleHighlight>VAMO IA</TitleHighlight></>}
        description="Insights proativos gerados a partir de dados reais da sua equipe"
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="text-xs" onClick={markAllRead}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                Marcar todos lidos
              </Button>
            )}
            <Button
              size="sm"
              className="text-xs"
              onClick={generateAlerts}
              disabled={generating}
            >
              {generating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Atualizar alertas
                </>
              )}
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      {!loading && alerts.length > 0 && (
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
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-border/50 bg-muted/20 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && alerts.length === 0 && !generating && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum alerta ainda.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Clique em &ldquo;Atualizar alertas&rdquo; para gerar insights baseados na sua equipe.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Alert Feed */}
      {!loading && (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const config = severityConfig[alert.severity]
            const Icon = config.icon
            const actionLabel = alert.quick_action ? ACTION_LABELS[alert.quick_action] : null

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
                      {alert.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {alert.description}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">{timeAgo(alert.created_at)}</p>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      {actionLabel && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-7 px-2"
                          onClick={() => handleAction(alert)}
                        >
                          {actionLabel}
                        </Button>
                      )}
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
      )}
    </div>
  )
}
