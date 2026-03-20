'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, CheckCircle, SkipForward, Star, ExternalLink, Loader2 } from 'lucide-react'
import { DIAGNOSTIC_AREAS } from '@/lib/constants'
import type { AIMission, DiagnosticArea } from '@/types'

interface MissionCardProps {
  mission: AIMission
  onAction: (missionId: string, action: 'start' | 'complete' | 'skip') => Promise<void>
  loading?: boolean
}

const difficultyLabels = ['', 'Fácil', 'Médio', 'Difícil']
const difficultyColors = [
  '',
  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
]

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  completed: { label: 'Concluída', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  skipped: { label: 'Pulada', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
}

export function MissionCard({ mission, onAction, loading }: MissionCardProps) {
  const areaLabel = DIAGNOSTIC_AREAS[mission.area as DiagnosticArea] ?? mission.area
  const status = statusConfig[mission.status]
  const isCompleted = mission.status === 'completed'
  const isSkipped = mission.status === 'skipped'

  return (
    <Card className={isCompleted ? 'opacity-75' : isSkipped ? 'opacity-50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium">{mission.title}</CardTitle>
          <Badge variant="secondary" className={status.color}>
            {status.label}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <Badge variant="outline" className="text-xs">{areaLabel}</Badge>
          <Badge variant="secondary" className={`text-xs ${difficultyColors[mission.difficulty]}`}>
            {Array.from({ length: mission.difficulty }).map((_, i) => (
              <Star key={i} className="h-2.5 w-2.5 fill-current" />
            ))}
            <span className="ml-1">{difficultyLabels[mission.difficulty]}</span>
          </Badge>
          <Badge variant="secondary" className="text-xs font-mono">
            +{mission.xp_reward} XP
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{mission.description}</p>

        {mission.resources && mission.resources.length > 0 && (
          <div className="mb-3 space-y-1">
            {mission.resources.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-1 text-xs text-primary">
                <ExternalLink className="h-3 w-3" />
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {r.title}
                  </a>
                ) : (
                  <span>{r.title}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!isCompleted && !isSkipped && (
          <div className="flex gap-2">
            {mission.status === 'pending' && (
              <Button size="sm" variant="outline" onClick={() => onAction(mission.id, 'start')} disabled={loading}>
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                Iniciar
              </Button>
            )}
            {mission.status === 'in_progress' && (
              <Button size="sm" onClick={() => onAction(mission.id, 'complete')} disabled={loading}>
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                Completar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onAction(mission.id, 'skip')} disabled={loading}>
              <SkipForward className="mr-1 h-3 w-3" />
              Pular
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
