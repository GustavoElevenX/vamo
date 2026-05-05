'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Calculator, CheckCircle2, ListChecks, Pencil, Plus, Save, SlidersHorizontal, ToggleLeft, ToggleRight } from 'lucide-react'
import {
  formatCurrency,
  statusLabel,
  type CommissionCalculationBase,
  type CommissionRule,
  type CommissionRuleType,
} from '@/lib/commission'

interface Seller {
  id: string
  name: string
}

type RuleForm = {
  name: string
  description: string
  rule_type: CommissionRuleType
  seller_id: string
  product_id: string
  category_id: string
  commercial_table_id: string
  percentage: string
  calculation_base: CommissionCalculationBase
  priority: string
  active: boolean
}

const ruleTypes: { value: CommissionRuleType; label: string; hint: string; priority: number }[] = [
  { value: 'seller_product', label: 'Vendedor + produto', hint: 'Regra mais especifica para uma venda.', priority: 1 },
  { value: 'seller_commercial_table', label: 'Vendedor + tabela', hint: 'Percentual por vendedor em uma tabela.', priority: 2 },
  { value: 'product', label: 'Produto', hint: 'Comissao por produto ou servico.', priority: 3 },
  { value: 'category', label: 'Categoria', hint: 'Comissao por categoria de produto.', priority: 4 },
  { value: 'commercial_table', label: 'Tabela comercial', hint: 'Comissao por tabela de preco/margem.', priority: 5 },
  { value: 'seller', label: 'Vendedor', hint: 'Percentual geral do vendedor.', priority: 6 },
  { value: 'company_default', label: 'Padrao da empresa', hint: 'Fallback quando nenhuma regra especifica se aplica.', priority: 7 },
]

const emptyForm: RuleForm = {
  name: '',
  description: '',
  rule_type: 'company_default',
  seller_id: '',
  product_id: '',
  category_id: '',
  commercial_table_id: '',
  percentage: '5',
  calculation_base: 'sale_amount',
  priority: '7',
  active: true,
}

const baseLabels: Record<CommissionCalculationBase, string> = {
  sale_amount: 'Venda realizada',
  received_amount: 'Valor recebido',
}

function toRuleForm(rule: CommissionRule): RuleForm {
  return {
    name: rule.name,
    description: rule.description ?? '',
    rule_type: rule.rule_type,
    seller_id: rule.seller_id ?? '',
    product_id: rule.product_id ?? '',
    category_id: rule.category_id ?? '',
    commercial_table_id: rule.commercial_table_id ?? '',
    percentage: String(rule.percentage),
    calculation_base: rule.calculation_base,
    priority: String(rule.priority),
    active: rule.active,
  }
}

