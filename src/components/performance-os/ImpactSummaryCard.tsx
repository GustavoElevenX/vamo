import { ArrowRightLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export function ImpactSummaryCard({
  title,
  description,
  modules,
}: {
  title: string
  description: string
  modules: string[]
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {modules.map((module) => <Badge key={module} variant="outline">{module}</Badge>)}
        </div>
      </CardContent>
    </Card>
  )
}
