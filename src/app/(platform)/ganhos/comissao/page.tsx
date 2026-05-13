'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, Clock, Download, Eye, FileText, ReceiptText, Send, ShieldAlert, TrendingUp } from 'lucide-react'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import { ContextualRecommendationCard, type ContextualRecommendation } from '@/components/performance-os/ContextualRecommendationCard'
import {
  buildCommissionEntries,
  calculateCommissionEntriesForSale,
  formatCurrency,
  formatD1Message,
  formatDatePtBr,
  getCurrentPeriodReference,
  getD1Date,
  statusLabel,
  type CommissionDispute,
  type CommissionEntryDraft,
  type CommissionEntryStatus,
  type CommissionRule,
  type CommissionSaleInput,
} from '@/lib/commission'

interface DealRow {
  id: string
  owner_id: string
  title: string
  value: number | string
  received_amount?: number | string | null
  stage?: string | null
  probability?: number | string | null
  next_action_title?: string | null
  next_action_due_at?: string | null
  expected_close: string | null
  updated_at: string | null
  account_id: string | null
  product_id?: string | null
  product_name?: string | null
  category_id?: string | null
  category_name?: string | null
  commercial_table_id?: string | null
  commercial_table_name?: string | null
  crm_accounts?: { name?: string | null } | null
}

interface PotentialCommission {
  dealId: string
  title: string
  customerName: string
  dealValue: number
  probability: number
  commissionAmount: number
  weightedCommission: number
  nextActionTitle: string | null
  nextActionDueAt: string | null
}

const reasons = [
  'venda nao apareceu no extrato',
  'valor da venda esta errado',
  'percentual de comissao esta errado',
  'venda esta atribuida ao vendedor errado',
  'venda aparece como pendente, mas ja foi recebida',
  'produto/tabela foi classificado de forma errada',
  'outro motivo',
]

const statusTone: Record<CommissionEntryStatus, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-700',
  pending: 'bg-amber-500/10 text-amber-700',
  disputed: 'bg-red-500/10 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
  adjusted: 'bg-blue-500/10 text-blue-700',
  paid: 'bg-green-500/10 text-green-700',
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function inCurrentReference(dateValue: string | null | undefined, reference: string) {
  if (!dateValue) return true
  const [year, month] = reference.split('-').map(Number)
  const date = new Date(dateValue)
  return date.getFullYear() === year && date.getMonth() === month - 1
}

