'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award } from 'lucide-react'

interface LeaderboardRow {
  user_id: string
  name: string
  total_xp: number
  current_level: number
  isCurrentUser?: boolean
}

interface LeaderboardTableProps {
  rows: LeaderboardRow[]
  currentUserId?: string
}

export function LeaderboardTable({ rows, currentUserId }: LeaderboardTableProps) {
  const podiumIcons = [
    <Trophy key="1" className="h-5 w-5 text-yellow-500" />,
    <Medal key="2" className="h-5 w-5 text-gray-400" />,
    <Award key="3" className="h-5 w-5 text-amber-600" />,
  ]

  return (
    <div className="divide-y">
      {rows.map((row, i) => {
        const isMe = row.user_id === currentUserId
        const initials = row.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

        return (
          <div
            key={row.user_id}
            className={`flex items-center gap-4 px-4 py-3 ${isMe ? 'bg-primary/5' : ''}`}
          >
            <div className="flex h-8 w-8 items-center justify-center">
              {i < 3 ? podiumIcons[i] : (
                <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
              )}
            </div>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {row.name}
                {isMe && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
              </p>
              <p className="text-xs text-muted-foreground">Nível {row.current_level}</p>
            </div>
            <Badge variant="secondary" className="font-mono">
              {row.total_xp.toLocaleString()} XP
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
