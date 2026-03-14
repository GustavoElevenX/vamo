'use client'

import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface XpBarProps {
  currentXp: number
  currentLevelXp: number
  nextLevelXp: number
  level: number
}

export function XpBar({ currentXp, currentLevelXp, nextLevelXp, level }: XpBarProps) {
  const xpInLevel = currentXp - currentLevelXp
  const xpNeeded = nextLevelXp - currentLevelXp
  const progress = xpNeeded > 0 ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 100

  return (
    <Tooltip>
      <TooltipTrigger className="flex items-center gap-2" render={<div />}>
          <span className="text-xs font-bold text-primary">Lv.{level}</span>
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">{currentXp} XP</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{xpInLevel}/{xpNeeded} XP para o próximo nível</p>
      </TooltipContent>
    </Tooltip>
  )
}
