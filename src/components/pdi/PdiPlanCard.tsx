import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface PdiPlan {
  id: string
  title: string
  description: string | null
  status: string
  user_id?: string | null
  target_kpi_key: string | null
  baseline_value: number | null
  target_value: number | null
  current_value: number | null
  due_date: string | null
  metadata?: Record<string, unknown> | null
  items?: Array<{ id: string; title: string; description: string | null; item_type: string; status: string; metadata?: Record<string, unknown> | null }>
}

export function PdiPlanCard({
  plan,
  context = 'seller',
  sellerId,
}: {
  plan: PdiPlan
  context?: 'seller' | 'manager'
  sellerId?: string | null
}) {
  const href = context === 'manager'
    ? (sellerId || plan.user_id) ? `/equipe/${sellerId ?? plan.user_id}?tab=pdi` : '/monitoramento/desenvolvimento'
    : '/desenvolvimento/pdi'
  const label = context === 'manager' ? 'Acompanhar PDI' : 'Aplicar em caso real'
  const training = plan.metadata?.trainingPayload as { quick_concept?: string } | undefined

  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <ClipboardCheck className="mt-0.5 h-5 w-5 text-blue-500" />
            <div>
              <p className="font-bold">{plan.title}</p>
              {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
            </div>
          </div>
          <Badge>{plan.status}</Badge>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <span className="rounded-lg border border-border/60 p-2">KPI: {plan.target_kpi_key || 'a definir'}</span>
          <span className="rounded-lg border border-border/60 p-2">Atual: {plan.current_value ?? '-'}</span>
          <span className="rounded-lg border border-border/60 p-2">Meta: {plan.target_value ?? '-'}</span>
        </div>
        {training?.quick_concept && (
          <div className="rounded-lg border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
            {training.quick_concept}
          </div>
        )}
        <Button variant="outline" size="sm" render={<Link href={href} />}>{label}</Button>
      </CardContent>
    </Card>
  )
}