function clean(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default function ComissionamentoConfigPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleForm>(emptyForm)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const sellersRes = await fetch('/api/team/sellers', { credentials: 'same-origin' })
      const sellersJson = sellersRes.ok ? await sellersRes.json() : { sellers: [] }
      setSellers((sellersJson.sellers ?? []) as Seller[])

      const { data, error } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('organization_id', user.organization_id)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setRules((data ?? []) as CommissionRule[])
    } catch {
      toast.error('Nao foi possivel carregar as regras de comissao')
    } finally {
      setLoading(false)
    }
  }, [supabase, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const activeRules = useMemo(() => rules.filter((rule) => rule.active), [rules])
  const sellerName = useMemo(() => new Map(sellers.map((seller) => [seller.id, seller.name])), [sellers])

  const setRuleType = (ruleType: CommissionRuleType) => {
    const defaultPriority = ruleTypes.find((item) => item.value === ruleType)?.priority ?? 99
    setForm((prev) => ({ ...prev, rule_type: ruleType, priority: String(defaultPriority) }))
  }

  const startEdit = (rule: CommissionRule) => {
    setEditingId(rule.id ?? null)
    setForm(toRuleForm(rule))
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!user) return
    const percentage = Number(form.percentage)
    if (!form.name.trim() || !Number.isFinite(percentage) || percentage < 0) {
      toast.error('Informe nome e percentual valido para a regra')
      return
    }

    setSaving(true)
    try {
      const payload = {
        organization_id: user.organization_id,
        company_id: user.organization_id,
        name: form.name.trim(),
        description: clean(form.description),
        rule_type: form.rule_type,
        seller_id: clean(form.seller_id),
        product_id: clean(form.product_id),
        category_id: clean(form.category_id),
        commercial_table_id: clean(form.commercial_table_id),
        percentage,
        calculation_base: form.calculation_base,
        priority: Number(form.priority) || 99,
        active: form.active,
      }

      const result = editingId
        ? await supabase.from('commission_rules').update(payload).eq('id', editingId)
        : await supabase.from('commission_rules').insert(payload)

      if (result.error) throw result.error
      toast.success(editingId ? 'Regra atualizada' : 'Regra criada')
      resetForm()
      fetchData()
    } catch {
      toast.error('Erro ao salvar regra')
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (rule: CommissionRule) => {
    if (!rule.id) return
    const { error } = await supabase.from('commission_rules').update({ active: !rule.active }).eq('id', rule.id)
    if (error) {
      toast.error('Nao foi possivel alterar o status')
      return
    }
    toast.success(!rule.active ? 'Regra ativada' : 'Regra desativada')
    fetchData()
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Configuracao de Comissionamento</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Regras por vendedor, produto, categoria, tabela comercial e base de calculo.
            </p>
          </div>
        </div>
        <Badge className="w-fit border-0 bg-primary/10 text-primary">{activeRules.length} regras ativas</Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card className="h-fit border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Plus className="h-4 w-4 text-primary" />
              {editingId ? 'Editar regra' : 'Criar regra'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nome da regra">
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Ex.: Tabela B paga 5%" />
            </Field>

            <Field label="Tipo da regra">
              <select value={form.rule_type} onChange={(event) => setRuleType(event.target.value as CommissionRuleType)} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                {ruleTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">{ruleTypes.find((item) => item.value === form.rule_type)?.hint}</p>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Percentual">
                <Input type="number" min="0" step="0.01" value={form.percentage} onChange={(event) => setForm((prev) => ({ ...prev, percentage: event.target.value }))} />
              </Field>
              <Field label="Prioridade">
                <Input type="number" min="1" value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} />
              </Field>
            </div>

            <Field label="Base de calculo">
              <div className="grid grid-cols-2 gap-2">
                {(['sale_amount', 'received_amount'] as CommissionCalculationBase[]).map((base) => (
                  <button
                    key={base}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, calculation_base: base }))}
                    className={`rounded-lg border px-3 py-2 text-left text-xs ${form.calculation_base === base ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:bg-accent/40'}`}
                  >
                    {baseLabels[base]}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Vendedor, se aplicavel">
              <select value={form.seller_id} onChange={(event) => setForm((prev) => ({ ...prev, seller_id: event.target.value }))} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="">Todos</option>
                {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Produto">
                <Input value={form.product_id} onChange={(event) => setForm((prev) => ({ ...prev, product_id: event.target.value }))} placeholder="ID ou nome" />
              </Field>
              <Field label="Categoria">
                <Input value={form.category_id} onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))} placeholder="ID ou nome" />
              </Field>
              <Field label="Tabela">
                <Input value={form.commercial_table_id} onChange={(event) => setForm((prev) => ({ ...prev, commercial_table_id: event.target.value }))} placeholder="ID ou nome" />
              </Field>
            </div>

            <Field label="Descricao">
              <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Quando a regra deve ser aplicada." />
            </Field>

            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${form.active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700' : 'border-border/50 text-muted-foreground'}`}
            >
              <span>{form.active ? 'Regra ativa' : 'Regra inativa'}</span>
              {form.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            </button>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="mr-1 h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar regra'}
              </Button>
              {editingId && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Summary icon={ListChecks} label="Regras cadastradas" value={String(rules.length)} />
            <Summary icon={CheckCircle2} label="Regras ativas" value={String(activeRules.length)} />
            <Summary icon={Calculator} label="Maior percentual" value={`${Math.max(0, ...rules.map((rule) => Number(rule.percentage) || 0))}%`} />
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Lista de regras ativas e inativas</CardTitle>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium">Nenhuma regra de comissao cadastrada ainda.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Crie a primeira regra para comecar a calcular comissoes automaticamente.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        {['Regra', 'Tipo', 'Vendedor', 'Base', 'Percentual', 'Prioridade', 'Status', ''].map((head) => (
                          <th key={head} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id} className="border-b border-border/30 last:border-0">
                          <td className="px-3 py-3">
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-xs text-muted-foreground">{rule.description || 'Sem descricao'}</p>
                          </td>
                          <td className="px-3 py-3">{ruleTypes.find((type) => type.value === rule.rule_type)?.label ?? rule.rule_type}</td>
                          <td className="px-3 py-3">{rule.seller_id ? sellerName.get(rule.seller_id) ?? 'Vendedor' : 'Todos'}</td>
                          <td className="px-3 py-3">{baseLabels[rule.calculation_base]}</td>
                          <td className="px-3 py-3 font-semibold">{rule.percentage}%</td>
                          <td className="px-3 py-3">{rule.priority}</td>
                          <td className="px-3 py-3">
                            <Badge className={`border-0 text-[10px] ${rule.active ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                              {rule.active ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon-sm" onClick={() => startEdit(rule)} title="Editar regra">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => toggleRule(rule)} title={rule.active ? 'Desativar' : 'Ativar'}>
                                {rule.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-5 text-sm">
              <p className="font-medium">Preview de regra aplicada</p>
              <p className="mt-1 text-muted-foreground">
                Uma venda de {formatCurrency(10000)} com regra de 5% gera {formatCurrency(500)}. Se a base for valor recebido e apenas {formatCurrency(6000)} entrou no caixa, a Vamo separa {formatCurrency(300)} como confirmada e {formatCurrency(200)} como pendente.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Status de disputa aparecem como {statusLabel('under_review')} para o gestor analisar.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function Summary({ icon: Icon, label, value }: { icon: typeof ListChecks; label: string; value: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
