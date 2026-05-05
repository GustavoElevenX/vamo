'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface ContextualRecommendation {
  id: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: string
  suggested_action_label: string | null
  suggested_action_href: string | null
  recommendation_type: string
  source_module: string
}

interface Props {
  recommendation: ContextualRecommendation
  onAction?: (id: string, action: 'accept' | 'complete' | 'dismiss') => void
}

const priorityLabel = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
}

export function ContextualRecommendationCard({ recommendation, onAction }: Props) {
  const href = recommendation.suggested_action_href || '#'

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary">
                <Sparkles className="h-3 w-3" />
                {recommendation.source_module}
              </Badge>
              <Badge variant="outline">{priorityLabel[recommendation.priority]}</Badge>
            </div>
            <div>
              <p className="font-bold">{recommendation.title}</p>
              {recommendation.description && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{recommendation.description}</p>
              )}
            </div>
          </div>
          <Clock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="flex flex-wrap gap-2">
          {recommendation.suggested_action_href && (
            <Button size="sm" render={<Link href={href} />}>
              {recommendation.suggested_action_label || 'Agir agora'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {onAction && (
            <>
              <Button size="sm" variant="outline" onClick={() => onAction(recommendation.id, 'complete')}>
                <CheckCircle2 className="h-4 w-4" />
                Concluir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onAction(recommendation.id, 'dismiss')}>
                <X className="h-4 w-4" />
                Dispensar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
