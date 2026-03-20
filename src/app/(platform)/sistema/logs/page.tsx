'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Activity, CheckCircle2, Clock, AlertTriangle, XCircle,
  Search, Download, RefreshCw, Server, Shield, Cpu, Webhook,
} from 'lucide-react'

type LogLevel = 'error' | 'warn' | 'info' | 'debug'
type LogSource = 'api' | 'auth' | 'sync' | 'ai' | 'webhook'

interface LogEntry {
  id: number
  timestamp: string
  level: LogLevel
  source: LogSource
  message: string
}

const STATIC_LOGS: LogEntry[] = [
  { id: 1, timestamp: '14:32:07', level: 'error', source: 'auth', message: 'Failed login attempt from IP 192.168.1.45 - invalid credentials' },
  { id: 2, timestamp: '14:31:54', level: 'warn', source: 'sync', message: 'HubSpot sync delayed - retrying in 30s' },
  { id: 3, timestamp: '14:31:42', level: 'info', source: 'ai', message: 'Mission generation completed for org_abc - 7 missions created' },
  { id: 4, timestamp: '14:31:30', level: 'info', source: 'api', message: 'POST /api/ai/diagnostic - 200 OK (234ms)' },
  { id: 5, timestamp: '14:31:18', level: 'warn', source: 'webhook', message: 'Webhook delivery failed to https://example.com/hook - timeout' },
  { id: 6, timestamp: '14:30:55', level: 'error', source: 'sync', message: 'Pipedrive API rate limit exceeded - backing off 60s' },
  { id: 7, timestamp: '14:30:41', level: 'info', source: 'auth', message: 'User maria@empresa.com logged in successfully' },
  { id: 8, timestamp: '14:30:22', level: 'debug', source: 'api', message: 'Cache hit for leaderboard query - org_abc' },
  { id: 9, timestamp: '14:29:58', level: 'info', source: 'ai', message: 'Diagnostic report generated - session_id: ds_7f3k2m' },
  { id: 10, timestamp: '14:29:45', level: 'info', source: 'api', message: 'GET /api/missions/active - 200 OK (89ms)' },
  { id: 11, timestamp: '14:29:30', level: 'warn', source: 'sync', message: 'RD Station webhook payload validation warning - missing field "deal_value"' },
  { id: 12, timestamp: '14:29:12', level: 'debug', source: 'api', message: 'Rate limiter check passed - org_abc: 847/1000 req/min' },
  { id: 13, timestamp: '14:28:55', level: 'info', source: 'webhook', message: 'Webhook delivered to https://hooks.slack.com/xxx - 200 OK' },
  { id: 14, timestamp: '14:28:33', level: 'error', source: 'ai', message: 'OpenRouter API timeout - fallback to Llama 3.1 70B' },
  { id: 15, timestamp: '14:28:10', level: 'info', source: 'auth', message: 'Token refreshed for user carlos@empresa.com' },
]

const LEVEL_CONFIG: Record<LogLevel, { color: string; icon: React.ElementType }> = {
  error: { color: 'bg-red-500/10 text-red-600', icon: XCircle },
  warn: { color: 'bg-amber-500/10 text-amber-600', icon: AlertTriangle },
  info: { color: 'bg-blue-500/10 text-blue-600', icon: CheckCircle2 },
  debug: { color: 'bg-muted text-muted-foreground', icon: Cpu },
}

const SOURCE_LABELS: Record<LogSource, string> = {
  api: 'API',
  auth: 'Auth',
  sync: 'Sync',
  ai: 'AI',
  webhook: 'Webhook',
}

export default function SystemLogsPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [filterLevel, setFilterLevel] = useState<'all' | LogLevel>('all')
  const [filterSource, setFilterSource] = useState<'all' | LogSource>('all')
  const [searchQuery, setSearchQuery] = useState('')

  if (!user) return null

  const filteredLogs = STATIC_LOGS.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false
    if (filterSource !== 'all' && log.source !== filterSource) return false
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Logs do Sistema</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Monitoramento em tempo real</p>
      </div>

      {/* API Health Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge className="text-[10px] border-0 bg-emerald-500/10 text-emerald-600">Operacional</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-4.5 w-4.5 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Uptime</p>
                <p className="text-lg font-bold leading-tight mt-0.5">99.8%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Server className="h-4.5 w-4.5 text-violet-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Requests/hora</p>
                <p className="text-lg font-bold leading-tight mt-0.5">1,247</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground leading-none">Taxa de erro</p>
                <p className="text-lg font-bold leading-tight mt-0.5">0.3%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Buscar nos logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value as any)}
                className="h-8 text-sm rounded-md border border-input bg-background px-3"
              >
                <option value="all">Todos os Níveis</option>
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as any)}
                className="h-8 text-sm rounded-md border border-input bg-background px-3"
              >
                <option value="all">Todas as Fontes</option>
                <option value="api">API</option>
                <option value="auth">Auth</option>
                <option value="sync">Sync</option>
                <option value="ai">AI</option>
                <option value="webhook">Webhook</option>
              </select>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Feed */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Log Feed</CardTitle>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground">Atualizado há 5s</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum log encontrado com os filtros selecionados.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const levelConfig = LEVEL_CONFIG[log.level]
              const LevelIcon = levelConfig.icon
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border border-border/30 px-3 py-2.5 hover:bg-accent/20 transition-colors"
                >
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0 mt-0.5 w-14">
                    {log.timestamp}
                  </span>
                  <Badge className={`text-[9px] border-0 shrink-0 ${levelConfig.color}`}>
                    <LevelIcon className="h-2.5 w-2.5 mr-1" />
                    {log.level.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    {SOURCE_LABELS[log.source]}
                  </Badge>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {log.message}
                  </span>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
