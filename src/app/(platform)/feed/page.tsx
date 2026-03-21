'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Trophy,
  Medal,
  Sparkles,
  Gift,
  Star,
  ShoppingBag,
  ArrowRight,
  Zap,
  Crown,
  Target,
  Heart,
  Flame,
  Megaphone,
} from 'lucide-react'
import type { RewardCatalog, Badge as BadgeType } from '@/types'

type FilterTab = 'todos' | 'conquistas' | 'reconhecimentos' | 'celebracoes'

interface FeedEvent {
  id: string
  type: 'badge' | 'mission' | 'level_up' | 'challenge' | 'streak' | 'recognition' | 'celebration'
  user_name: string
  user_initials: string
  description: string
  timestamp: string
  xp: number
  liked?: boolean
}

const STATIC_POSTS: FeedEvent[] = [
  // Auto-post da plataforma
  {
    id: 'static-auto-1',
    type: 'celebration',
    user_name: 'VAMO',
    user_initials: 'VA',
    description: 'A equipe esta em 82% da meta mensal. Faltam R$ 12.000 para bater o objetivo!',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    xp: 0,
  },
  {
    id: 'static-1',
    type: 'badge',
    user_name: 'Maria Silva',
    user_initials: 'MS',
    description: 'conquistou o badge Closer Elite!',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    xp: 500,
  },
  // Reconhecimento do gestor
  {
    id: 'static-rec-1',
    type: 'recognition',
    user_name: 'Gestor',
    user_initials: 'GS',
    description: 'reconheceu Ana Costa: "Parabens pelo excelente trabalho com o cliente XYZ. Sua abordagem consultiva fez a diferenca no fechamento!"',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    xp: 300,
  },
  {
    id: 'static-2',
    type: 'mission',
    user_name: 'Joao Santos',
    user_initials: 'JS',
    description: 'completou 10 missoes consecutivas!',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    xp: 300,
  },
  // Missao coletiva com contribuicoes
  {
    id: 'static-coletiva-1',
    type: 'celebration',
    user_name: 'Equipe Comercial',
    user_initials: 'EC',
    description: 'completou a Missao Coletiva "50 Reunioes no Mes"! Contribuicoes: Maria (12), Joao (10), Ana (9), Carlos (8), Fernanda (6), Pedro (5).',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    xp: 500,
  },
  {
    id: 'static-3',
    type: 'celebration',
    user_name: 'Equipe Comercial',
    user_initials: 'EC',
    description: 'atingiu 100% da meta mensal!',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    xp: 0,
  },
  {
    id: 'static-4',
    type: 'streak',
    user_name: 'Ana Costa',
    user_initials: 'AC',
    description: 'esta com streak de 15 dias! Recorde pessoal!',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    xp: 150,
  },
  // Reconhecimento do gestor
  {
    id: 'static-rec-2',
    type: 'recognition',
    user_name: 'Gestor',
    user_initials: 'GS',
    description: 'reconheceu Carlos Mendes: "Destaque da semana pelo maior ticket medio da equipe. Excelente trabalho em vendas consultivas!"',
    timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    xp: 200,
  },
  {
    id: 'static-5',
    type: 'recognition',
    user_name: 'Carlos Mendes',
    user_initials: 'CM',
    description: 'foi reconhecido pelo gestor por excelencia no atendimento!',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    xp: 200,
  },
  {
    id: 'static-6',
    type: 'badge',
    user_name: 'Fernanda Lima',
    user_initials: 'FL',
    description: 'conquistou o badge CRM Master!',
    timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    xp: 400,
  },
  // Auto-post da plataforma
  {
    id: 'static-auto-2',
    type: 'celebration',
    user_name: 'VAMO',
    user_initials: 'VA',
    description: 'Engajamento da equipe esta em 85% esta semana! +12% comparado ao mes passado.',
    timestamp: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(),
    xp: 0,
  },
  {
    id: 'static-7',
    type: 'celebration',
    user_name: 'Pedro Alves',
    user_initials: 'PA',
    description: 'fechou o maior negocio do trimestre — R$ 85.000!',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    xp: 1000,
  },
  // Reconhecimento do gestor
  {
    id: 'static-rec-3',
    type: 'recognition',
    user_name: 'Gestor',
    user_initials: 'GS',
    description: 'reconheceu Pedro Alves: "Negocio do trimestre! Exemplo de persistencia e tecnica de negociacao. Time inteiro pode aprender com essa jornada."',
    timestamp: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    xp: 500,
  },
  {
    id: 'static-8',
    type: 'level_up',
    user_name: 'Lucia Oliveira',
    user_initials: 'LO',
    description: 'subiu para o nivel 5 — Closer!',
    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    xp: 0,
  },
]

