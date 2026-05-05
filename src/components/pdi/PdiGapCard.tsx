import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
}

export function PdiGapCard({ gap }: { gap: PdiGap }) {
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
          <Badge className="bg-primary/10 text-primary">{gap.skill_area}</Badge>
          <Badge variant="outline">{gap.detected_from}</Badge>
          <Badge variant="outline">{Math.round(Number(gap.confidence_score || 0) * 100)}% conf.</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
