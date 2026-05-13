'use client'

import { useEffect, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Brain, Clock, RefreshCw, Save, Server, Settings, Shield } from 'lucide-react'
import { toast } from 'sonner'

type SyncFrequency = '5min' | '15min' | '30min' | '1h'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface SystemConfig {
  syncFrequency: SyncFrequency
  aiTemperature: string
  aiMaxTokens: string
  logLevel: LogLevel
  alertOnErrors: boolean
  auditRetentionDays: string
}

const SYNC_OPTIONS: { value: SyncFrequency; label: string }[] = [
  { value: '5min', label: '5 min' },
  { value: '15min', label: '15 min' },
  { value: '30min', label: '30 min' },
  { value: '1h', label: '1 hora' },
]

const LOG_LEVELS: { value: LogLevel; label: string }[] = [
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
]

export default function ConfiguracaoAvancadaPage() {
  const { user } = useRequiredAuth()
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return

    fetch('/api/system/config', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao carregar configuração')
        return res.json() as Promise<{ config: SystemConfig }>
      })
      .then((data) => setConfig(data.config))
      .catch(() => toast.error('Não foi possível carregar a configuração avancada.'))
      .finally(() => setLoading(false))
  }, [user])

  const patch = (partial: Partial<SystemConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch('/api/system/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      const data = await res.json() as { config: SystemConfig }
      setConfig(data.config)
      toast.success('Configuração avancada salva.')
    } catch {
      toast.error('Não foi possível salvar a configuração.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !config) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Configuração Avancada</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Parametros salvos em organização e registrados nos logs do sistema.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">Persistente</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Rotina de sincronizacao interna</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {SYNC_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => patch({ syncFrequency: opt.value })}
                  className={`flex-1 rounded-md border-2 py-2 text-xs font-medium transition-all ${
                    config.syncFrequency === opt.value
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-border/40 text-muted-foreground hover:border-border hover:bg-accent/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Parametros de IA</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Temperatura</Label>
              <Input value={config.aiTemperature} onChange={(event) => patch({ aiTemperature: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max tokens</Label>
              <Input value={config.aiMaxTokens} onChange={(event) => patch({ aiMaxTokens: event.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Nivel de log</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {LOG_LEVELS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => patch({ logLevel: opt.value })}
                  className={`rounded-md border py-2 text-xs transition-colors ${
                    config.logLevel === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 text-muted-foreground hover:bg-accent/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Auditoria e alertas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">Alertar erros criticos</p>
                  <p className="text-xs text-muted-foreground">Gera registro e alerta interno quando falhas criticas forem detectadas.</p>
                </div>
              </div>
              <button
                onClick={() => patch({ alertOnErrors: !config.alertOnErrors })}
                className={`h-5 w-9 rounded-full p-0.5 transition-colors ${config.alertOnErrors ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${config.alertOnErrors ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Retencao de logs (dias)</Label>
              <Input value={config.auditRetentionDays} onChange={(event) => patch({ auditRetentionDays: event.target.value })} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Clock className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : 'Salvar configuração'}
        </Button>
      </div>

      <Card className="border-border/50 bg-muted/30">
        <CardContent className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Settings className="h-3.5 w-3.5" />
          Alteracoes aparecem em Sistema / Logs e passam a ser usadas como configuração oficial da organização.
        </CardContent>
      </Card>
    </div>
  )
}
