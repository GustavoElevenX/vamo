'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Activity, AlertTriangle, CheckCircle2, Cpu, RefreshCw, Search, Server, XCircle } from 'lucide-react'

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEntry {
  id: string
  created_at: string
  level: LogLevel
  source: string
  message: string
  metadata: Record<string, unknown>
}

interface LogsResponse {
  logs: LogEntry[]
  summary: Record<'total' | LogLevel, number>
  sources: string[]
}

const LEVEL_CONFIG: Record<LogLevel, { color: string; icon: React.ElementType; label: string }> = {
  error: { color: 'bg-red-500/10 text-red-600', icon: XCircle, label: 'Erro' },
  warn: { color: 'bg-amber-500/10 text-amber-600', icon: AlertTriangle, label: 'Aviso' },
  info: { color: 'bg-blue-500/10 text-blue-600', icon: CheckCircle2, label: 'Info' },
  debug: { color: 'bg-muted text-muted-foreground', icon: Cpu, label: 'Debug' },
}

export default function SystemLogsPage() {
  const { user } = useRequiredAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [summary, setSummary] = useState<LogsResponse['summary']>({ total: 0, error: 0, warn: 0, info: 0, debug: 0 })
  const [sources, setSources] = useState<string[]>([])
  const [filterLevel, setFilterLevel] = useState<'all' | LogLevel>('all')
  const [filterSource, setFilterSource] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const loadLogs = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('level', filterLevel)
    params.set('source', filterSource)
    if (searchQuery.trim()) params.set('search', searchQuery.trim())

    try {
      const res = await fetch(`/api/system/logs?${params.toString()}`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Erro ao carregar logs')
      const data = await res.json() as LogsResponse
      setLogs(data.logs)
      setSummary(data.summary)
      setSources(data.sources)
    } catch {
      setLogs([])
      setSummary({ total: 0, error: 0, warn: 0, info: 0, debug: 0 })
      setSources([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterLevel, filterSource])

  const levelOptions = useMemo(() => ['all', 'error', 'warn', 'info', 'debug'] as const, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Logs do Sistema</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Eventos reais gravados pela plataforma para auditoria operacional.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 pt-4 pb-3">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <p className="text-[10px] text-muted-foreground">Total filtrado</p>
              <p className="text-lg font-bold">{summary.total}</p>
            </div>
          </CardContent>
        </Card>
        {(['error', 'warn', 'info'] as LogLevel[]).map((level) => {
          const Icon = LEVEL_CONFIG[level].icon
          return (
            <Card key={level} className="border-border/50">
              <CardContent className="flex items-center gap-3 pt-4 pb-3">
                <Icon className={`h-5 w-5 ${LEVEL_CONFIG[level].color.split(' ').at(-1)}`} />
                <div>
                  <p className="text-[10px] text-muted-foreground">{LEVEL_CONFIG[level].label}</p>
                  <p className="text-lg font-bold">{summary[level]}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border/50">
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') loadLogs()
              }}
              className="pl-8"
              placeholder="Buscar nos logs"
            />
          </div>
          <select
            value={filterLevel}
            onChange={(event) => setFilterLevel(event.target.value as 'all' | LogLevel)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            {levelOptions.map((level) => (
              <option key={level} value={level}>{level === 'all' ? 'Todos os niveis' : LEVEL_CONFIG[level].label}</option>
            ))}
          </select>
          <select
            value={filterSource}
            onChange={(event) => setFilterSource(event.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">Todas as fontes</option>
            {sources.map((source) => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
          <Button variant="outline" onClick={loadLogs}>Filtrar</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Carregando logs...</CardContent>
          </Card>
        ) : logs.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center">
              <Server className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhum log encontrado.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Acoes como salvar criterios, configurar sistema e publicar no feed passam a aparecer aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => {
            const Icon = LEVEL_CONFIG[log.level].icon
            return (
              <Card key={log.id} className="border-border/50">
                <CardContent className="flex items-start gap-3 py-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${LEVEL_CONFIG[log.level].color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{log.source}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{log.message}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
