'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Swords, Calendar, Users, User } from 'lucide-react'
import type { Challenge, ChallengeParticipant } from '@/types'

export default function DesafiosPage() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState<(Challenge & { participants?: ChallengeParticipant[] })[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('challenges')
        .select('*, challenge_participants(*)')
        .eq('organization_id', user.organization_id)
        .eq('active', true)
        .order('end_date', { ascending: true })

      setChallenges(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [user])

  if (!user) return null

  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Desafios</h2>
          <p className="text-muted-foreground">Sprints e competições da equipe</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : challenges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Swords className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum desafio ativo no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {challenges.map((challenge) => {
            const endDate = new Date(challenge.end_date)
            const startDate = new Date(challenge.start_date)
            const isActive = now >= startDate && now <= endDate
            const isUpcoming = now < startDate
            const myParticipation = challenge.participants?.find((p) => p.user_id === user.id)
            const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000))

            return (
              <Card key={challenge.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{challenge.title}</CardTitle>
                    <Badge variant={isActive ? 'default' : isUpcoming ? 'secondary' : 'outline'}>
                      {isActive ? 'Ativo' : isUpcoming ? 'Em Breve' : 'Encerrado'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{challenge.description}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {challenge.type === 'team' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {challenge.type === 'team' ? 'Equipe' : 'Individual'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {isActive ? `${daysLeft}d restantes` : new Date(challenge.start_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-primary">+{challenge.xp_reward} XP</span>
                    {challenge.participants && (
                      <span className="text-muted-foreground">
                        {challenge.participants.length} participante(s)
                      </span>
                    )}
                  </div>

                  {myParticipation && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Seu progresso</span>
                        <span>{myParticipation.progress}%</span>
                      </div>
                      <Progress value={myParticipation.progress} className="h-2" />
                    </div>
                  )}

                  <Button variant="outline" size="sm" className="w-full" render={<Link href={`/desafios/${challenge.id}`} />}>
                    {myParticipation ? 'Ver Detalhes' : 'Participar'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
