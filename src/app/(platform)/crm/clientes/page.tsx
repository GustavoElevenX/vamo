'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader, TitleHighlight } from '@/components/shared/page-header'
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Building2,
  CheckCircle2,
  Brain,
  LineChart,
  MessageSquareText,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
} from 'lucide-react'

type CustomerStatus =
  | 'all'
  | 'new_customer'
  | 'pending_receipt'
  | 'without_post_sale'
  | 'post_sale'
  | 'active'
  | 'expansion_open'
  | 'inactive'
  | 'at_risk'

type Customer = {
  id: string
  name: string
  segment: string | null
  cnpj: string | null
  website: string | null
  owner: { id: string; name: string } | null
  status: Exclude<CustomerStatus, 'all'>
  status_label: string
  won_revenue: number
  won_deals_count: number
  average_ticket: number
  last_won_at: string | null
  last_activity_at: string | null
  pending_receivable: number
  has_open_expansion: boolean
  open_pipeline_value: number
  next_action_title: string | null
  next_action_due_at: string | null
  priority_score: number
  suggested_action: string | null
  pipeline_href: string
}

type CustomerData = {
  summary: {
    total_customers: number
    new_customers_this_month: number
    won_revenue: number
    average_won_ticket: number
    average_revenue_per_customer: number
    pending_receivables: number
    customers_without_post_sale: number
    customers_with_open_expansion: number
    inactive_customers: number
    at_risk_customers: number
    top_5_concentration_pct: number
  }
  briefing: {
    title: string
    description: string
    recommended_action: string
    priority: 'low' | 'medium' | 'high' | 'critical'
  }
  customers: Customer[]
  by_seller: Array<{
    seller_id: string
    seller_name: string
    customers_count: number
    won_revenue: number
    average_ticket: number
    pending_receivables: number
    customers_without_post_sale: number
    customers_at_risk: number
  }>
  by_segment: Array<{
    segment: string
    customers_count: number
    won_revenue: number
    average_ticket: number
    pending_receivables: number
  }>
  critical_customers: Array<{
    id: string
    name: string
    reason: string
    impact_value: number
    suggested_action: string
    href: string
  }>
}

const filters: Array<{ value: CustomerStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'new_customer', label: 'Novos' },
  { value: 'without_post_sale', label: 'Sem pós-venda' },
  { value: 'pending_receipt', label: 'Recebimento pendente' },
  { value: 'expansion_open', label: 'Com expansao' },
  { value: 'inactive', label: 'Inativos' },
  { value: 'at_risk', label: 'Em risco' },
]

const statusClass: Record<Exclude<CustomerStatus, 'all'>, string> = {
  new_customer: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  pending_receipt: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  without_post_sale: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  post_sale: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  expansion_open: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  inactive: 'border-muted bg-muted/60 text-muted-foreground',
  at_risk: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function dateLabel(value: string | null) {
  if (!value) return 'sem registro'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function daysLabel(value: string | null) {
  if (!value) return 'sem contato'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000))
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'há 1 dia'
  return `ha ${diff} dias`
}

function encodePrompt(customer: Customer, context: string) {
  return `/chat-ia?prompt=${encodeURIComponent(`${context}: ${customer.name}. Status: ${customer.status_label}. Sugestao atual: ${customer.suggested_action ?? 'definir próxima ação comercial'}.`)}`
}

