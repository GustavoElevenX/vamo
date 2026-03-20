'use client'

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'

interface BehavioralChartProps {
  scores: {
    D: number
    I: number
    S: number
    C: number
  }
}

const TRAIT_LABELS: Record<string, string> = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
}

const TRAIT_COLORS: Record<string, string> = {
  D: '#ef4444',
  I: '#f59e0b',
  S: '#22c55e',
  C: '#3b82f6',
}

export function BehavioralChart({ scores }: BehavioralChartProps) {
  const data = Object.entries(scores).map(([trait, value]) => ({
    trait: TRAIT_LABELS[trait],
    value,
    fullMark: 100,
  }))

  const dominant = (Object.entries(scores) as [string, number][]).reduce((a, b) =>
    a[1] > b[1] ? a : b
  )[0]

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={250}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="trait"
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Perfil"
            dataKey="value"
            stroke={TRAIT_COLORS[dominant]}
            fill={TRAIT_COLORS[dominant]}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {Object.entries(scores).map(([trait, value]) => (
          <div key={trait} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: TRAIT_COLORS[trait] }}
            />
            <span className="text-xs text-muted-foreground">
              {TRAIT_LABELS[trait]}: {value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
