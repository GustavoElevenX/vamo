'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Zap,
  Plus,
  CheckCircle2,
  Bell,
  Calculator,
  Flame,
  MessageSquare,
  Settings2,
  ArrowRight,
} from 'lucide-react'

interface RuleParam {
  label: string
  key: string
  value: number
  suffix: string
}

interface Rule {
  id: string
  name: string
  description: string
  trigger: string
  action: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  active: boolean
  params: RuleParam[]
  is_system: boolean
}

const ICON_MAP: Record<string, React.ElementType> = {
  CheckCircle2,
  Bell,
  Calculator,
  Flame,
  MessageSquare,
  Settings2,
}

const SEED_RULES = [
  {
    name: 'Conclusão automática',
    description: 'CRM registrar X atividades → missão concluída → XP creditado',
    trigger_event: 'CRM registra atividades',
    action_type: 'Missão concluída + XP creditado',
    icon_key: 'CheckCircle2',
    icon_bg: 'bg-emerald-500/10',
    icon_color: 'text-emerald-600',
    active: true,
    is_system: true,
    sort_order: 0,
    params: [{ label: 'Atividades necessárias', key: 'activities', value: 10, suffix: 'atividades' }],
  },
  {
    name: 'Alerta de engajamento',
    description: 'N dias sem atividade → notificação gestor + nudge vendedor',
    trigger_event: 'Dias sem atividade',
    action_type: 'Notificação gestor + nudge vendedor',
    icon_key: 'Bell',
    icon_bg: 'bg-amber-500/10',
    icon_color: 'text-amber-600',
    active: true,
    is_system: true,
    sort_order: 1,
    params: [{ label: 'Dias sem atividade', key: 'days', value: 3, suffix: 'dias' }],
  },
  {
    name: 'Cálculo de comissão',
    description: 'Fim do período → receita importada → comissão calculada + bônus',
    trigger_event: 'Fim do período de vendas',
    action_type: 'Comissão calculada + bônus aplicado',
    icon_key: 'Calculator',
    icon_bg: 'bg-blue-500/10',
    icon_color: 'text-blue-600',
    active: true,
    is_system: true,
    sort_order: 2,
    params: [],
  },
  {
    name: 'Streak',
    description: 'Atualização CRM por N dias consecutivos → streak + badge',
    trigger_event: 'Dias consecutivos com atualização',
    action_type: 'Streak registrado + badge concedida',
    icon_key: 'Flame',
    icon_bg: 'bg-orange-500/10',
    icon_color: 'text-orange-600',
    active: true,
    is_system: true,
    sort_order: 3,
    params: [{ label: 'Dias consecutivos', key: 'streak_days', value: 5, suffix: 'dias' }],
  },
  {
    name: 'Nudge inteligente',
    description: 'Vendedor próximo de completar missão + sem atividade → mensagem personalizada',
    trigger_event: 'Próximo de meta + inativo',
    action_type: 'Mensagem personalizada enviada',
    icon_key: 'MessageSquare',
    icon_bg: 'bg-violet-500/10',
    icon_color: 'text-violet-600',
    active: false,
    is_system: true,
    sort_order: 4,
    params: [],
  },
]

function mapDbRow(row: Record<string, unknown>): Rule {
  const params = (row.params as RuleParam[]) ?? []
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    trigger: row.trigger_event as string,
    action: row.action_type as string,
    icon: ICON_MAP[(row.icon_key as string) ?? 'Settings2'] ?? Settings2,
    iconBg: (row.icon_bg as string) ?? 'bg-muted',
    iconColor: (row.icon_color as string) ?? 'text-muted-foreground',
    active: row.active as boolean,
    params,
    is_system: (row.is_system as boolean) ?? false,
  }
}

