import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export function PdiApplicationCard({
  title,
  description,
  status,
  accountName,
}: {
  title: string
  description: string
  status: string
  accountName?: string | null
}) {
  return (
    <Card>
      <CardContent className="flex gap-3 pt-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{title}</p>
            <Badge variant="outline">{status}</Badge>
          </div>
          {accountName && <p className="mt-1 text-xs font-medium text-primary">Cliente: {accountName}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
