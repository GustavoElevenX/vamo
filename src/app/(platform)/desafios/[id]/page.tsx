'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Calendar, Trophy } from 'lucide-react'
import type { Challenge, ChallengeParticipant } from '@/types'

export default function DesafioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [participants, setParticipants] = useState<(ChallengeParticipant & { users?: { name: string; avatar_url: string | null } })[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!user || !id) return
    const fetch = async () => {
      const { data: c } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single()
      setChallenge(c)

      const { data: p } = await supabase
        .from('challenge_participants')
        .select('*, users(name, avatar_url)')
        .eq('challenge_id', id)
        .order('progress', { ascending: false })
      setParticipants(p ?? [])
      setLoading(false)
    }
    fetch()
  }, [user, id])

  if (!user) return null

  const handleJoin = async () => {
    if (!challenge || joining) return
    setJoining(true)
    await supabase.from('challenge_participants').insert({
      challenge_id: challenge.id,
      user_id: user.id,
      progress: 0,
      completed: false,
    })
    const { data: p } = await supabase
      .from('challenge_participants')
      .select('*, users(name, avatar_url)')
      .eq('challenge_id', id)
      .order('progress', { ascending: false })
    setParticipants(p ?? [])
    setJoining(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Desafio não encontrado</h2>
        <Button variant="outline" onClick={() => router.push('/desafios')}>Voltar</Button>
      </div>
    )
  }

  const isParticipant = participants.some((p) => p.user_id === user.id)
  const now = new Date()
  const isActive = now >= new Date(challenge.start_date) && now <= new Date(challenge.end_date)
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - now.getTime()) / 86400000))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/desafios')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{challenge.title}</h2>
          <p className="text-muted-foreground">{challenge.description}</p>
        </div>
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? `${daysLeft}d restantes` : 'Encerrado'}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Trophy className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">+{challenge.xp_reward}</p>
              <p className="text-xs text-muted-foreground">XP de recompensa</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Calendar className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {new Date(challenge.start_date).toLocaleDateString('pt-BR')} - {new Date(challenge.end_date).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground">Período</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div>
              <p className="text-2xl font-bold">{participants.length}</p>
              <p className="text-xs text-muted-foreground">Participantes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!isParticipant && isActive && (
        <Button onClick={handleJoin} disabled={joining} className="w-full">
          {joining ? 'Entrando...' : 'Participar do Desafio'}
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Participantes</CardTitle>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum participante ainda.</p>
          ) : (
            <div className="space-y-3">
              {participants.map((p, i) => {
                const name = p.users?.name ?? 'Usuário'
                const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{name}</p>
                      <Progress value={p.progress} className="mt-1 h-1.5" />
                    </div>
                    <span className="text-sm font-medium">{p.progress}%</span>
                    {p.completed && <Badge variant="default" className="text-xs">Concluído</Badge>}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
