import { DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function CommissionTraceCard({
  expected,
  released,
  pending,
  blocked,
  reason,
}: {
  expected: number
  released: number
  pending: number
  blocked: number
  reason: string
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-2 font-bold">
          <DollarSign className="h-5 w-5 text-primary" />
          Comissão rastreavel
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Metric label="Prevista" value={money(expected)} />
          <Metric label="Liberada" value={money(released)} />
          <Metric label="Pendente" value={money(pending)} />
          <Metric label="Bloqueada" value={money(blocked)} />
        </div>
        <p className="text-sm text-muted-foreground">{reason}</p>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  )
}
