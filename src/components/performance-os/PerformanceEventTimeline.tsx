'use client'

import { Activity, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export interface PerformanceEventTimelineItem {
  id: string
  event_type: string
  source_module: string
  title: string
  description: string | null
  occurred_at: string
  impact_score: number
  risk_score: number
}

export function PerformanceEventTimeline({ events }: { events: PerformanceEventTimelineItem[] }) {
  if (!events.length) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Nenhum evento operacional registrado ainda.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <Card key={event.id}>
          <CardContent className="flex gap-3 pt-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{event.source_module}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge className="bg-primary/10 text-primary">{event.event_type}</Badge>
              </div>
              <p className="mt-2 font-semibold">{event.title}</p>
              {event.description && <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                Impacto {Number(event.impact_score || 0)} | Risco {Number(event.risk_score || 0)} | {new Date(event.occurred_at).toLocaleString('pt-BR')}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
