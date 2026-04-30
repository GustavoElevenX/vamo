export type CommissionPeriodStatus = 'open' | 'calculating' | 'pending_approval' | 'approved' | 'paid'
export type CommissionCalculationStatus = 'draft' | 'calculated' | 'pending_approval' | 'approved' | 'paid' | 'disputed'
export type CommissionModel = 'fixo_mais_percentual' | 'apenas_percentual' | 'apenas_fixo'
export type CommissionLineItemType = 'venda' | 'missao' | 'kpi' | 'acelerador' | 'ajuste'

export interface CommissionTier {
  ate?: number
  acima?: number
  aliquota: number
}

export interface KpiRule {
  nome: string
  meta_pct: number
  bonus: number
}

export interface CommissionConfig {
  aliquota_base: number
  acelerador_threshold: number
  acelerador_rate: number
  bonus_missao: number
  salario_base: number
  periodo: 'mensal' | 'quinzenal' | 'semanal'
  elegibilidade: number
  piso_comissao: number
  teto_comissao: number | null
  bonus_kpi: number
  modelo: CommissionModel
  faixas: CommissionTier[]
  regras_kpi: KpiRule[]
  acelerador_ativo: boolean
  acelerador_multiplicador: number
  dia_corte: number
  fechamento_automatico: boolean
}

export interface CommissionLineItem {
  id?: string
  calculation_id?: string
  user_id?: string
  tipo: CommissionLineItemType
  descricao: string
  referencia_id?: string | null
  valor: number
  data_referencia?: string | null
}

export interface CommissionCalculation {
  id?: string
  period_id?: string
  organization_id?: string
  user_id: string
  name: string
  base_salary: number
  sales_revenue: number
  sales_commission: number
  mission_bonus: number
  kpi_bonus: number
  accelerator_mult: number
  total: number
  goal_pct: number
  missions_completed: number
  status: CommissionCalculationStatus
  approved_by?: string | null
  approved_at?: string | null
  notes?: string | null
  calculated_at?: string | null
  line_items: CommissionLineItem[]
}

export interface CommissionPeriod {
  id?: string
  organization_id?: string
  reference: string
  label: string
  status: CommissionPeriodStatus
  opened_at?: string | null
  closed_at?: string | null
  paid_at?: string | null
  approved_by?: string | null
  total_payroll: number
  total_bonus: number
  notes?: string | null
}

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  aliquota_base: 4,
  acelerador_threshold: 110,
  acelerador_rate: 6,
  bonus_missao: 75,
  salario_base: 2500,
  periodo: 'mensal',
  elegibilidade: 80,
  piso_comissao: 0,
  teto_comissao: null,
  bonus_kpi: 0,
  modelo: 'fixo_mais_percentual',
  faixas: [
    { ate: 100, aliquota: 4 },
    { ate: 110, aliquota: 5 },
    { acima: 110, aliquota: 6 },
  ],
  regras_kpi: [
    { nome: 'Taxa de fechamento', meta_pct: 70, bonus: 200 },
    { nome: 'CRM atualizado', meta_pct: 80, bonus: 150 },
    { nome: 'NPS da equipe', meta_pct: 80, bonus: 100 },
  ],
  acelerador_ativo: true,
  acelerador_multiplicador: 1.5,
  dia_corte: 5,
  fechamento_automatico: false,
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

export function parseNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeTiers(value: unknown, fallbackRate = DEFAULT_COMMISSION_CONFIG.aliquota_base): CommissionTier[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      { ate: 100, aliquota: fallbackRate },
      { ate: 110, aliquota: fallbackRate + 1 },
      { acima: 110, aliquota: fallbackRate + 2 },
    ]
  }

  const tiers: Array<CommissionTier | null> = value
    .map((tier) => {
      if (!tier || typeof tier !== 'object') return null
      const item = tier as Record<string, unknown>
      const aliquota = parseNumber(item.aliquota, fallbackRate)
      const ate = item.ate === null || item.ate === undefined ? undefined : parseNumber(item.ate)
      const acima = item.acima === null || item.acima === undefined ? undefined : parseNumber(item.acima)
      return { ate, acima, aliquota }
    })

  return tiers.filter((tier): tier is CommissionTier => tier !== null)
}

