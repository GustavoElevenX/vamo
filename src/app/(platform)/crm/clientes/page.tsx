'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Building2, Search } from 'lucide-react'

type Account = {
  id: string
  name: string
  segment: string | null
  website: string | null
  deals?: Array<{ id: string; value: number; stage: string }>
}

export default function CrmClientesPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/crm/accounts')
      .then((res) => res.json())
      .then((body) => setAccounts(body.accounts ?? []))
      .catch(() => setAccounts([]))
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return accounts.filter((account) => account.name.toLowerCase().includes(q) || account.segment?.toLowerCase().includes(q))
  }, [accounts, query])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">Contas com pipeline ativo e contexto comercial.</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Buscar cliente" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((account) => {
          const activeDeals = account.deals?.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage)) ?? []
          const total = activeDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0)
          return (
            <Card key={account.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{account.name}</h2>
                    <p className="text-sm text-muted-foreground">{account.segment || 'Segmento nao informado'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{activeDeals.length} deals</Badge>
                  <span className="text-sm font-semibold">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <Link href={`/crm?account=${account.id}`} className="text-sm font-medium text-primary hover:underline">
                  Ver pipeline
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