export default function FeedRecompensasPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('todos')
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const [
        { data: recentBadges },
        { data: recentMissions },
      ] = await Promise.all([
        supabase
          .from('user_badges')
          .select('*, badges!inner(name), users!inner(name)')
          .eq('badges.organization_id', user.organization_id)
          .order('earned_at', { ascending: false })
          .limit(10),
        supabase
          .from('ai_missions')
          .select('*, users!inner(name)')
          .eq('organization_id', user.organization_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(10),
      ])

      const feedEvents: FeedEvent[] = []

      if (recentBadges) {
        for (const b of recentBadges as any[]) {
          const name = b.users?.name ?? 'Usuario'
          feedEvents.push({
            id: `badge-${b.id}`,
            type: 'badge',
            user_name: name,
            user_initials: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
            description: `conquistou o badge "${b.badges?.name}"`,
            timestamp: b.earned_at,
            xp: 0,
          })
        }
      }

      if (recentMissions) {
        for (const m of recentMissions as any[]) {
          const name = m.users?.name ?? 'Usuario'
          feedEvents.push({
            id: `mission-${m.id}`,
            type: 'mission',
            user_name: name,
            user_initials: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
            description: `completou a missao "${m.title}"`,
            timestamp: m.completed_at,
            xp: m.xp_reward,
          })
        }
      }

      // Merge DB events with static posts, sort by timestamp
      const allEvents = [...feedEvents, ...STATIC_POSTS]
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setFeed(allEvents.slice(0, 20))
      setLoading(false)
    }

    fetchData()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      </div>
    )
  }

  const eventIcon = (type: string) => {
    switch (type) {
      case 'badge': return <Medal className="h-4 w-4 text-violet-500" />
      case 'mission': return <Sparkles className="h-4 w-4 text-amber-500" />
      case 'level_up': return <Crown className="h-4 w-4 text-emerald-500" />
      case 'challenge': return <Trophy className="h-4 w-4 text-blue-500" />
      case 'streak': return <Flame className="h-4 w-4 text-orange-500" />
      case 'recognition': return <Star className="h-4 w-4 text-amber-500" />
      case 'celebration': return <Target className="h-4 w-4 text-emerald-500" />
      default: return <Star className="h-4 w-4 text-muted-foreground" />
    }
  }

  const timeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}min atras`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atras`
    const days = Math.floor(hours / 24)
    return `${days}d atras`
  }

  const toggleLike = (id: string) => {
    setLikedPosts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const filterMap: Record<FilterTab, string[]> = {
    todos: [],
    conquistas: ['badge', 'level_up'],
    reconhecimentos: ['recognition', 'mission'],
    celebracoes: ['celebration', 'streak', 'challenge'],
  }

  const filteredFeed = activeTab === 'todos'
    ? feed
    : feed.filter((e) => filterMap[activeTab].includes(e.type))

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'conquistas', label: 'Conquistas' },
    { key: 'reconhecimentos', label: 'Reconhecimentos' },
    { key: 'celebracoes', label: 'Celebracoes' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Feed & Reconhecimento</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Celebre as conquistas da equipe
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit flex-wrap">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {filteredFeed.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-8">
              <div className="flex flex-col items-center text-center">
                <Megaphone className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhuma atividade nesta categoria.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Complete missoes e conquiste badges para aparecer no feed!
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredFeed.map((event) => (
            <Card key={event.id} className="border-border/50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-[10px] bg-accent">{event.user_initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{event.user_name}</span>{' '}
                      <span className="text-muted-foreground">{event.description}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-muted-foreground">{timeAgo(event.timestamp)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {eventIcon(event.type)}
                    {event.xp > 0 && (
                      <Badge variant="secondary" className="text-[9px]">+{event.xp} XP</Badge>
                    )}
                    <button
                      onClick={() => toggleLike(event.id)}
                      className="p-1 rounded-md hover:bg-accent/50 transition-colors"
                    >
                      <Heart
                        className={`h-3.5 w-3.5 transition-colors ${
                          likedPosts.has(event.id)
                            ? 'fill-red-500 text-red-500'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
