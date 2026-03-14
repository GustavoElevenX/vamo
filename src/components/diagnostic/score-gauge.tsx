'use client'

import { DIAGNOSTIC_QUADRANTS } from '@/lib/constants'
import type { DiagnosticQuadrant } from '@/types'

interface ScoreGaugeProps {
  healthPct: number
  quadrant: DiagnosticQuadrant
  size?: number
}

export function ScoreGauge({ healthPct, quadrant, size = 120 }: ScoreGaugeProps) {
  const q = DIAGNOSTIC_QUADRANTS[quadrant]
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = `${(healthPct / 100) * circumference} ${circumference}`

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={q.color}
          strokeWidth="10"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold">{healthPct}%</span>
        <span className="text-xs font-medium" style={{ color: q.color }}>{q.label}</span>
      </div>
    </div>
  )
}
