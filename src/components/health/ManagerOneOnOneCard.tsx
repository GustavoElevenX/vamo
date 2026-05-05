import { MessagesSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function ManagerOneOnOneCard({ agenda }: { agenda: string[] }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-2 font-bold">
          <MessagesSquare className="h-5 w-5 text-primary" />
          Pauta de 1:1
        </div>
        <div className="space-y-2">
          {agenda.map((item) => (
            <p key={item} className="rounded-lg border border-border/60 p-2 text-sm text-muted-foreground">{item}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
