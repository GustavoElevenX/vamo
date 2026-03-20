'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type LucideIcon } from 'lucide-react'

interface AIAnalysisCardProps {
  title: string
  items: string[]
  icon: LucideIcon
  variant: 'warning' | 'success' | 'info' | 'danger'
}

const variantStyles = {
  warning: 'border-amber-200 dark:border-amber-800',
  success: 'border-green-200 dark:border-green-800',
  info: 'border-blue-200 dark:border-blue-800',
  danger: 'border-red-200 dark:border-red-800',
}

const iconStyles = {
  warning: 'text-amber-500',
  success: 'text-green-500',
  info: 'text-blue-500',
  danger: 'text-red-500',
}

export function AIAnalysisCard({ title, items, icon: Icon, variant }: AIAnalysisCardProps) {
  if (items.length === 0) return null

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className={`h-4 w-4 ${iconStyles[variant]}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

interface PriorityAction {
  action: string
  area: string
  impact: 'alto' | 'medio' | 'baixo'
}

interface AIActionsCardProps {
  actions: PriorityAction[]
}

const impactColors = {
  alto: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  medio: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  baixo: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
}

export function AIActionsCard({ actions }: AIActionsCardProps) {
  if (actions.length === 0) return null

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Ações Prioritárias</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{action.action}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{action.area}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${impactColors[action.impact]}`}>
                    {action.impact}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