export default function ComissaoPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<CommissionEntryDraft[]>([])
  const [disputes, setDisputes] = useState<CommissionDispute[]>([])
  const [potentialCommissions, setPotentialCommissions] = useState<PotentialCommission[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | CommissionEntryStatus>('all')
  const [search, setSearch] = useState('')
  const [contestReason, setContestReason] = useState<Record<string, string>>({})
  const [contestDescription, setContestDescription] = useState<Record<string, string>>({})
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([])
  const [sending, setSending] = useState<string | null>(null)
  const reference = getCurrentPeriodReference()

  const buildSales = useCallback((deals: DealRow[]): CommissionSaleInput[] => {
    if (!user) return []
    return deals
      .filter((deal) => inCurrentReference(deal.expected_close ?? deal.updated_at, reference))
      .map((deal) => ({
        id: deal.id,
        organization_id: user.organization_id,
        seller_id: user.id,
        seller_name: user.name,
        customer_id: deal.account_id,
        customer_name: deal.crm_accounts?.name ?? 'Cliente sem nome',
        product_id: deal.product_id ?? deal.product_name ?? null,
        product_name: deal.product_name ?? deal.title,
        category_id: deal.category_id ?? deal.category_name ?? null,
        category_name: deal.category_name ?? 'Sem categoria',
        commercial_table_id: deal.commercial_table_id ?? deal.commercial_table_name ?? null,
        commercial_table_name: deal.commercial_table_name ?? 'Tabela padrao',
        sale_amount: toNumber(deal.value),
        received_amount: toNumber(deal.received_amount),
        sale_date: deal.expected_close ?? deal.updated_at ?? new Date().toISOString(),
        title: deal.title,
      }))
  }, [reference, user])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: persistedEntries }, { data: disputeRows }, { data: ruleRows }, { data: dealRows }, { data: openDealRows }, recommendationsRes] = await Promise.all([
        supabase
          .from('commission_entries')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('seller_id', user.id)
          .eq('period_reference', reference)
          .order('competence_date', { ascending: false }),
        supabase
          .from('commission_disputes')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('commission_rules')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .order('priority', { ascending: true }),
        supabase
          .from('crm_deals')
          .select('id, owner_id, title, value, received_amount, stage, probability, next_action_title, next_action_due_at, expected_close, updated_at, account_id, product_id, product_name, category_id, category_name, commercial_table_id, commercial_table_name, crm_accounts(name)')
          .eq('organization_id', user.organization_id)
          .eq('owner_id', user.id)
          .eq('stage', 'closed_won'),
        supabase
          .from('crm_deals')
          .select('id, owner_id, title, value, received_amount, stage, probability, next_action_title, next_action_due_at, expected_close, updated_at, account_id, product_id, product_name, category_id, category_name, commercial_table_id, commercial_table_name, crm_accounts(name)')
          .eq('organization_id', user.organization_id)
          .eq('owner_id', user.id)
          .not('stage', 'in', '("closed_won","closed_lost")')
          .order('value', { ascending: false })
          .limit(5),
        fetch('/api/action-recommendations'),
      ])

      const rows = ((persistedEntries ?? []) as CommissionEntryDraft[]).map((entry) => ({
        ...entry,
        seller_name: user.name,
      }))
      if (rows.length > 0) {
        setEntries(rows)
      } else {
        setEntries(buildCommissionEntries(buildSales((dealRows ?? []) as DealRow[]), (ruleRows ?? []) as CommissionRule[], getD1Date()))
      }
      const rules = (ruleRows ?? []) as CommissionRule[]
      const potential = ((openDealRows ?? []) as DealRow[]).map((deal) => {
        const sale: CommissionSaleInput = {
          id: deal.id,
          organization_id: user.organization_id,
          seller_id: user.id,
          seller_name: user.name,
          customer_id: deal.account_id,
          customer_name: deal.crm_accounts?.name ?? 'Cliente sem nome',
          product_id: deal.product_id ?? deal.product_name ?? null,
          product_name: deal.product_name ?? deal.title,
          category_id: deal.category_id ?? deal.category_name ?? null,
          category_name: deal.category_name ?? 'Sem categoria',
          commercial_table_id: deal.commercial_table_id ?? deal.commercial_table_name ?? null,
          commercial_table_name: deal.commercial_table_name ?? 'Tabela padrao',
          sale_amount: toNumber(deal.value),
          received_amount: 0,
          sale_date: deal.expected_close ?? deal.updated_at ?? new Date().toISOString(),
          title: deal.title,
        }
        const commissionAmount = calculateCommissionEntriesForSale(sale, rules)
          .reduce((sum, entry) => sum + entry.commission_amount, 0)
        const probability = toNumber(deal.probability)
        return {
          dealId: deal.id,
          title: deal.title,
          customerName: deal.crm_accounts?.name ?? 'Cliente sem nome',
          dealValue: toNumber(deal.value),
          probability,
          commissionAmount,
          weightedCommission: commissionAmount * probability / 100,
          nextActionTitle: deal.next_action_title ?? null,
          nextActionDueAt: deal.next_action_due_at ?? null,
        }
      }).filter((item) => item.commissionAmount > 0)
      setPotentialCommissions(potential)
      setDisputes((disputeRows ?? []) as CommissionDispute[])
      if (recommendationsRes.ok) {
        const body = await recommendationsRes.json().catch(() => ({ recommendations: [] }))
        setRecommendations(((body.recommendations ?? []) as ContextualRecommendation[])
          .filter((item) => ['commission', 'crm'].includes(item.source_module))
          .slice(0, 2))
      }
    } catch {
      toast.error('Nao foi possivel carregar seus ganhos')
    } finally {
      setLoading(false)
    }
  }, [buildSales, reference, supabase, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const visibleEntries = useMemo(() => entries.filter((entry) => {
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter
    const haystack = `${entry.customer_name} ${entry.product_name} ${entry.commercial_table_name} ${entry.rule_name}`.toLowerCase()
    return matchesStatus && haystack.includes(search.toLowerCase())
  }), [entries, search, statusFilter])

  const summary = useMemo(() => {
    const confirmed = entries.filter((entry) => ['confirmed', 'adjusted', 'paid'].includes(entry.status)).reduce((sum, entry) => sum + entry.commission_amount, 0)
    const pending = entries.filter((entry) => entry.status === 'pending').reduce((sum, entry) => sum + entry.commission_amount, 0)
    const disputed = entries.filter((entry) => entry.status === 'disputed').reduce((sum, entry) => sum + entry.commission_amount, 0)
    const estimated = entries.reduce((sum, entry) => sum + entry.commission_amount, 0)
    const potential = potentialCommissions.reduce((sum, entry) => sum + entry.weightedCommission, 0)
    return { confirmed, pending, disputed, estimated, potential, accumulated: confirmed + pending + disputed }
  }, [entries, potentialCommissions])

  const disputeByEntry = useMemo(() => new Map(disputes.map((dispute) => [dispute.commission_entry_id, dispute])), [disputes])

  const commissionRecommendation = useMemo<ContextualRecommendation | null>(() => {
    if (recommendations[0]) return recommendations[0]
    if (summary.disputed > 0) {
      return {
        id: 'commission-disputed',
        title: 'Acompanhar contestacoes abertas',
        description: 'Existe valor em disputa. Revise os detalhes do extrato e acompanhe a resposta do gestor para destravar o pagamento correto.',
        priority: 'high',
        status: 'open',
        suggested_action_label: 'Filtrar contestadas',
        suggested_action_href: '/ganhos/comissao',
        recommendation_type: 'commission_follow_up',
        source_module: 'commission',
      }
    }
    if (summary.pending > 0) {
      return {
        id: 'commission-pending',
        title: 'Transformar comissao pendente em recebida',
        description: 'Ha comissao aguardando entrada no caixa. Priorize deals com parcela pendente antes de considerar esse valor como ganho liberado.',
        priority: 'medium',
        status: 'open',
        suggested_action_label: 'Ver pipeline',
        suggested_action_href: '/crm',
        recommendation_type: 'cash_collection',
        source_module: 'commission',
      }
    }
    return null
  }, [recommendations, summary.disputed, summary.pending])

  const contestEntry = async (entry: CommissionEntryDraft) => {
    if (!user || !entry.id) {
      toast.error('Esta linha ainda precisa ser recalculada pelo gestor antes de ser contestada')
      return
    }
    const reason = contestReason[entry.id] ?? reasons[0]
    const description = contestDescription[entry.id] ?? ''
    setSending(entry.id)
    try {
      const { error } = await supabase.from('commission_disputes').insert({
        organization_id: user.organization_id,
        company_id: user.organization_id,
        commission_entry_id: entry.id,
        seller_id: user.id,
        reason,
        description,
        status: 'under_review',
      })
      if (error) throw error

      await supabase
        .from('commission_entries')
        .update({ status: 'disputed', status_reason: 'Contestada pelo vendedor e enviada para analise do gestor.' })
        .eq('id', entry.id)

      toast.success('Contestacao enviada para analise')
      fetchData()
    } catch {
      toast.error('Erro ao enviar contestacao')
    } finally {
      setSending(null)
    }
  }

  const exportCsv = () => {
    const header = ['Data', 'Cliente', 'Produto/Tabela', 'Valor base', 'Percentual', 'Comissao', 'Status', 'Regra']
    const rows = visibleEntries.map((entry) => [
      formatDatePtBr(entry.competence_date),
      entry.customer_name ?? '',
      entry.product_name ?? entry.commercial_table_name ?? '',
      entry.base_amount,
      `${entry.commission_percentage}%`,
      entry.commission_amount,
      statusLabel(entry.status),
      entry.rule_name,
    ])
    const csv = [header, ...rows].map((row) => row.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `meus-ganhos-${reference}.csv`
    link.click()
    URL.revokeObjectURL(url)
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
      <PageHeader
        label="Ganhos"
        title={<>Meus <TitleHighlight>Ganhos</TitleHighlight></>}
        description={formatD1Message()}
        actions={<Badge className="border-0 bg-primary/10 text-primary">Atualizacao D-1</Badge>}
      />

      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="pt-4 text-sm text-muted-foreground">
          <strong className="text-foreground">Comissao recompensa.</strong> Comissao mostra o impacto financeiro do que ja foi vendido e do que ainda pode ser destravado. Valores potenciais sao estimativas de oportunidades abertas e nao sao garantidos.
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Summary icon={TrendingUp} label="Comissao acumulada ate ontem" value={formatCurrency(summary.accumulated)} tone="text-primary bg-primary/10" />
        <Summary icon={CheckCircle2} label="Comissao confirmada" value={formatCurrency(summary.confirmed)} tone="text-emerald-700 bg-emerald-500/10" />
        <Summary icon={Clock} label="Comissao pendente" value={formatCurrency(summary.pending)} tone="text-amber-700 bg-amber-500/10" />
        <Summary icon={TrendingUp} label="Comissao potencial" value={formatCurrency(summary.potential)} tone="text-blue-700 bg-blue-500/10" />
        <Summary icon={ShieldAlert} label="Em contestacao" value={formatCurrency(summary.disputed)} tone="text-red-700 bg-red-500/10" />
        <Summary icon={ReceiptText} label="Total estimado do mes" value={formatCurrency(summary.estimated)} tone="text-blue-700 bg-blue-500/10" />
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-5 text-sm text-muted-foreground">
          Confirmada ja foi reconhecida pela regra da empresa. Pendente depende de recebimento, validacao ou regra interna. Potencial e estimativa de oportunidades abertas se a venda for ganha.
        </CardContent>
      </Card>

      {potentialCommissions.length > 0 && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Oportunidades que podem destravar comissao
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {potentialCommissions.map((item) => (
              <div key={item.dealId} className="rounded-lg border border-blue-500/20 bg-background/70 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{item.customerName} - {item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Valor: {formatCurrency(item.dealValue)} | Probabilidade: {item.probability}% | Proxima acao: {item.nextActionTitle || 'definir proxima acao'}
                    </p>
                  </div>
                  <div className="text-sm md:text-right">
                    <p className="font-semibold text-blue-600">{formatCurrency(item.weightedCommission)} potencial ponderado</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.commissionAmount)} se a venda for ganha</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {commissionRecommendation && (
        <ContextualRecommendationCard recommendation={commissionRecommendation} />
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-primary" />
              Extrato do vendedor
            </CardTitle>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Baixar extrato
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, produto, tabela ou regra" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | CommissionEntryStatus)} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
              <option value="all">Todos status</option>
              {(['confirmed', 'pending', 'disputed', 'adjusted', 'paid', 'cancelled'] as CommissionEntryStatus[]).map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </div>

          {visibleEntries.length === 0 ? (
            <div className="py-10 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma comissao encontrada para este periodo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Data', 'Cliente', 'Produto/Tabela', 'Valor base', '%', 'Comissao', 'Status', ''].map((head) => (
                      <th key={head} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => {
                    const dispute = entry.id ? disputeByEntry.get(entry.id) : null
                    return (
                      <tr key={`${entry.sale_id}-${entry.status}-${entry.id}`} className="border-b border-border/30 align-top last:border-0">
                        <td className="px-3 py-3">{formatDatePtBr(entry.competence_date)}</td>
                        <td className="px-3 py-3">{entry.customer_name}</td>
                        <td className="px-3 py-3">
                          <p className="font-medium">{entry.product_name}</p>
                          <p className="text-xs text-muted-foreground">{entry.commercial_table_name}</p>
                        </td>
                        <td className="px-3 py-3 text-right">{formatCurrency(entry.base_amount)}</td>
                        <td className="px-3 py-3 text-right">{entry.commission_percentage}%</td>
                        <td className="px-3 py-3 text-right font-semibold">{formatCurrency(entry.commission_amount)}</td>
                        <td className="px-3 py-3">
                          <Badge className={`border-0 text-[10px] ${statusTone[entry.status]}`}>{statusLabel(entry.status)}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <details>
                            <summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="h-3 w-3" />
                              Detalhes
                            </summary>
                            <div className="mt-3 w-[320px] max-w-[75vw] space-y-3 rounded-lg border border-border/40 bg-background p-3">
                              <div className="space-y-1 text-xs">
                                <p><span className="text-muted-foreground">Regra aplicada:</span> {entry.rule_name}</p>
                                <p><span className="text-muted-foreground">Motivo do status:</span> {entry.status_reason}</p>
                                <p><span className="text-muted-foreground">Valor da venda:</span> {formatCurrency(entry.sale_amount)}</p>
                                <p><span className="text-muted-foreground">Valor recebido:</span> {formatCurrency(entry.received_amount)}</p>
                              </div>
                              {dispute ? (
                                <div className="rounded-md bg-muted/40 p-2 text-xs">
                                  <p className="font-medium">Contestacao: {statusLabel(dispute.status)}</p>
                                  <p className="mt-1 text-muted-foreground">{dispute.manager_response || dispute.description || dispute.reason}</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <select
                                    value={entry.id ? contestReason[entry.id] ?? reasons[0] : reasons[0]}
                                    onChange={(event) => entry.id && setContestReason((prev) => ({ ...prev, [entry.id as string]: event.target.value }))}
                                    className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs"
                                  >
                                    {reasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                                  </select>
                                  <Textarea
                                    value={entry.id ? contestDescription[entry.id] ?? '' : ''}
                                    onChange={(event) => entry.id && setContestDescription((prev) => ({ ...prev, [entry.id as string]: event.target.value }))}
                                    placeholder="Observacao para o gestor"
                                    className="text-xs"
                                  />
                                  <Button size="sm" onClick={() => contestEntry(entry)} disabled={!entry.id || sending === entry.id} className="w-full">
                                    <Send className="mr-1 h-3.5 w-3.5" />
                                    {sending === entry.id ? 'Enviando...' : 'Contestar comissao'}
                                  </Button>
                                  {!entry.id && <p className="text-xs text-muted-foreground">A contestacao fica disponivel depois que o gestor recalcula a parcial.</p>}
                                </div>
                              )}
                            </div>
                          </details>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof TrendingUp; label: string; value: string; tone: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
