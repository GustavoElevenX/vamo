import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function SellerGainImpactCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-bold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button variant="outline" render={<Link href={href} />}>Ver ganho</Button>
      </CardContent>
    </Card>
  )
}
