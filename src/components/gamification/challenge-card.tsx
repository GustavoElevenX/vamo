'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, Users, User } from 'lucide-react'
import type { ChallengeType } from '@/types'

interface ChallengeCardProps {
  title: string
  description: string
  type: ChallengeType
  xpReward: number
  startDate: string
  endDate: string
  participantCount: number
  progress?: number
  isParticipant?: boolean
}

export function ChallengeCard({
  title, description, type, xpReward,
  startDate, endDate, participantCount,
  progress, isParticipant,
}: ChallengeCardProps) {
  const now = new Date()
  const end = new Date(endDate)
  const start = new Date(startDate)
  const isActive = now >= start && now <= end
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Ativo' : 'Encerrado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {type === 'team' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {type === 'team' ? 'Equipe' : 'Individual'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {isActive ? `${daysLeft}d restantes` : new Date(startDate).toLocaleDateString('pt-BR')}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-primary">+{xpReward} XP</span>
          <span className="text-muted-foreground">{participantCount} participantes</span>
        </div>
        {isParticipant && progress !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Seu progresso</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
