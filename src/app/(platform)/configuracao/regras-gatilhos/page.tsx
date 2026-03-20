'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
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
  params: { label: string; key: string; value: number; suffix: string }[]
}

const INITIAL_RULES: Rule[] = [
  {
    id: '1',
    name: 'Conclusão automática',
    description: 'CRM registrar X atividades → missão concluída → XP creditado',
    trigger: 'CRM registra atividades',
    action: 'Missão concluída + XP creditado',
    icon: CheckCircle2,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    active: true,
    params: [
      { label: 'Atividades necessárias', key: 'activities', value: 10, suffix: 'atividades' },
    ],
  },
  {
    id: '2',
    name: 'Alerta de engajamento',
    description: 'N dias sem atividade → notificação gestor + nudge vendedor',
    trigger: 'Dias sem atividade',
    action: 'Notificação gestor + nudge vendedor',
    icon: Bell,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
    active: true,
    params: [
      { label: 'Dias sem atividade', key: 'days', value: 3, suffix: 'dias' },
    ],
  },
  {
    id: '3',
    name: 'Cálculo de comissão',
    description: 'Fim do período → receita importada → comissão calculada + bônus',
    trigger: 'Fim do período de vendas',
    action: 'Comissão calculada + bônus aplicado',
    icon: Calculator,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
    active: true,
    params: [],
  },
  {
    id: '4',
    name: 'Streak',
    description: 'Atualização CRM por N dias consecutivos → streak + badge',
    trigger: 'Dias consecutivos com atualização',
    action: 'Streak registrado + badge concedida',
    icon: Flame,
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-600',
    active: true,
    params: [
      { label: 'Dias consecutivos', key: 'streak_days', value: 5, suffix: 'dias' },
    ],
  },
  {
    id: '5',
    name: 'Nudge inteligente',
    description: 'Vendedor próximo de completar missão + sem atividade → mensagem personalizada',
    trigger: 'Próximo de meta + inativo',
    action: 'Mensagem personalizada enviada',
    icon: MessageSquare,
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-600',
    active: false,
    params: [],
  },
]

export default function RegrasGatilhosPage() {
  const { user } = useAuth()
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newRule, setNewRule] = useState({ event: '', action: '' })

  if (!user) return null

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
  }

  const updateParam = (ruleId: string, paramKey: string, value: string) => {
    const num = Math.max(1, Number(value) || 1)
    setRules(
      rules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              params: r.params.map((p) => (p.key === paramKey ? { ...p, value: num } : p)),
            }
          : r
      )
    )
  }

  const handleAddRule = () => {
    if (!newRule.event || !newRule.action) return
    const rule: Rule = {
      id: Date.now().toString(),
      name: 'Regra personalizada',
      description: `${newRule.event} → ${newRule.action}`,
      trigger: newRule.event,
      action: newRule.action,
      icon: Settings2,
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      active: true,
      params: [],
    }
    setRules([...rules, rule])
    setNewRule({ event: '', action: '' })
    setDialogOpen(false)
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
          <DialogTrigger>
            <Button size="sm" className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nova Regra
            </Button>
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
              <Button onClick={handleAddRule} className="w-full">
                Criar Regra
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
              className={`border-border/50 transition-all duration-200 ${
                !rule.active ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col gap-3">
                  {/* Top: icon, name, toggle */}
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
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {rule.description}
                        </p>
                      </div>
                    </div>

                    {/* Toggle as checkbox styled as switch */}
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

                  {/* Trigger → Action flow */}
                  <div className="flex items-center gap-2 pl-12">
                    <Badge variant="outline" className="text-[10px] h-5 px-2 font-normal">
                      {rule.trigger}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Badge variant="outline" className="text-[10px] h-5 px-2 font-normal">
                      {rule.action}
                    </Badge>
                  </div>

                  {/* Editable params */}
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
    </div>
  )
}
