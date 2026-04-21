'use client'

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
      <TooltipTrigger
        render={<div />}
        className="flex flex-col gap-1 cursor-default w-full"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${xpInLevel} de ${xpNeeded} pontos para o próximo nível`}
      >
        <div className="xp-track h-1.5 w-full">
          <div className="xp-fill h-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {currentXp.toLocaleString()} pontos
          </span>
          <span className="text-[10px] text-muted-foreground/50">{Math.round(progress)}%</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">
          {xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} pontos para Nível {level + 1}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
