'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  BarChart3,
  Calculator,
  DollarSign,
  Plus,
  Save,
  SlidersHorizontal,
  Target,
  Trash2,
  Zap,
} from 'lucide-react'
import {
  calculateCommission,
  DEFAULT_COMMISSION_CONFIG,
  formatCurrency,
  normalizeConfig,
  type CommissionConfig,
  type CommissionModel,
  type CommissionTier,
  type KpiRule,
} from '@/lib/commission'

const models: { value: CommissionModel; label: string }[] = [
  { value: 'fixo_mais_percentual', label: 'Fixo + percentual' },
  { value: 'apenas_percentual', label: 'Apenas percentual' },
  { value: 'apenas_fixo', label: 'Apenas fixo' },
]

export default function ComissionamentoConfigPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [commission, setCommission] = useState<CommissionConfig>(DEFAULT_COMMISSION_CONFIG)
  const [scenario, setScenario] = useState({ revenue: '65000', target: '50000', missions: '4' })

  useEffect(() => {
    if (!user) return

    const fetchConfig = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('commission_configs')
          .select('*')
          .eq('organization_id', user.organization_id)
          .maybeSingle()

        setCommission(normalizeConfig(data as Record<string, unknown> | null))
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [supabase, user])

  const preview = useMemo(() => calculateCommission({
    user_id: user?.id ?? 'preview',
    name: 'Cenario',
    sales_revenue: Number(scenario.revenue) || 0,
    goal_target: Number(scenario.target) || 1,
    missions_completed: Number(scenario.missions) || 0,
    config: commission,
  }), [commission, scenario, user?.id])

  const updateNumber = (field: keyof CommissionConfig, value: string) => {
    const parsed = value === '' ? 0 : Number(value)
    setCommission((prev) => ({ ...prev, [field]: Number.isFinite(parsed) ? parsed : 0 }))
  }

  const updateTier = (index: number, field: keyof CommissionTier, value: string) => {
    setCommission((prev) => ({
      ...prev,
      faixas: prev.faixas.map((tier, currentIndex) => (
        currentIndex === index ? { ...tier, [field]: value === '' ? undefined : Number(value) } : tier
      )),
    }))
  }

  const addTier = () => {
    setCommission((prev) => ({
      ...prev,
      faixas: [...prev.faixas, { acima: prev.faixas[prev.faixas.length - 1]?.ate ?? 110, aliquota: prev.aliquota_base }],
    }))
  }

  const removeTier = (index: number) => {
    setCommission((prev) => ({ ...prev, faixas: prev.faixas.filter((_, currentIndex) => currentIndex !== index) }))
  }

  const updateKpi = (index: number, field: keyof KpiRule, value: string) => {
    setCommission((prev) => ({
      ...prev,
      regras_kpi: prev.regras_kpi.map((rule, currentIndex) => (
        currentIndex === index
          ? { ...rule, [field]: field === 'nome' ? value : Number(value) || 0 }
          : rule
      )),
    }))
  }

  const addKpi = () => {
    setCommission((prev) => ({
      ...prev,
      regras_kpi: [...prev.regras_kpi, { nome: 'Novo KPI', meta_pct: 80, bonus: 100 }],
    }))
  }

  const removeKpi = (index: number) => {
    setCommission((prev) => ({ ...prev, regras_kpi: prev.regras_kpi.filter((_, currentIndex) => currentIndex !== index) }))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const primaryTier = commission.faixas[0]
      const lastTier = commission.faixas[commission.faixas.length - 1]
      const payload = {
        organization_id: user.organization_id,
        aliquota_base: primaryTier?.aliquota ?? commission.aliquota_base,
        acelerador_threshold: commission.acelerador_threshold,
        acelerador_rate: lastTier?.aliquota ?? commission.acelerador_rate,
        bonus_missao: commission.bonus_missao,
        salario_base: commission.salario_base,
        periodo: commission.periodo,
        elegibilidade: commission.elegibilidade,
        piso_comissao: commission.piso_comissao,
        teto_comissao: commission.teto_comissao || null,
        bonus_kpi: commission.bonus_kpi,
        modelo: commission.modelo,
        faixas: commission.faixas,
        regras_kpi: commission.regras_kpi,
        acelerador_ativo: commission.acelerador_ativo,
        acelerador_multiplicador: commission.acelerador_multiplicador,
        dia_corte: commission.dia_corte,
        fechamento_automatico: commission.fechamento_automatico,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('commission_configs')
        .upsert(payload, { onConflict: 'organization_id' })

      if (error) throw error
      toast.success('Comissionamento V2 salvo')
    } catch {
      toast.error('Erro ao salvar configuracao')
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">Configuracao de Comissionamento</h2>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">V2</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">Modelo, faixas, acelerador, KPIs e fechamento.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Section icon={DollarSign} title="Modelo base">
            <div className="grid gap-3 md:grid-cols-3">
              {models.map((model) => (
                <button
                  key={model.value}
                  type="button"
                  onClick={() => setCommission((prev) => ({ ...prev, modelo: model.value }))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    commission.modelo === model.value ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 hover:bg-accent/50'
                  }`}
                >
                  {model.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Salario base (R$)" value={commission.salario_base} onChange={(value) => updateNumber('salario_base', value)} />
              <Field label="Bonus por missao (R$)" value={commission.bonus_missao} onChange={(value) => updateNumber('bonus_missao', value)} />
              <Field label="Bonus KPI fixo (R$)" value={commission.bonus_kpi} onChange={(value) => updateNumber('bonus_kpi', value)} />
            </div>
          </Section>

          <Section icon={BarChart3} title="Faixas de comissao">
            <div className="space-y-3">
              {commission.faixas.map((tier, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border/40 p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                  <Field label="Ate % da meta" value={tier.ate ?? ''} onChange={(value) => updateTier(index, 'ate', value)} />
                  <Field label="Acima de %" value={tier.acima ?? ''} onChange={(value) => updateTier(index, 'acima', value)} />
                  <Field label="Aliquota %" value={tier.aliquota} onChange={(value) => updateTier(index, 'aliquota', value)} />
                  <Button variant="ghost" size="sm" onClick={() => removeTier(index)} disabled={commission.faixas.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addTier}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar faixa
            </Button>
          </Section>

          <Section icon={Zap} title="Acelerador">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
              <button
                type="button"
                onClick={() => setCommission((prev) => ({ ...prev, acelerador_ativo: !prev.acelerador_ativo }))}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  commission.acelerador_ativo ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border/50 text-muted-foreground'
                }`}
              >
                {commission.acelerador_ativo ? 'Ativo' : 'Inativo'}
              </button>
              <Field label="Threshold % da meta" value={commission.acelerador_threshold} onChange={(value) => updateNumber('acelerador_threshold', value)} />
              <Field label="Multiplicador" value={commission.acelerador_multiplicador} onChange={(value) => updateNumber('acelerador_multiplicador', value)} />
            </div>
          </Section>

          <Section icon={Target} title="Bonus por KPI">
            <div className="space-y-3">
              {commission.regras_kpi.map((rule, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border/40 p-3 md:grid-cols-[1fr_120px_120px_auto] md:items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs">KPI</Label>
                    <Input value={rule.nome} onChange={(event) => updateKpi(index, 'nome', event.target.value)} className="h-8" />
                  </div>
                  <Field label="Meta %" value={rule.meta_pct} onChange={(value) => updateKpi(index, 'meta_pct', value)} />
                  <Field label="Bonus R$" value={rule.bonus} onChange={(value) => updateKpi(index, 'bonus', value)} />
                  <Button variant="ghost" size="sm" onClick={() => removeKpi(index)} disabled={commission.regras_kpi.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addKpi}>
              <Plus className="mr-1 h-4 w-4" />
              Adicionar KPI
            </Button>
          </Section>

          <Section icon={Calculator} title="Elegibilidade e periodo">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Elegibilidade %" value={commission.elegibilidade} onChange={(value) => updateNumber('elegibilidade', value)} />
              <Field label="Piso comissao (R$)" value={commission.piso_comissao} onChange={(value) => updateNumber('piso_comissao', value)} />
              <Field label="Teto comissao (R$)" value={commission.teto_comissao ?? ''} onChange={(value) => setCommission((prev) => ({ ...prev, teto_comissao: value ? Number(value) : null }))} />
              <Field label="Dia de corte" value={commission.dia_corte} onChange={(value) => updateNumber('dia_corte', value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['mensal', 'quinzenal', 'semanal'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setCommission((prev) => ({ ...prev, periodo: period }))}
                  className={`rounded-md border px-3 py-1.5 text-xs capitalize ${
                    commission.periodo === period ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent/40'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCommission((prev) => ({ ...prev, fechamento_automatico: !prev.fechamento_automatico }))}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                commission.fechamento_automatico
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700'
                  : 'border-border/50 text-muted-foreground hover:bg-accent/50'
              }`}
            >
              Fechamento automatico {commission.fechamento_automatico ? 'ativo' : 'inativo'}
              <span className="mt-0.5 block text-xs opacity-75">
                No dia de corte, o sistema calcula o mes anterior e envia para aprovacao.
              </span>
            </button>
          </Section>
        </div>

        <Card className="h-fit border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Preview ao vivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Field label="Vendas no periodo (R$)" value={scenario.revenue} onChange={(value) => setScenario((prev) => ({ ...prev, revenue: value }))} />
              <Field label="Meta do periodo (R$)" value={scenario.target} onChange={(value) => setScenario((prev) => ({ ...prev, target: value }))} />
              <Field label="Missoes concluidas" value={scenario.missions} onChange={(value) => setScenario((prev) => ({ ...prev, missions: value }))} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Atingimento</span>
                <span className="font-medium">{preview.goal_pct}%</span>
              </div>
              <Progress value={Math.min(preview.goal_pct, 100)} />
            </div>

            <div className="space-y-2 rounded-lg border border-border/40 bg-background/70 p-3 text-sm">
              <Row label="Salario base" value={formatCurrency(preview.base_salary)} />
              <Row label="Comissao vendas" value={formatCurrency(preview.sales_commission)} />
              <Row label="Bonus missoes" value={formatCurrency(preview.mission_bonus)} />
              <Row label="Bonus KPI" value={formatCurrency(preview.kpi_bonus)} />
              <div className="border-t border-border/40 pt-2">
                <Row label="Total" value={formatCurrency(preview.total)} strong />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof DollarSign
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Field({ label, value, onChange }: { label: string; value: string | number; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 text-sm" />
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-bold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}