export default function RegrasGatilhosPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newRule, setNewRule] = useState({ event: '', action: '' })

  const fetchRules = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('sort_order')

      if (!data || data.length === 0) {
        // Seed default rules for this org
        const toInsert = SEED_RULES.map((r) => ({
          ...r,
          organization_id: user.organization_id,
          params: r.params,
        }))
        const { data: inserted } = await supabase
          .from('automation_rules')
          .insert(toInsert)
          .select()
        setRules((inserted ?? []).map(mapDbRow))
      } else {
        setRules(data.map(mapDbRow))
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
  }

  const updateParam = (ruleId: string, paramKey: string, value: string) => {
    const num = Math.max(1, Number(value) || 1)
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, params: r.params.map((p) => (p.key === paramKey ? { ...p, value: num } : p)) }
          : r
      )
    )
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await Promise.all(
        rules.map((rule) =>
          supabase
            .from('automation_rules')
            .update({ active: rule.active, params: rule.params, updated_at: new Date().toISOString() })
            .eq('id', rule.id)
        )
      )
      toast.success('Regras salvas com sucesso')
    } catch {
      toast.error('Erro ao salvar regras')
    } finally {
      setSaving(false)
    }
  }

  const handleAddRule = async () => {
    if (!user || !newRule.event || !newRule.action) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          organization_id: user.organization_id,
          name: 'Regra personalizada',
          description: `${newRule.event} → ${newRule.action}`,
          trigger_event: newRule.event,
          action_type: newRule.action,
          icon_key: 'Settings2',
          icon_bg: 'bg-muted',
          icon_color: 'text-muted-foreground',
          active: true,
          is_system: false,
          sort_order: rules.length,
          params: [],
        })
        .select()
        .single()

      if (error) throw error
      setRules((prev) => [...prev, mapDbRow(data)])
      setNewRule({ event: '', action: '' })
      setDialogOpen(false)
      toast.success('Regra criada')
    } catch {
      toast.error('Erro ao criar regra')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">Regras e Gatilhos</h2>
              <Badge variant="outline" className="text-[10px] h-5 px-2">
                Etapa 3
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Automações que conectam atividades a recompensas e alertas
            </p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" className="h-8 text-xs" />}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nova Regra
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Regra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Evento (gatilho)</Label>
                <Select value={newRule.event} onValueChange={(v) => v && setNewRule({ ...newRule, event: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o evento..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRM registra atividades">CRM registra atividades</SelectItem>
                    <SelectItem value="Dias sem atividade">Dias sem atividade</SelectItem>
                    <SelectItem value="Fim do período">Fim do período</SelectItem>
                    <SelectItem value="Dias consecutivos atualizando CRM">Dias consecutivos atualizando CRM</SelectItem>
                    <SelectItem value="Vendedor próximo da meta">Vendedor próximo da meta</SelectItem>
                    <SelectItem value="Meta atingida">Meta atingida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ação</Label>
                <Select value={newRule.action} onValueChange={(v) => v && setNewRule({ ...newRule, action: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a ação..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Concluir missão + creditar XP">Concluir missão + creditar XP</SelectItem>
                    <SelectItem value="Notificar gestor">Notificar gestor</SelectItem>
                    <SelectItem value="Enviar nudge ao vendedor">Enviar nudge ao vendedor</SelectItem>
                    <SelectItem value="Calcular comissão">Calcular comissão</SelectItem>
                    <SelectItem value="Registrar streak + badge">Registrar streak + badge</SelectItem>
                    <SelectItem value="Pausar missões de volume">Pausar missões de volume</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddRule} className="w-full" disabled={saving}>
                {saving ? 'Criando...' : 'Criar Regra'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.map((rule) => {
          const Icon = rule.icon
          return (
            <Card
              key={rule.id}
              className={`border-border/50 transition-all duration-200 ${!rule.active ? 'opacity-60' : ''}`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg ${rule.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4.5 w-4.5 ${rule.iconColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{rule.name}</p>
                          <Badge
                            className={`text-[10px] h-5 px-2 border-0 ${
                              rule.active
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {rule.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{rule.description}</p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={rule.active}
                        onChange={() => toggleRule(rule.id)}
                      />
                      <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pl-12">
                    <Badge variant="outline" className="text-[10px] h-5 px-2 font-normal">
                      {rule.trigger}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Badge variant="outline" className="text-[10px] h-5 px-2 font-normal">
                      {rule.action}
                    </Badge>
                  </div>

                  {rule.params.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 pl-12">
                      {rule.params.map((param) => (
                        <div key={param.key} className="flex items-center gap-2">
                          <Label className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {param.label}:
                          </Label>
                          <Input
                            type="number"
                            className="h-7 w-16 text-xs text-center"
                            value={param.value}
                            onChange={(e) => updateParam(rule.id, param.key, e.target.value)}
                            min={1}
                          />
                          <span className="text-[11px] text-muted-foreground">{param.suffix}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button onClick={handleSave} className="w-full" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar Regras'}
      </Button>
    </div>
  )
}