export function normalizeKpiRules(value: unknown): KpiRule[] {
  if (!Array.isArray(value)) return DEFAULT_COMMISSION_CONFIG.regras_kpi

  const rules = value
    .map((rule) => {
      if (!rule || typeof rule !== 'object') return null
      const item = rule as Record<string, unknown>
      const nome = String(item.nome ?? '').trim()
      if (!nome) return null
      return {
        nome,
        meta_pct: parseNumber(item.meta_pct, 0),
        bonus: parseNumber(item.bonus, 0),
      }
    })
    .filter((rule): rule is KpiRule => Boolean(rule))

  return rules.length > 0 ? rules : DEFAULT_COMMISSION_CONFIG.regras_kpi
}

export function normalizeConfig(row: Record<string, unknown> | null | undefined): CommissionConfig {
  if (!row) return DEFAULT_COMMISSION_CONFIG

  const aliquotaBase = parseNumber(row.aliquota_base, DEFAULT_COMMISSION_CONFIG.aliquota_base)

  return {
    aliquota_base: aliquotaBase,
    acelerador_threshold: parseNumber(row.acelerador_threshold, DEFAULT_COMMISSION_CONFIG.acelerador_threshold),
    acelerador_rate: parseNumber(row.acelerador_rate, DEFAULT_COMMISSION_CONFIG.acelerador_rate),
    bonus_missao: parseNumber(row.bonus_missao, DEFAULT_COMMISSION_CONFIG.bonus_missao),
    salario_base: parseNumber(row.salario_base, DEFAULT_COMMISSION_CONFIG.salario_base),
    periodo: (row.periodo as CommissionConfig['periodo']) ?? DEFAULT_COMMISSION_CONFIG.periodo,
    elegibilidade: parseNumber(row.elegibilidade, DEFAULT_COMMISSION_CONFIG.elegibilidade),
    piso_comissao: parseNumber(row.piso_comissao, DEFAULT_COMMISSION_CONFIG.piso_comissao),
    teto_comissao: row.teto_comissao === null || row.teto_comissao === undefined ? null : parseNumber(row.teto_comissao),
    bonus_kpi: parseNumber(row.bonus_kpi, DEFAULT_COMMISSION_CONFIG.bonus_kpi),
    modelo: (row.modelo as CommissionModel) ?? DEFAULT_COMMISSION_CONFIG.modelo,
    faixas: normalizeTiers(row.faixas, aliquotaBase),
    regras_kpi: normalizeKpiRules(row.regras_kpi),
    acelerador_ativo: typeof row.acelerador_ativo === 'boolean' ? row.acelerador_ativo : DEFAULT_COMMISSION_CONFIG.acelerador_ativo,
    acelerador_multiplicador: parseNumber(row.acelerador_multiplicador, DEFAULT_COMMISSION_CONFIG.acelerador_multiplicador),
    dia_corte: parseNumber(row.dia_corte, DEFAULT_COMMISSION_CONFIG.dia_corte),
    fechamento_automatico: typeof row.fechamento_automatico === 'boolean' ? row.fechamento_automatico : DEFAULT_COMMISSION_CONFIG.fechamento_automatico,
  }
}

