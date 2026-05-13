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
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  buildCommissionEntries,
  formatCurrency,
  formatD1Message,
  formatDatePtBr,
  getCurrentPeriodReference,
  getD1Date,
  getPeriodLabel,
  statusLabel,
  summarizeCommissionEntries,
  type CommissionDispute,
  type CommissionDisputeStatus,
  type CommissionEntryDraft,
  type CommissionEntryStatus,
  type CommissionRule,
  type CommissionSaleInput,
  type CommissionSellerSummary,
} from '@/lib/commission'

interface Seller {
  id: string
  name: string
}

interface DealRow {
  id: string
  owner_id: string
  title: string
  value: number | string
  received_amount?: number | string | null
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

const statusTone: Record<CommissionEntryStatus | string, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-700',
  pending: 'bg-amber-500/10 text-amber-700',
  disputed: 'bg-red-500/10 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
  adjusted: 'bg-blue-500/10 text-blue-700',
  paid: 'bg-green-500/10 text-green-700',
}

const disputeTone: Record<CommissionDisputeStatus, string> = {
  under_review: 'bg-amber-500/10 text-amber-700',
  approved: 'bg-emerald-500/10 text-emerald-700',
  rejected: 'bg-muted text-muted-foreground',
  corrected: 'bg-blue-500/10 text-blue-700',
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function monthBounds(reference: string) {
  const [year, month] = reference.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { start, end }
}

function inReference(dateValue: string | null | undefined, reference: string) {
  if (!dateValue) return true
  const date = new Date(dateValue)
  const { start, end } = monthBounds(reference)
  end.setHours(23, 59, 59, 999)
  return date >= start && date <= end
}

export default function ComissionamentoPage() {
  const { user } = useRequiredAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [closing, setClosing] = useState(false)
  const [tab, setTab] = useState<'resumo' | 'extrato' | 'contestacoes'>('resumo')
  const [sellerFilter, setSellerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | CommissionEntryStatus>('all')
  const [search, setSearch] = useState('')
  const [entries, setEntries] = useState<CommissionEntryDraft[]>([])
  const [previewEntries, setPreviewEntries] = useState<CommissionEntryDraft[]>([])
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [disputes, setDisputes] = useState<CommissionDispute[]>([])
  const [managerResponse, setManagerResponse] = useState<Record<string, string>>({})
  const reference = getCurrentPeriodReference()

  const buildSales = useCallback((deals: DealRow[], sellerName: Map<string, string>) => (
    deals
      .filter((deal) => inReference(deal.expected_close ?? deal.updated_at, reference))
      .map((deal): CommissionSaleInput => ({
        id: deal.id,
        organization_id: user?.organization_id ?? '',
        seller_id: deal.owner_id,
        seller_name: sellerName.get(deal.owner_id) ?? 'Vendedor',
        customer_id: deal.account_id,
        customer_name: deal.crm_accounts?.name ?? 'Cliente sem nome',
        product_id: deal.product_id ?? deal.product_name ?? null,
        product_name: deal.product_name ?? deal.title,
        category_id: deal.category_id ?? deal.category_name ?? null,
        category_name: deal.category_name ?? 'Sem categoria',
        commercial_table_id: deal.commercial_table_id ?? deal.commercial_table_name ?? null,
        commercial_table_name: deal.commercial_table_name ?? 'Tabela padrão',
        sale_amount: toNumber(deal.value),
        received_amount: toNumber(deal.received_amount),
        sale_date: deal.expected_close ?? deal.updated_at ?? new Date().toISOString(),
        title: deal.title,
      }))
  ), [reference, user?.organization_id])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const sellersRes = await fetch('/api/team/sellers', { credentials: 'same-origin' })
      const sellersJson = sellersRes.ok ? await sellersRes.json() : { sellers: [] }
      const sellerRows = (sellersJson.sellers ?? []) as Seller[]
      const sellerName = new Map(sellerRows.map((seller) => [seller.id, seller.name]))
      setSellers(sellerRows)

      const [{ data: ruleRows }, { data: dealRows }, { data: entryRows }, { data: disputeRows }] = await Promise.all([
        supabase
          .from('commission_rules')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('active', true)
          .order('priority', { ascending: true }),
        supabase
          .from('crm_deals')
          .select('id, owner_id, title, value, received_amount, expected_close, updated_at, account_id, product_id, product_name, category_id, category_name, commercial_table_id, commercial_table_name, crm_accounts(name)')
          .eq('organization_id', user.organization_id)
          .eq('stage', 'closed_won'),
        supabase
          .from('commission_entries')
          .select('*')
          .eq('organization_id', user.organization_id)
          .eq('period_reference', reference)
          .order('competence_date', { ascending: false }),
        supabase
          .from('commission_disputes')
          .select('*')
          .eq('organization_id', user.organization_id)
          .order('created_at', { ascending: false }),
      ])

      const activeRules = (ruleRows ?? []) as CommissionRule[]
      setRules(activeRules)
      const preview = buildCommissionEntries(buildSales((dealRows ?? []) as DealRow[], sellerName), activeRules, getD1Date())
      setPreviewEntries(preview)

      const persisted = ((entryRows ?? []) as CommissionEntryDraft[]).map((entry) => ({
        ...entry,
        seller_name: sellerName.get(entry.seller_id) ?? entry.seller_name ?? 'Vendedor',
      }))
      setEntries(persisted.length > 0 ? persisted : preview)
      setDisputes((disputeRows ?? []) as CommissionDispute[])
    } catch {
      toast.error('Não foi possível carregar o comissionamento')
    } finally {
      setLoading(false)
    }
  }, [buildSales, reference, supabase, user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const visibleEntries = useMemo(() => entries.filter((entry) => {
    const matchesSeller = sellerFilter === 'all' || entry.seller_id === sellerFilter
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter
    const haystack = `${entry.seller_name} ${entry.customer_name} ${entry.product_name} ${entry.rule_name}`.toLowerCase()
    return matchesSeller && matchesStatus && haystack.includes(search.toLowerCase())
  }), [entries, search, sellerFilter, statusFilter])

  const summary = useMemo(() => {
    const confirmed = entries.filter((entry) => ['confirmed', 'adjusted', 'paid'].includes(entry.status)).reduce((sum, entry) => sum + entry.commission_amount, 0)
    const pending = entries.filter((entry) => entry.status === 'pending').reduce((sum, entry) => sum + entry.commission_amount, 0)
    const disputed = entries.filter((entry) => entry.status === 'disputed').reduce((sum, entry) => sum + entry.commission_amount, 0)
    const estimated = entries.reduce((sum, entry) => sum + entry.commission_amount, 0)
    const sales = new Set(entries.map((entry) => entry.sale_id)).size
    return { confirmed, pending, disputed, estimated, sales }
  }, [entries])

  const sellerSummaries = useMemo(() => summarizeCommissionEntries(entries), [entries])
  const openDisputes = useMemo(() => disputes.filter((dispute) => dispute.status === 'under_review'), [disputes])

  const persistPreview = async () => {
    if (!user) return
    setSyncing(true)
    try {
      const { start, end } = monthBounds(reference)
      const { data: period, error: periodError } = await supabase
        .from('commission_periods')
        .upsert({
          organization_id: user.organization_id,
          company_id: user.organization_id,
          reference,
          label: getPeriodLabel(reference),
          name: getPeriodLabel(reference),
          status: 'open',
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          last_d1_update_at: getD1Date().toISOString(),
          total_bonus: summary.confirmed,
          total_payroll: summary.confirmed,
        }, { onConflict: 'organization_id,reference' })
        .select('id')
        .single()

      if (periodError) throw periodError

      await supabase
        .from('commission_entries')
        .delete()
        .eq('organization_id', user.organization_id)
        .eq('period_reference', reference)
        .neq('status', 'disputed')

      const payload = previewEntries.map((entry) => ({
        ...entry,
        period_id: period.id,
        company_id: user.organization_id,
      }))

      if (payload.length) {
        const { error } = await supabase.from('commission_entries').upsert(payload, {
          onConflict: 'organization_id,period_reference,sale_id,status',
        })
        if (error) throw error
      }

      await supabase.from('commission_audit_logs').insert({
        organization_id: user.organization_id,
        company_id: user.organization_id,
        period_id: period.id,
        actor_id: user.id,
        created_by: user.id,
        entity_type: 'commission_period',
        entity_id: period.id,
        action: 'd1_recalculated',
        details: { reference, entries: payload.length },
      })

      toast.success('Parcial D-1 recalculada')
      fetchData()
    } catch {
      toast.error('Erro ao recalcular a parcial')
    } finally {
      setSyncing(false)
    }
  }

  const closePeriod = async () => {
    if (!user) return
    setClosing(true)
    try {
      await persistPreview()
      const { data: period, error } = await supabase
        .from('commission_periods')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          total_bonus: summary.confirmed,
          total_payroll: summary.confirmed,
          notes: 'Fechamento considera apenas comissões confirmadas, salvo ajustes manuais.',
        })
        .eq('organization_id', user.organization_id)
        .eq('reference', reference)
        .select('id')
        .single()

      if (error) throw error
      await supabase.from('commission_audit_logs').insert({
        organization_id: user.organization_id,
        company_id: user.organization_id,
        period_id: period.id,
        actor_id: user.id,
        created_by: user.id,
        entity_type: 'commission_period',
        entity_id: period.id,
        action: 'period_closed_confirmed_only',
        details: { reference, confirmed_total: summary.confirmed },
      })
      toast.success('Fechamento aberto com comissões confirmadas')
      fetchData()
    } catch {
      toast.error('Erro ao fechar período')
    } finally {
      setClosing(false)
    }
  }

  const resolveDispute = async (dispute: CommissionDispute, status: CommissionDisputeStatus) => {
    if (!user) return
    const entryStatus: CommissionEntryStatus = status === 'rejected' ? 'confirmed' : 'adjusted'
    try {
      const { error } = await supabase
        .from('commission_disputes')
        .update({
          status,
          manager_response: managerResponse[dispute.id] ?? null,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', dispute.id)

      if (error) throw error

      await supabase
        .from('commission_entries')
        .update({ status: entryStatus, status_reason: status === 'rejected' ? 'Contestacao recusada pelo gestor.' : 'Contestacao analisada e ajustada pelo gestor.' })
        .eq('id', dispute.commission_entry_id)

      await supabase.from('commission_audit_logs').insert({
        organization_id: user.organization_id,
        company_id: user.organization_id,
        actor_id: user.id,
        created_by: user.id,
        entity_type: 'commission_dispute',
        entity_id: dispute.id,
        action: `dispute_${status}`,
        details: { commission_entry_id: dispute.commission_entry_id },
      })

      toast.success('Contestacao atualizada')
      fetchData()
    } catch {
      toast.error('Erro ao analisar contestacao')
    }
  }

  const exportCsv = () => {
    const header = ['Data', 'Vendedor', 'Cliente', 'Produto/Tabela', 'Valor base', 'Percentual', 'Comissão', 'Status', 'Regra']
    const rows = visibleEntries.map((entry) => [
      formatDatePtBr(entry.competence_date),
      entry.seller_name ?? '',
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
    link.download = `extrato-comissoes-${reference}.csv`
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Gestao de Comissões</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatD1Message()} Valores podem mudar até o fechamento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Extrato
          </Button>
          <Button variant="outline" size="sm" onClick={persistPreview} disabled={syncing}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            {syncing ? 'Recalculando...' : 'Recalcular'}
          </Button>
          <Button size="sm" onClick={closePeriod} disabled={closing}>
            <CalendarCheck className="mr-1 h-3.5 w-3.5" />
            {closing ? 'Fechando...' : 'Abrir fechamento'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4 xl:grid-cols-7">
        <Summary icon={CheckCircle2} label="Comissão confirmada" value={formatCurrency(summary.confirmed)} tone="text-emerald-700 bg-emerald-500/10" />
        <Summary icon={Clock} label="Comissão pendente" value={formatCurrency(summary.pending)} tone="text-amber-700 bg-amber-500/10" />
        <Summary icon={AlertCircle} label="Contestada" value={formatCurrency(summary.disputed)} tone="text-red-700 bg-red-500/10" />
        <Summary icon={FileText} label="Total estimado" value={formatCurrency(summary.estimated)} tone="text-blue-700 bg-blue-500/10" />
        <Summary icon={Users} label="Vendedores" value={String(sellerSummaries.length)} tone="text-violet-700 bg-violet-500/10" />
        <Summary icon={ShieldCheck} label="Vendas" value={String(summary.sales)} tone="text-cyan-700 bg-cyan-500/10" />
        <Summary icon={RefreshCw} label="D-1" value={formatDatePtBr(getD1Date())} tone="text-primary bg-primary/10" />
      </div>

      {rules.length === 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-5 text-sm text-amber-800">
            Nenhuma regra ativa encontrada. Cadastre uma regra em Configuração de Comissionamento para gerar comissões automaticamente.
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {[
          ['resumo', 'Por vendedor'],
          ['extrato', 'Extrato detalhado'],
          ['contestacoes', `Contestacoes (${openDisputes.length})`],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as typeof tab)}
            className={`h-8 rounded-lg px-3 text-sm ${tab === value ? 'bg-primary text-primary-foreground' : 'border border-border/60 hover:bg-accent/40'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumo' && <SellerTable summaries={sellerSummaries} entries={entries} />}

      {tab === 'extrato' && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Extrato de Comissão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-8" placeholder="Buscar por vendedor, cliente, produto ou regra" />
              </div>
              <select value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="all">Todos vendedores</option>
                {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | CommissionEntryStatus)} className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm">
                <option value="all">Todos status</option>
                {(['confirmed', 'pending', 'disputed', 'adjusted', 'paid', 'cancelled'] as CommissionEntryStatus[]).map((status) => (
                  <option key={status} value={status}>{statusLabel(status)}</option>
                ))}
              </select>
            </div>
            <EntryTable entries={visibleEntries} />
          </CardContent>
        </Card>
      )}

      {tab === 'contestacoes' && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Analise de Contestacoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {disputes.length === 0 ? (
              <Empty text="Nenhuma contestacao aberta. As solicitacoes dos vendedores aparecerem aqui quando houver divergencias." />
            ) : (
              disputes.map((dispute) => {
                const entry = entries.find((item) => item.id === dispute.commission_entry_id)
                return (
                  <div key={dispute.id} className="rounded-lg border border-border/50 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{entry?.seller_name ?? 'Vendedor'}</p>
                          <Badge className={`border-0 text-[10px] ${disputeTone[dispute.status]}`}>{statusLabel(dispute.status)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{dispute.reason}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{dispute.description || 'Sem observação adicional.'}</p>
                        {entry && (
                          <p className="mt-2 text-xs">
                            {entry.customer_name} - {entry.product_name} - {formatCurrency(entry.commission_amount)} pela regra {entry.rule_name}
                          </p>
                        )}
                      </div>
                      {dispute.status === 'under_review' && (
                        <div className="w-full space-y-2 lg:w-[360px]">
                          <Textarea
                            value={managerResponse[dispute.id] ?? ''}
                            onChange={(event) => setManagerResponse((prev) => ({ ...prev, [dispute.id]: event.target.value }))}
                            placeholder="Resposta do gestor"
                          />
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => resolveDispute(dispute, 'rejected')}>Recusar</Button>
                            <Button size="sm" variant="outline" onClick={() => resolveDispute(dispute, 'corrected')}>Corrigir</Button>
                            <Button size="sm" onClick={() => resolveDispute(dispute, 'approved')}>Aprovar</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof CheckCircle2; label: string; value: string; tone: string }) {
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

function SellerTable({ summaries, entries }: { summaries: CommissionSellerSummary[]; entries: CommissionEntryDraft[] }) {
  if (summaries.length === 0) return <Empty text="Nenhuma comissão encontrada para este período. Assim que houver vendas ou recebimentos elegíveis, os valores aparecem aqui." />

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Tabela por vendedor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['Vendedor', 'Vendas', 'Confirmada', 'Pendente', 'Contestada', 'Total estimado', 'Status'].map((head) => (
                  <th key={head} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((item) => (
                <tr key={item.seller_id} className="border-b border-border/30 align-top last:border-0">
                  <td className="px-3 py-3">
                    <p className="font-medium">{item.seller_name}</p>
                    <details className="mt-2">
                      <summary className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        Ver extrato
                      </summary>
                      <div className="mt-2 max-w-[720px] space-y-1 rounded-md bg-muted/30 p-2">
                        {entries.filter((entry) => entry.seller_id === item.seller_id).slice(0, 8).map((entry) => (
                          <div key={`${entry.sale_id}-${entry.status}-${entry.id}`} className="flex justify-between gap-3 text-xs">
                            <span className="text-muted-foreground">{entry.customer_name} - {entry.rule_name} - {statusLabel(entry.status)}</span>
                            <span className="font-medium">{formatCurrency(entry.commission_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </td>
                  <td className="px-3 py-3 text-right">{item.sales_count}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(item.confirmed)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(item.pending)}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(item.disputed)}</td>
                  <td className="px-3 py-3 text-right font-bold">{formatCurrency(item.estimated)}</td>
                  <td className="px-3 py-3">
                    <Badge className={`border-0 text-[10px] ${item.status === 'with_dispute' ? 'bg-red-500/10 text-red-700' : 'bg-blue-500/10 text-blue-700'}`}>
                      {item.status === 'with_dispute' ? 'Com contestacao' : 'Em andamento'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function EntryTable({ entries }: { entries: CommissionEntryDraft[] }) {
  if (entries.length === 0) return <Empty text="Nenhuma comissão encontrada para os filtros selecionados." />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {['Data', 'Vendedor', 'Cliente', 'Produto/Tabela', 'Valor base', '%', 'Comissão', 'Status', 'Regra aplicada'].map((head) => (
              <th key={head} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.sale_id}-${entry.status}-${entry.id}`} className="border-b border-border/30 last:border-0">
              <td className="px-3 py-3">{formatDatePtBr(entry.competence_date)}</td>
              <td className="px-3 py-3 font-medium">{entry.seller_name}</td>
              <td className="px-3 py-3">{entry.customer_name}</td>
              <td className="px-3 py-3">
                <p>{entry.product_name ?? 'Venda'}</p>
                <p className="text-xs text-muted-foreground">{entry.commercial_table_name}</p>
              </td>
              <td className="px-3 py-3 text-right">{formatCurrency(entry.base_amount)}</td>
              <td className="px-3 py-3 text-right">{entry.commission_percentage}%</td>
              <td className="px-3 py-3 text-right font-semibold">{formatCurrency(entry.commission_amount)}</td>
              <td className="px-3 py-3">
                <Badge className={`border-0 text-[10px] ${statusTone[entry.status]}`}>{statusLabel(entry.status)}</Badge>
              </td>
              <td className="px-3 py-3">
                <p>{entry.rule_name}</p>
                <p className="text-xs text-muted-foreground">{entry.status_reason}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
  )
}
