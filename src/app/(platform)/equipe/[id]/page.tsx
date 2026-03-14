'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, TrendingUp, Trophy, Flame } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import type { User, UserXp } from '@/types'

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [member, setMember] = useState<User | null>(null)
  const [xp, setXp] = useState<UserXp | null>(null)
  const [badgeCount, setBadgeCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    const fetch = async () => {
      const [{ data: m }, { data: x }, { count }] = await Promise.all([
        supabase.from('users').select('*').eq('id', id).maybeSingle(),
        supabase.from('user_xp').select('*').eq('user_id', id).maybeSingle(),
        supabase.from('user_badges').select('*', { count: 'exact', head: true }).eq('user_id', id),
      ])
      setMember(m)
      setXp(x)
      setBadgeCount(count ?? 0)
      setLoading(false)
    }
    fetch()
  }, [user, id])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Membro não encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/equipe')}>Voltar</Button>
      </div>
    )
  }

  const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/equipe')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">{member.name}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
            <span className="text-sm text-muted-foreground">{member.email}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{xp?.total_xp?.toLocaleString() ?? 0}</p>
              <p className="text-xs text-muted-foreground">XP Total (Nível {xp?.current_level ?? 1})</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{badgeCount}</p>
              <p className="text-xs text-muted-foreground">Badges Conquistados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Flame className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{xp?.current_streak ?? 0}</p>
              <p className="text-xs text-muted-foreground">Dias de Streak</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
