'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, XCircle,
  Webhook, Plus, Send, Clock, BarChart3,
} from 'lucide-react'

type IntegrationStatus = 'connected' | 'attention' | 'disconnected'

interface Integration {
  id: string
  name: string
  status: IntegrationStatus
  lastSync: string
  errorCount: number
  color: string
  iconLetter: string
}

interface WebhookConfig {
  id: string
  url: string
  events: string[]
  active: boolean
  lastDelivery: string
  successRate: string
}

interface IntegrationError {
  id: number
  timestamp: string
  provider: string
  message: string
}

const INTEGRATIONS: Integration[] = [
  { id: 'hubspot', name: 'HubSpot', status: 'connected', lastSync: 'há 5 min', errorCount: 0, color: 'bg-orange-500', iconLetter: 'H' },
  { id: 'pipedrive', name: 'Pipedrive', status: 'attention', lastSync: 'há 2h', errorCount: 3, color: 'bg-emerald-600', iconLetter: 'P' },
  { id: 'salesforce', name: 'Salesforce', status: 'disconnected', lastSync: 'nunca', errorCount: 0, color: 'bg-blue-500', iconLetter: 'S' },
  { id: 'rdstation', name: 'RD Station', status: 'connected', lastSync: 'há 15 min', errorCount: 1, color: 'bg-violet-500', iconLetter: 'R' },
]

const WEBHOOKS: WebhookConfig[] = [
  {
    id: 'wh-1',
    url: 'https://api.example.com/motiva/events',
    events: ['mission.completed', 'badge.earned'],
    active: true,
    lastDelivery: 'há 2 min',
    successRate: '98%',
  },
  {
    id: 'wh-2',
    url: 'https://hooks.slack.com/xxx',
    events: ['alert.created'],
    active: true,
    lastDelivery: 'há 10 min',
    successRate: '100%',
  },
  {
    id: 'wh-3',
    url: 'https://erp.empresa.com/webhook',
    events: ['commission.calculated'],
    active: false,
    lastDelivery: 'há 3 dias',
    successRate: 'N/A',
  },
]

const RECENT_ERRORS: IntegrationError[] = [
  { id: 1, timestamp: '14:32:07', provider: 'Pipedrive', message: 'API rate limit exceeded - 429 Too Many Requests' },
  { id: 2, timestamp: '14:28:55', provider: 'Pipedrive', message: 'Connection timeout after 30s - endpoint /deals' },
  { id: 3, timestamp: '13:45:22', provider: 'Pipedrive', message: 'Invalid API token - re-authentication required' },
  { id: 4, timestamp: '12:10:33', provider: 'RD Station', message: 'Webhook payload rejected - missing required field "contact_id"' },
  { id: 5, timestamp: '10:05:17', provider: 'HubSpot', message: 'Partial sync failure - 2 contacts skipped due to duplicate email' },
]

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; color: string; icon: React.ElementType }> = {
  connected: { label: 'Conectado', color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  attention: { label: 'Atenção', color: 'bg-amber-500/10 text-amber-600', icon: AlertTriangle },
  disconnected: { label: 'Desconectado', color: 'bg-red-500/10 text-red-600', icon: XCircle },
}

export default function IntegracoesPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [syncing, setSyncing] = useState<string | null>(null)

  if (!user) return null

  const handleSync = async (integrationId: string) => {
    setSyncing(integrationId)
    await new Promise((r) => setTimeout(r, 1500))
    setSyncing(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Integrações API</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Health dashboard e webhooks</p>
      </div>

      {/* Integration Health Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => {
          const statusConfig = STATUS_CONFIG[integration.status]
          const StatusIcon = statusConfig.icon
          const isSyncing = syncing === integration.id

          return (
            <Card key={integration.id} className="border-border/50">
              <CardContent className="pt-5 pb-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${integration.color} flex items-center justify-center`}>
                      <span className="text-sm font-bold text-white">{integration.iconLetter}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{integration.name}</p>
                      <Badge className={`text-[9px] border-0 mt-0.5 ${statusConfig.color}`}>
                        <StatusIcon className="h-2.5 w-2.5 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </div>
                  {integration.errorCount > 0 && (
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30">
                      {integration.errorCount} erros
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Último sync: {integration.lastSync}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1.5"
                    disabled={isSyncing || integration.status === 'disconnected'}
                    onClick={() => handleSync(integration.id)}
                  >
                    <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Sync Manual'}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                    <BarChart3 className="h-3 w-3" />
                    Ver Logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Webhooks Section */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Webhooks Configurados</CardTitle>
            </div>
            <Button size="sm" className="h-7 text-xs gap-1.5">
              <Plus className="h-3 w-3" />
              Adicionar Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">URL</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Eventos</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Última entrega</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Sucesso</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {WEBHOOKS.map((webhook) => (
                  <tr key={webhook.id} className="border-b border-border/30 last:border-0">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[200px]">
                          {webhook.url}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-[9px] px-1.5">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <Badge className={`text-[9px] border-0 ${webhook.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                        {webhook.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground">{webhook.lastDelivery}</td>
                    <td className="py-2.5 px-2">
                      <span className={webhook.successRate === 'N/A' ? 'text-muted-foreground' : 'font-medium text-foreground'}>
                        {webhook.successRate}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
                        <Send className="h-2.5 w-2.5" />
                        Testar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Integration Errors */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <CardTitle className="text-base">Últimos Erros de Integração</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {RECENT_ERRORS.map((error) => (
            <div
              key={error.id}
              className="flex items-start gap-3 rounded-lg border border-red-500/10 bg-red-500/5 px-3 py-2.5"
            >
              <span className="text-[11px] font-mono text-muted-foreground shrink-0 mt-0.5 w-14">
                {error.timestamp}
              </span>
              <Badge variant="outline" className="text-[9px] shrink-0 border-red-500/30 text-red-500">
                {error.provider}
              </Badge>
              <span className="text-xs text-muted-foreground leading-relaxed">
                {error.message}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
