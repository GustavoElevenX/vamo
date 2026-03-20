'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Link2,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  Database,
  Gauge,
  ArrowRight,
  Zap,
  Activity,
} from 'lucide-react'

interface Integration {
  id: string
  name: string
  color: string
  iconBg: string
  connected: boolean
  lastSync?: string
  recordsImported?: number
  latency?: string
  health?: 'healthy' | 'degraded' | 'down'
}

interface FieldMapping {
  crmField: string
  motivaField: string
  description: string
}

const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    color: 'text-orange-600',
    iconBg: 'bg-orange-500/10',
    connected: true,
    lastSync: '19/03/2026, 14:32',
    recordsImported: 1247,
    latency: '120ms',
    health: 'healthy',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    color: 'text-green-600',
    iconBg: 'bg-green-500/10',
    connected: false,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    color: 'text-blue-600',
    iconBg: 'bg-blue-500/10',
    connected: true,
    lastSync: '19/03/2026, 13:50',
    recordsImported: 832,
    latency: '250ms',
    health: 'degraded',
  },
  {
    id: 'rdstation',
    name: 'RD Station',
    color: 'text-violet-600',
    iconBg: 'bg-violet-500/10',
    connected: false,
  },
]

const FIELD_MAPPINGS: FieldMapping[] = [
  { crmField: 'deal.stage', motivaField: 'etapa_funil', description: 'Etapa do funil de vendas' },
  { crmField: 'activity.calls', motivaField: 'ligacoes_semana', description: 'Ligações realizadas na semana' },
  { crmField: 'deal.amount', motivaField: 'receita_vendas', description: 'Valor da receita de vendas' },
]

function HealthIndicator({ health }: { health: 'healthy' | 'degraded' | 'down' }) {
  const config = {
    healthy: { color: 'text-emerald-500', label: 'Saudável', bg: 'bg-emerald-500/10' },
    degraded: { color: 'text-amber-500', label: 'Degradado', bg: 'bg-amber-500/10' },
    down: { color: 'text-red-500', label: 'Offline', bg: 'bg-red-500/10' },
  }
  const { color, label, bg } = config[health]
  return (
    <Badge className={`text-[10px] h-5 px-2 ${bg} ${color} border-0`}>
      <Activity className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  )
}

export default function IntegracoesPage() {
  const { user } = useAuth()
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS)
  const [syncFrequency, setSyncFrequency] = useState('15min')
  const [syncing, setSyncing] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)

  if (!user) return null

  const handleConnect = async (id: string) => {
    setConnecting(id)
    // Simulate OAuth flow
    await new Promise((r) => setTimeout(r, 1500))
    setIntegrations(
      integrations.map((i) =>
        i.id === id
          ? {
              ...i,
              connected: true,
              lastSync: 'Agora',
              recordsImported: 0,
              latency: '—',
              health: 'healthy' as const,
            }
          : i
      )
    )
    setConnecting(null)
  }

  const handleForceSync = async (id: string) => {
    setSyncing(id)
    await new Promise((r) => setTimeout(r, 2000))
    setSyncing(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Integrações</h2>
            <Badge variant="outline" className="text-[10px] h-5 px-2">
              Etapa 3
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conecte seu CRM para sincronizar dados automaticamente
          </p>
        </div>
      </div>

      {/* CRM Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id} className="border-border/50">
            <CardContent className="pt-5 pb-4 space-y-4">
              {/* Top row: icon + name + status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl ${integration.iconBg} flex items-center justify-center`}>
                    <Database className={`h-5 w-5 ${integration.color}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{integration.name}</p>
                    <p className="text-[11px] text-muted-foreground">CRM</p>
                  </div>
                </div>
                <Badge
                  className={`text-[10px] h-5 px-2 border-0 ${
                    integration.connected
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {integration.connected ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <Circle className="h-3 w-3 mr-1" />
                      Desconectado
                    </>
                  )}
                </Badge>
              </div>

              {/* Connected details */}
              {integration.connected ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Último sync</span>
                      </div>
                      <p className="text-xs font-medium">{integration.lastSync}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Database className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Registros</span>
                      </div>
                      <p className="text-xs font-medium">
                        {integration.recordsImported?.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Gauge className="h-3 w-3" />
                        {integration.latency}
                      </div>
                      {integration.health && <HealthIndicator health={integration.health} />}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={syncing === integration.id}
                      onClick={() => handleForceSync(integration.id)}
                    >
                      <RefreshCw
                        className={`h-3 w-3 mr-1.5 ${syncing === integration.id ? 'animate-spin' : ''}`}
                      />
                      {syncing === integration.id ? 'Sincronizando...' : 'Forçar Sync'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full h-8 text-xs"
                  disabled={connecting === integration.id}
                  onClick={() => handleConnect(integration.id)}
                >
                  {connecting === integration.id ? (
                    <span className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full border border-white border-t-transparent animate-spin" />
                      Conectando...
                    </span>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      Conectar
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Field Mapping */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Mapeamento de Campos</h3>
        <Card className="border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Campo CRM</TableHead>
                  <TableHead className="text-xs w-10" />
                  <TableHead className="text-xs">Campo Motiva</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FIELD_MAPPINGS.map((mapping) => (
                  <TableRow key={mapping.crmField}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {mapping.crmField}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium">
                      {mapping.motivaField}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                      {mapping.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Sync Frequency */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Frequência de Sincronização</h3>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Label className="text-xs text-muted-foreground shrink-0">
                Sincronizar dados a cada:
              </Label>
              <Select value={syncFrequency} onValueChange={(v) => v && setSyncFrequency(v)}>
                <SelectTrigger className="w-full sm:w-52 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Tempo real</SelectItem>
                  <SelectItem value="15min">A cada 15 min</SelectItem>
                  <SelectItem value="scheduled">Agendada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Sync Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => handleForceSync('all')}
          disabled={syncing !== null}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
          Forçar Sync Manual
        </Button>
      </div>
    </div>
  )
}
