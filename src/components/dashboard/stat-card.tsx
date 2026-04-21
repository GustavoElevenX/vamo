'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type StatColor = 'green' | 'amber' | 'blue' | 'violet' | 'rose' | 'orange'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color?: StatColor
  trend?: { value: number; label?: string }
  className?: string
}

export function StatCard({ title, value, subtitle, icon: Icon, color = 'green', trend, className }: StatCardProps) {
  return (
    <Card className={cn('border-border/50 card-interactive animate-fade-in-up', className)}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5 truncate">
              {title}
            </p>
            <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className={cn(
                  'text-[11px] font-semibold',
                  trend.value >= 0 ? 'text-emerald-500' : 'text-destructive'
                )}>
                  {trend.value >= 0 ? '+' : ''}{trend.value}%
                </span>
                {trend.label && (
                  <span className="text-[10px] text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
            {subtitle && !trend && (
              <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn('stat-icon h-9 w-9 shrink-0', `stat-icon-${color}`)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