function SummaryCard({ title, value, detail, icon: Icon }: { title: string; value: string; detail?: string; icon: typeof Building2 }) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex min-h-[118px] flex-col justify-between gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <span className="rounded-lg border border-border/70 bg-muted/50 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </span>
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function CustomerCard({
  customer,
  isManager,
  onGeneratePdi,
}: {
  customer: Customer
  isManager: boolean
  onGeneratePdi: (customer: Customer) => void
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="truncate font-semibold">{customer.name}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{customer.segment || 'Segmento não informado'}</p>
          </div>
          <Badge variant="outline" className={statusClass[customer.status]}>
            {customer.status_label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Receita ganha</p>
            <p className="font-bold">{money(customer.won_revenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ticket medio</p>
            <p className="font-bold">{money(customer.average_ticket)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recebimento pendente</p>
            <p className="font-bold">{money(customer.pending_receivable)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Último contato</p>
            <p className="font-bold">{daysLabel(customer.last_activity_at ?? customer.last_won_at)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
          <p className="text-xs font-medium text-muted-foreground">Próxima ação</p>
          <p className="mt-1 text-sm">{customer.next_action_title || customer.suggested_action || 'Definir próxima ação da carteira.'}</p>
          {customer.next_action_due_at && <p className="mt-1 text-xs text-muted-foreground">{dateLabel(customer.next_action_due_at)}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" render={<Link href={customer.pipeline_href} />}>
            Ver funil
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" render={<Link href={encodePrompt(customer, isManager ? 'Gerar pauta de intervencao para o cliente' : 'Gerar mensagem comercial para o cliente')} />}>
            <MessageSquareText className="h-3.5 w-3.5" />
            Gerar mensagem
          </Button>
          {isManager && customer.owner && ['without_post_sale', 'pending_receipt', 'expansion_open', 'inactive', 'at_risk'].includes(customer.status) && (
            <Button size="sm" variant="outline" onClick={() => onGeneratePdi(customer)}>
              <Brain className="h-3.5 w-3.5" />
              Gerar PDI
            </Button>
          )}
          {isManager && customer.owner && (
            <Button size="sm" variant="outline" render={<Link href={`/equipe/${customer.owner.id}`} />}>
              <UserRound className="h-3.5 w-3.5" />
              Responsavel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function CrmClientesPage() {
  const { user } = useRequiredAuth()
  const [data, setData] = useState<CustomerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CustomerStatus>('all')

  const isManager = user.role === 'manager' || user.role === 'admin' || user.role === 'consultant'

  useEffect(() => {
    let cancelled = false
    fetch('/api/crm/customers', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao carregar clientes')
        return res.json() as Promise<CustomerData>
      })
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const customers = useMemo(() => data?.customers ?? [], [data])
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return customers.filter((customer) => {
      const matchesFilter = filter === 'all' || customer.status === filter
      const matchesQuery = !q
        || customer.name.toLowerCase().includes(q)
        || customer.segment?.toLowerCase().includes(q)
        || customer.owner?.name.toLowerCase().includes(q)
      return matchesFilter && matchesQuery
    })
  }, [customers, filter, query])

  const priorityCustomer = filtered[0] ?? customers[0] ?? null
  const summary = data?.summary

  const generateCustomerPdi = async (customer: Customer) => {
    if (!customer.owner?.id) return
    try {
      const skillArea = customer.status === 'without_post_sale'
        ? 'pos_venda'
        : customer.status === 'expansion_open'
          ? 'expansao'
          : customer.status === 'pending_receipt'
            ? 'organizacao_de_carteira'
            : 'relacionamento'
      const gapRes = await fetch('/api/pdi/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          userId: customer.owner.id,
          title: `Gap de carteira: ${customer.name}`,
          skillArea,
          description: customer.suggested_action ?? customer.status_label,
          detectedFrom: 'customer_portfolio',
          sourceEntityType: 'crm_account',
          sourceEntityId: customer.id,
          severity: customer.priority_score >= 70 ? 'high' : 'medium',
          confidenceScore: 0.82,
          impactValue: customer.pending_receivable || customer.open_pipeline_value || customer.won_revenue,
          evidence: {
            customerId: customer.id,
            customerName: customer.name,
            status: customer.status,
            pendingReceivable: customer.pending_receivable,
            openPipelineValue: customer.open_pipeline_value,
            lastActivityAt: customer.last_activity_at,
          },
        }),
      })
      const gapBody = await gapRes.json()
      if (!gapRes.ok) throw new Error(gapBody.error || 'Erro ao criar gap')
      const trainingRes = await fetch('/api/pdi/generate-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ gap_id: gapBody.gap.id, seller_id: customer.owner.id, create_mission: true }),
      })
      const trainingBody = await trainingRes.json()
      if (!trainingRes.ok) throw new Error(trainingBody.error || 'Erro ao gerar treinamento')
      toast.success('PDI de carteira gerado para revisao.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar PDI')
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
    <div className="space-y-5">
      <PageHeader
        label={isManager ? 'CRM' : 'Vender'}
        labelIcon={<Building2 className="h-3 w-3" />}
        title={isManager ? <>Base de <TitleHighlight>Clientes</TitleHighlight></> : <>Minha <TitleHighlight>Carteira</TitleHighlight></>}
        description={isManager
          ? 'Visão estrategica da carteira, receita ganha, pós-venda, recebimentos e expansao da equipe.'
          : 'Clientes ganhos, pós-venda, recebimentos e oportunidades de expansao.'}
      />

      {!data || !summary ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar a carteira de clientes.</p>
          </CardContent>
        </Card>
      ) : customers.length === 0 ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-8 text-center">
            <Building2 className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-medium">Ainda não existe cliente ganho.</p>
            <p className="mt-1 text-sm text-muted-foreground">Quando uma oportunidade for marcada como ganha e vinculada a uma conta, ela aparece aqui automaticamente.</p>
            <Button className="mt-4" render={<Link href="/crm" />}>
              Abrir funil
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title={isManager ? 'Clientes totais' : 'Clientes ganhos'} value={String(summary.total_customers)} detail={`${summary.new_customers_this_month} novos no mes`} icon={UsersRound} />
            <SummaryCard title="Receita ganha" value={money(summary.won_revenue)} detail={`Ticket medio: ${money(summary.average_won_ticket)}`} icon={BarChart3} />
            <SummaryCard title="Recebimento pendente" value={money(summary.pending_receivables)} detail="Base para comissão e fechamento" icon={BadgeDollarSign} />
            <SummaryCard title="Expansao aberta" value={String(summary.customers_with_open_expansion)} detail={`${summary.customers_without_post_sale} sem pos-venda`} icon={LineChart} />
          </section>

          <section className="rounded-xl border border-primary/25 bg-primary/5 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <Badge className="bg-primary text-primary-foreground">
                  <Sparkles className="h-3 w-3" />
                  {data.briefing.title}
                </Badge>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.briefing.description}</p>
                <p className="mt-2 text-sm font-semibold">{data.briefing.recommended_action}</p>
              </div>
              {isManager && (
                <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Concentracao top 5</p>
                  <p className="mt-1 text-2xl font-bold">{summary.top_5_concentration_pct}%</p>
                </div>
              )}
            </div>
          </section>

          {priorityCustomer && (
            <Card className="border-primary/30">
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_320px]">
                <div>
                  <Badge variant="outline" className={statusClass[priorityCustomer.status]}>
                    {isManager ? 'Cliente critico' : 'Cliente prioritario de hoje'}
                  </Badge>
                  <h2 className="mt-3 text-xl font-bold">{priorityCustomer.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {priorityCustomer.status_label} | {money(priorityCustomer.won_revenue)} em vendas ganhas | último contato {daysLabel(priorityCustomer.last_activity_at ?? priorityCustomer.last_won_at)}
                  </p>
                  <p className="mt-3 text-sm font-medium">{priorityCustomer.suggested_action}</p>
                </div>
                <div className="flex flex-col justify-between gap-3 rounded-lg border border-border/70 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Impacto financeiro</p>
                    <p className="text-lg font-bold">{money(priorityCustomer.pending_receivable || priorityCustomer.open_pipeline_value || priorityCustomer.won_revenue)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" render={<Link href={priorityCustomer.pipeline_href} />}>
                      Ver funil
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" render={<Link href={encodePrompt(priorityCustomer, 'Gerar próxima melhor ação para o cliente')} />}>
                      VAMO IA
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isManager && data.critical_customers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Clientes criticos
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                {data.critical_customers.slice(0, 4).map((customer) => (
                  <div key={customer.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 p-3">
                    <div>
                      <p className="text-sm font-semibold">{customer.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{customer.reason} | {money(customer.impact_value)}</p>
                      <p className="mt-1 text-xs font-medium">{customer.suggested_action}</p>
                    </div>
                    <Button size="icon-sm" variant="ghost" render={<Link href={customer.href} aria-label={`Abrir ${customer.name}`} />}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Buscar cliente, segmento ou responsavel" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map((item) => (
                <Button
                  key={item.value}
                  size="sm"
                  variant={filter === item.value ? 'default' : 'outline'}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <section className="grid gap-3 xl:grid-cols-2">
            {filtered.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} isManager={isManager} onGeneratePdi={generateCustomerPdi} />
            ))}
          </section>

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado com os filtros atuais.
              </CardContent>
            </Card>
          )}

          {isManager && (
            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserRound className="h-4 w-4 text-primary" />
                    Distribuicao por vendedor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.by_seller.slice(0, 6).map((seller) => (
                    <div key={seller.seller_id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                      <div>
                        <p className="text-sm font-semibold">{seller.seller_name}</p>
                        <p className="text-xs text-muted-foreground">{seller.customers_count} clientes | {seller.customers_without_post_sale} sem pós-venda</p>
                      </div>
                      <p className="text-sm font-bold">{money(seller.won_revenue)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" />
                    Distribuicao por segmento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.by_segment.slice(0, 6).map((segment) => (
                    <div key={segment.segment} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                      <div>
                        <p className="text-sm font-semibold">{segment.segment}</p>
                        <p className="text-xs text-muted-foreground">{segment.customers_count} clientes | pendente {money(segment.pending_receivables)}</p>
                      </div>
                      <p className="text-sm font-bold">{money(segment.won_revenue)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}

          <Card>
            <CardContent className="flex items-start gap-3 py-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Cliente aqui não e cadastro manual separado: é conta com pelo menos uma venda ganha. Funil continua sendo ação comercial; esta tela mostra relacionamento, recebimento, pós-venda e expansao.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
