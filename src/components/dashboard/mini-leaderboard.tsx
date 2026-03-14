'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LeaderboardItem {
  name: string
  xp: number
  rank: number
}

interface MiniLeaderboardProps {
  items: LeaderboardItem[]
}

export function MiniLeaderboard({ items }: MiniLeaderboardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 5 da Semana</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de ranking.</p>
        ) : (
          items.slice(0, 5).map((item) => {
            const initials = item.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
            return (
              <div key={item.rank} className="flex items-center gap-3">
                <span className="w-5 text-center text-sm font-bold text-muted-foreground">
                  {item.rank}
                </span>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">{item.name}</span>
                <span className="text-sm font-medium text-primary">{item.xp} XP</span>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
