export type CommissionPeriodStatus = 'open' | 'calculating' | 'pending_approval' | 'approved' | 'paid' | 'in_review' | 'closed'
export type CommissionCalculationStatus = 'draft' | 'calculated' | 'pending_approval' | 'approved' | 'paid' | 'disputed'
export type CommissionModel = 'fixo_mais_percentual' | 'apenas_percentual' | 'apenas_fixo'
export type CommissionLineItemType = 'venda' | 'missao' | 'kpi' | 'acelerador' | 'ajuste'
export type CommissionRuleType =
  | 'seller'
  | 'product'
  | 'category'
  | 'commercial_table'
  | 'seller_product'
  | 'seller_commercial_table'
  | 'company_default'
export type CommissionCalculationBase = 'sale_amount' | 'received_amount'
export type CommissionEntryStatus = 'confirmed' | 'pending' | 'disputed' | 'cancelled' | 'adjusted' | 'paid'
export type CommissionDisputeStatus = 'under_review' | 'approved' | 'rejected' | 'corrected'

export interface CommissionRule {
  id?: string
  organization_id?: string
  company_id?: string
  name: string
  description?: string | null
  rule_type: CommissionRuleType
  seller_id?: string | null
  product_id?: string | null
  category_id?: string | null
  commercial_table_id?: string | null
  percentage: number
  calculation_base: CommissionCalculationBase
  priority: number
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface CommissionSaleInput {
  id: string
  organization_id: string
  seller_id: string
  seller_name?: string
  customer_id?: string | null
  customer_name?: string | null
  product_id?: string | null
  product_name?: string | null
  category_id?: string | null
  category_name?: string | null
  commercial_table_id?: string | null
  commercial_table_name?: string | null
  sale_amount: number
  received_amount: number
  sale_date: string
  title?: string | null
}

export interface CommissionEntryDraft {
  id?: string
  organization_id: string
  company_id?: string
  seller_id: string
  seller_name?: string
  sale_id: string
  customer_id?: string | null
  customer_name?: string | null
  product_id?: string | null
  product_name?: string | null
  category_id?: string | null
  category_name?: string | null
  commercial_table_id?: string | null
  commercial_table_name?: string | null
  commission_rule_id?: string | null
  rule_name: string
  period_reference: string
  sale_amount: number
  received_amount: number
  base_amount: number
  commission_percentage: number
  commission_amount: number
  status: CommissionEntryStatus
  status_reason: string
  competence_date: string
  confirmed_at?: string | null
  paid_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface CommissionDispute {
  id: string
  organization_id: string
  commission_entry_id: string
  seller_id: string
  reason: string
  description: string | null
  status: CommissionDisputeStatus
  manager_response: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at?: string
}

export interface CommissionSellerSummary {
  seller_id: string
  seller_name: string
  sales_count: number
  confirmed: number
  pending: number
  disputed: number
  estimated: number
  status: 'in_progress' | 'with_dispute' | 'closed'
}

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

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
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

export function getD1Date(date = new Date()) {
  const d1 = new Date(date)
  d1.setHours(0, 0, 0, 0)
  d1.setDate(d1.getDate() - 1)
  return d1
}

export function formatDatePtBr(date: string | Date | null | undefined) {
  if (!date) return '-'
  const parsed = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pt-BR')
}

export function formatD1Message(date = new Date()) {
  return `Parcial atualizada com dados ate ${formatDatePtBr(getD1Date(date))}.`
}

export function getCompetenceReference(dateValue: string | Date = new Date()) {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue
  return getCurrentPeriodReference(Number.isNaN(date.getTime()) ? new Date() : date)
}

function cleanId(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  return normalized.length > 0 ? normalized : null
}

function ruleMatches(rule: CommissionRule, sale: CommissionSaleInput) {
  const sellerId = cleanId(rule.seller_id)
  const productId = cleanId(rule.product_id)
  const categoryId = cleanId(rule.category_id)
  const commercialTableId = cleanId(rule.commercial_table_id)

  if (sellerId && sellerId !== sale.seller_id) return false
  if (productId && productId !== cleanId(sale.product_id)) return false
  if (categoryId && categoryId !== cleanId(sale.category_id)) return false
  if (commercialTableId && commercialTableId !== cleanId(sale.commercial_table_id)) return false

  switch (rule.rule_type) {
    case 'seller_product':
      return Boolean(sellerId && productId)
    case 'seller_commercial_table':
      return Boolean(sellerId && commercialTableId)
    case 'product':
      return Boolean(productId)
    case 'category':
      return Boolean(categoryId)
    case 'commercial_table':
      return Boolean(commercialTableId)
    case 'seller':
      return Boolean(sellerId)
    case 'company_default':
      return true
    default:
      return false
  }
}

function ruleSpecificity(rule: CommissionRule) {
  const byType: Record<CommissionRuleType, number> = {
    seller_product: 700,
    seller_commercial_table: 600,
    product: 500,
    category: 400,
    commercial_table: 300,
    seller: 200,
    company_default: 100,
  }

  return byType[rule.rule_type] ?? 0
}

export function findApplicableCommissionRule(rules: CommissionRule[], sale: CommissionSaleInput): CommissionRule {
  const activeRules = rules.filter((rule) => rule.active !== false && ruleMatches(rule, sale))
  const selected = activeRules.sort((a, b) => {
    const priorityDiff = parseNumber(a.priority, 99) - parseNumber(b.priority, 99)
    if (priorityDiff !== 0) return priorityDiff
    return ruleSpecificity(b) - ruleSpecificity(a)
  })[0]

  return selected ?? {
    name: 'Regra padrão da empresa',
    rule_type: 'company_default',
    percentage: 0,
    calculation_base: 'sale_amount',
    priority: 99,
    active: true,
  }
}

function baseEntry(sale: CommissionSaleInput, rule: CommissionRule, periodReference: string) {
  return {
    organization_id: sale.organization_id,
    company_id: sale.organization_id,
    seller_id: sale.seller_id,
    seller_name: sale.seller_name,
    sale_id: sale.id,
    customer_id: sale.customer_id ?? null,
    customer_name: sale.customer_name ?? null,
    product_id: sale.product_id ?? null,
    product_name: sale.product_name ?? sale.title ?? 'Venda',
    category_id: sale.category_id ?? null,
    category_name: sale.category_name ?? 'Sem categoria',
    commercial_table_id: sale.commercial_table_id ?? null,
    commercial_table_name: sale.commercial_table_name ?? 'Tabela padrão',
    commission_rule_id: rule.id ?? null,
    rule_name: rule.name,
    period_reference: periodReference,
    sale_amount: roundMoney(sale.sale_amount),
    received_amount: roundMoney(sale.received_amount),
    commission_percentage: parseNumber(rule.percentage),
    competence_date: sale.sale_date,
  }
}

export function calculateCommissionEntriesForSale(
  sale: CommissionSaleInput,
  rules: CommissionRule[],
  periodReference = getCompetenceReference(sale.sale_date)
): CommissionEntryDraft[] {
  const rule = findApplicableCommissionRule(rules, sale)
  const percentage = parseNumber(rule.percentage)
  const base = baseEntry(sale, rule, periodReference)

  if (rule.calculation_base === 'received_amount') {
    const receivedBase = Math.min(roundMoney(sale.received_amount), roundMoney(sale.sale_amount))
    const pendingBase = Math.max(0, roundMoney(sale.sale_amount - receivedBase))
    const entries: CommissionEntryDraft[] = []

    if (receivedBase > 0) {
      entries.push({
        ...base,
        base_amount: receivedBase,
        commission_amount: roundMoney(receivedBase * percentage / 100),
        status: 'confirmed',
        status_reason: 'Confirmada porque o valor entrou no caixa.',
        confirmed_at: sale.sale_date,
      })
    }

    if (pendingBase > 0) {
      entries.push({
        ...base,
        base_amount: pendingBase,
        commission_amount: roundMoney(pendingBase * percentage / 100),
        status: 'pending',
        status_reason: 'Pendente porque a venda ainda não foi totalmente recebida.',
        confirmed_at: null,
      })
    }

    return entries
  }

  const saleBase = roundMoney(sale.sale_amount)
  return [{
    ...base,
    base_amount: saleBase,
    commission_amount: roundMoney(saleBase * percentage / 100),
    status: 'confirmed',
    status_reason: 'Confirmada com base na venda realizada.',
    confirmed_at: sale.sale_date,
  }]
}

export function buildCommissionEntries(sales: CommissionSaleInput[], rules: CommissionRule[], d1Date = getD1Date()) {
  const cutoff = new Date(d1Date)
  cutoff.setHours(23, 59, 59, 999)

  return sales
    .filter((sale) => {
      const saleDate = new Date(sale.sale_date)
      return !Number.isNaN(saleDate.getTime()) && saleDate <= cutoff
    })
    .flatMap((sale) => calculateCommissionEntriesForSale(sale, rules, getCompetenceReference(sale.sale_date)))
}

export function summarizeCommissionEntries(entries: CommissionEntryDraft[]): CommissionSellerSummary[] {
  const bySeller = new Map<string, CommissionSellerSummary>()

  for (const entry of entries) {
    const current = bySeller.get(entry.seller_id) ?? {
      seller_id: entry.seller_id,
      seller_name: entry.seller_name ?? 'Vendedor',
      sales_count: 0,
      confirmed: 0,
      pending: 0,
      disputed: 0,
      estimated: 0,
      status: 'in_progress' as const,
    }

    if (!bySeller.has(entry.seller_id)) bySeller.set(entry.seller_id, current)
    current.sales_count = new Set(entries.filter((item) => item.seller_id === entry.seller_id).map((item) => item.sale_id)).size
    if (entry.status === 'confirmed' || entry.status === 'adjusted' || entry.status === 'paid') current.confirmed += entry.commission_amount
    if (entry.status === 'pending') current.pending += entry.commission_amount
    if (entry.status === 'disputed') current.disputed += entry.commission_amount
    current.estimated += entry.commission_amount
    current.status = current.disputed > 0 ? 'with_dispute' : 'in_progress'
  }

  return [...bySeller.values()]
    .map((item) => ({
      ...item,
      confirmed: roundMoney(item.confirmed),
      pending: roundMoney(item.pending),
      disputed: roundMoney(item.disputed),
      estimated: roundMoney(item.estimated),
    }))
    .sort((a, b) => b.estimated - a.estimated)
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

export function statusLabel(status: CommissionPeriodStatus | CommissionCalculationStatus | CommissionEntryStatus | CommissionDisputeStatus) {
  const labels: Record<string, string> = {
    open: 'Aberto',
    calculating: 'Calculando',
    pending_approval: 'Aguardando aprovação',
    approved: 'Aprovado',
    in_review: 'Em revisao',
    closed: 'Fechado',
    paid: 'Pago',
    draft: 'Rascunho',
    calculated: 'Calculado',
    disputed: 'Contestado',
    confirmed: 'Confirmada',
    pending: 'Pendente',
    cancelled: 'Cancelada',
    adjusted: 'Ajustada',
    under_review: 'Em analise',
    rejected: 'Recusada',
    corrected: 'Corrigida',
  }

  return labels[status] ?? status
}
