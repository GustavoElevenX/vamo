'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  children?: React.ReactNode
}

export function EmptyState({ icon: Icon, message, children }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{message}</p>
        {children && <div className="mt-4">{children}</div>}
      </CardContent>
    </Card>
  )
}