export function getCurrentPeriodReference(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

export function getPeriodLabel(reference = getCurrentPeriodReference()) {
  const [year, month] = reference.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, 1)
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function daysUntilCutoff(day: number, date = new Date()) {
  const safeDay = Math.min(Math.max(Math.round(day || 1), 1), 31)
  const cutoff = new Date(date.getFullYear(), date.getMonth(), safeDay)
  if (date > cutoff) cutoff.setMonth(cutoff.getMonth() + 1)
  return Math.max(0, Math.ceil((cutoff.getTime() - date.getTime()) / 86400000))
}

export function getTierForGoal(goalPct: number, tiers: CommissionTier[]) {
  const sorted = [...tiers].sort((a, b) => {
    const aLimit = a.ate ?? a.acima ?? 0
    const bLimit = b.ate ?? b.acima ?? 0
    return aLimit - bLimit
  })

  return sorted.find((tier) => tier.ate !== undefined && goalPct <= tier.ate)
    ?? [...sorted].reverse().find((tier) => tier.acima !== undefined && goalPct > tier.acima)
    ?? sorted[sorted.length - 1]
    ?? DEFAULT_COMMISSION_CONFIG.faixas[0]
}

export function calculateCommission(input: {
  user_id: string
  name: string
  sales_revenue: number
  goal_target: number
  missions_completed: number
  config: CommissionConfig
  kpiProgress?: { nome: string; pct: number }[]
}): CommissionCalculation {
  const { config } = input
  const goalPct = input.goal_target > 0 ? Math.round((input.sales_revenue / input.goal_target) * 100) : 0
  const tier = getTierForGoal(goalPct, config.faixas)
  const eligible = goalPct >= config.elegibilidade
  const hasFixed = config.modelo !== 'apenas_percentual'
  const hasVariable = config.modelo !== 'apenas_fixo' && eligible
  const baseSalary = hasFixed ? config.salario_base : 0
  const rawSalesCommission = hasVariable ? input.sales_revenue * (tier.aliquota / 100) : 0
  const acceleratorMult = config.acelerador_ativo && goalPct >= config.acelerador_threshold
    ? config.acelerador_multiplicador
    : 1
  const salesCommission = Math.round(rawSalesCommission * acceleratorMult)
  const missionBonus = input.missions_completed * config.bonus_missao
  const kpiBonus = config.regras_kpi.reduce((sum, rule) => {
    const progress = input.kpiProgress?.find((kpi) => kpi.nome === rule.nome)?.pct ?? rule.meta_pct
    return progress >= rule.meta_pct ? sum + rule.bonus : sum
  }, config.bonus_kpi)

  let variableTotal = salesCommission + missionBonus + kpiBonus
  if (config.piso_comissao > 0) variableTotal = Math.max(variableTotal, config.piso_comissao)
  if (config.teto_comissao !== null && config.teto_comissao > 0) variableTotal = Math.min(variableTotal, config.teto_comissao)

  const lineItems: CommissionLineItem[] = [
    {
      tipo: 'venda',
      descricao: `${formatCurrency(input.sales_revenue)} em vendas x ${tier.aliquota}%`,
      valor: salesCommission,
    },
    {
      tipo: 'missao',
      descricao: `${input.missions_completed} missoes concluidas x ${formatCurrency(config.bonus_missao)}`,
      valor: missionBonus,
    },
    ...config.regras_kpi.map((rule) => ({
      tipo: 'kpi' as const,
      descricao: `${rule.nome}: meta ${rule.meta_pct}%`,
      valor: rule.bonus,
    })),
  ]

  if (acceleratorMult > 1) {
    lineItems.push({
      tipo: 'acelerador',
      descricao: `Acelerador ${acceleratorMult}x aplicado acima de ${config.acelerador_threshold}% da meta`,
      valor: salesCommission - Math.round(rawSalesCommission),
    })
  }

  return {
    user_id: input.user_id,
    name: input.name,
    base_salary: baseSalary,
    sales_revenue: input.sales_revenue,
    sales_commission: salesCommission,
    mission_bonus: missionBonus,
    kpi_bonus: kpiBonus,
    accelerator_mult: acceleratorMult,
    total: baseSalary + variableTotal,
    goal_pct: goalPct,
    missions_completed: input.missions_completed,
    status: 'calculated',
    calculated_at: new Date().toISOString(),
    line_items: lineItems,
  }
}

export function statusLabel(status: CommissionPeriodStatus | CommissionCalculationStatus) {
  const labels: Record<string, string> = {
    open: 'Aberto',
    calculating: 'Calculando',
    pending_approval: 'Aguardando aprovacao',
    approved: 'Aprovado',
    paid: 'Pago',
    draft: 'Rascunho',
    calculated: 'Calculado',
    disputed: 'Contestado',
  }

  return labels[status] ?? status
}
