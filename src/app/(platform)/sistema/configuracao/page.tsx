'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Settings, RefreshCw, Brain, Server, FileText, Shield, RotateCcw,
  Save, Clock, Zap, AlertTriangle,
} from 'lucide-react'

type SyncFrequency = '5min' | '15min' | '30min' | '1h'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export default function ConfiguracaoAvancadaPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [syncFreq, setSyncFreq] = useState<SyncFrequency>('15min')
  const [aiTemperature, setAiTemperature] = useState('0.7')
  const [aiMaxTokens, setAiMaxTokens] = useState('2048')
  const [logLevel, setLogLevel] = useState<LogLevel>('info')
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 1200))
    setSaving(false)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Configuração Avançada</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Parâmetros técnicos da plataforma</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sync Frequency */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Frequência de Sincronização CRM</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {SYNC_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSyncFreq(opt.value)}
                  className={`flex-1 text-xs py-2 rounded-md border-2 font-medium transition-all ${
                    syncFreq === opt.value
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-border/40 hover:border-border hover:bg-accent/20 text-muted-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Model */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Modelo de VAMO IA</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo atual</Label>
              <div className="rounded-md border border-border/40 bg-muted/30 px-3 py-2">
                <p className="text-sm font-medium">DeepSeek R1 0528</p>
                <p className="text-[10px] text-muted-foreground">via OpenRouter</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fallback</Label>
              <div className="rounded-md border border-border/40 bg-muted/30 px-3 py-2">
                <p className="text-sm text-muted-foreground">Meta Llama 3.1 70B</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Temperature</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={aiTemperature}
                  onChange={(e) => setAiTemperature(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max tokens</Label>
                <Input
                  type="number"
                  step="256"
                  min="256"
                  max="8192"
                  value={aiMaxTokens}
                  onChange={(e) => setAiMaxTokens(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Environment */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Ambiente</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] border-0 bg-emerald-500/10 text-emerald-600">Produção</Badge>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API Base URL</Label>
              <Input
                value="https://api.motiva.app"
                readOnly
                className="h-8 text-sm bg-muted/30 text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Supabase Project ID</Label>
              <Input
                value="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                readOnly
                className="h-8 text-sm bg-muted/30 text-muted-foreground font-mono"
              />
            </div>
          </CardContent>
        </Card>

        {/* Logging */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Nível de Log</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              {LOG_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  onClick={() => setLogLevel(lvl.value)}
                  className={`flex-1 text-xs py-2 rounded-md border-2 font-medium transition-all ${
                    logLevel === lvl.value
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-border/40 hover:border-border hover:bg-accent/20 text-muted-foreground'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Retenção de logs: <strong className="text-foreground">30 dias</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Rate Limits</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs">API</span>
              </div>
              <span className="text-xs font-medium">1,000 req/min</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-xs">AI Generation</span>
              </div>
              <span className="text-xs font-medium">100 req/hour</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs">Webhook</span>
              </div>
              <span className="text-xs font-medium">500 deliveries/hour</span>
            </div>
          </CardContent>
        </Card>

        {/* Retry Config */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Política de Retry</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Max retries</span>
              <span className="text-xs font-medium">3</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Backoff</span>
              <Badge variant="outline" className="text-[10px]">Exponential</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Timeout</span>
              <span className="text-xs font-medium">30s</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          className="gap-2"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
