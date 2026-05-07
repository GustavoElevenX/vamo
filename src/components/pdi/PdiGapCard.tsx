import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface PdiGap {
  id: string
  title: string
  description: string | null
  skill_area: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: string
  detected_from: string
  confidence_score: number
  impact_value?: number | null
  user?: { id: string; name: string } | null
}

export function PdiGapCard({
  gap,
  context = 'seller',
  onGenerateTraining,
  onDismiss,
}: {
  gap: PdiGap
  context?: 'seller' | 'manager'
  onGenerateTraining?: (gap: PdiGap) => void
  onDismiss?: (gap: PdiGap) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <p className="font-bold">{gap.title}</p>
              {gap.description && <p className="mt-1 text-sm text-muted-foreground">{gap.description}</p>}
            </div>
          </div>
          <Badge variant={gap.severity === 'critical' ? 'destructive' : 'outline'}>{gap.severity}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {gap.user?.name && <Badge variant="outline">{gap.user.name}</Badge>}
          <Badge className="bg-primary/10 text-primary">{gap.skill_area}</Badge>
          <Badge variant="outline">{gap.detected_from}</Badge>
          <Badge variant="outline">{Math.round(Number(gap.confidence_score || 0) * 100)}% conf.</Badge>
          {gap.impact_value ? <Badge variant="outline">{Number(gap.impact_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</Badge> : null}
        </div>
        {context === 'manager' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onGenerateTraining?.(gap)}>Gerar treinamento com IA</Button>
            <Button size="sm" variant="outline" onClick={() => onDismiss?.(gap)}>Dispensar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
