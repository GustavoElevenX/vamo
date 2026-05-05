'use client'

import { useEffect, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Heart, Medal, Megaphone, Sparkles, Star, Target, Trophy } from 'lucide-react'
import { toast } from 'sonner'

type FilterTab = 'todos' | 'conquistas' | 'reconhecimentos' | 'celebracoes'

interface FeedEvent {
  id: string
  kind: 'post' | 'system'
  type: 'achievement' | 'recognition' | 'celebration' | 'milestone'
  user_name: string
  user_initials: string
  description: string
  timestamp: string
  xp: number
  likes_count: number
  liked: boolean
}

const tabs: { key: FilterTab; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'conquistas', label: 'Conquistas' },
  { key: 'reconhecimentos', label: 'Reconhecimentos' },
  { key: 'celebracoes', label: 'Celebracoes' },
]

const filterMap: Record<FilterTab, string[]> = {
  todos: [],
  conquistas: ['achievement', 'milestone'],
  reconhecimentos: ['recognition'],
  celebracoes: ['celebration'],
}

export default function FeedRecompensasPage() {
  const { user } = useRequiredAuth()
  const [loading, setLoading] = useState(true)
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('todos')
  const [content, setContent] = useState('')
  const [type, setType] = useState<'recognition' | 'celebration' | 'milestone'>('recognition')
  const [posting, setPosting] = useState(false)

  const loadFeed = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/feed', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Erro ao carregar feed')
      const data = await res.json() as { events: FeedEvent[] }
      setFeed(data.events)
    } catch {
      setFeed([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadFeed()
  }, [user])

  const publish = async () => {
    if (!content.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content }),
      })
      if (!res.ok) throw new Error('Erro ao publicar')
      setContent('')
      toast.success('Publicado no feed.')
      await loadFeed()
    } catch {
      toast.error('Nao foi possivel publicar no feed.')
    } finally {
      setPosting(false)
    }
  }

  const toggleLike = async (event: FeedEvent) => {
    if (event.kind !== 'post') return
    setFeed((prev) =>
      prev.map((item) =>
        item.id === event.id
          ? { ...item, liked: !item.liked, likes_count: Math.max(0, item.likes_count + (item.liked ? -1 : 1)) }
          : item
      )
    )

    try {
      const res = await fetch('/api/feed', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: event.id }),
      })
      if (!res.ok) throw new Error('Erro ao curtir')
      const data = await res.json() as { liked: boolean; likes_count: number }
      setFeed((prev) => prev.map((item) => item.id === event.id ? { ...item, liked: data.liked, likes_count: data.likes_count } : item))
    } catch {
      await loadFeed()
    }
  }

  const eventIcon = (eventType: string) => {
    switch (eventType) {
      case 'achievement': return <Medal className="h-4 w-4 text-violet-500" />
      case 'recognition': return <Star className="h-4 w-4 text-amber-500" />
      case 'celebration': return <Target className="h-4 w-4 text-emerald-500" />
      case 'milestone': return <Trophy className="h-4 w-4 text-blue-500" />
      default: return <Sparkles className="h-4 w-4 text-muted-foreground" />
    }
  }

  const timeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.max(0, Math.floor(diff / 60000))
    if (minutes < 60) return `${minutes}min atras`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atras`
    return `${Math.floor(hours / 24)}d atras`
  }

  const filteredFeed = activeTab === 'todos'
    ? feed
    : feed.filter((event) => filterMap[activeTab].includes(event.type))

  const canPost = user?.role === 'manager' || user?.role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Feed & Reconhecimento</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Eventos reais de missoes, badges e reconhecimentos publicados pela equipe.
        </p>
      </div>

      {canPost && (
        <Card className="border-border/50">
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={type}
                onChange={(event) => setType(event.target.value as 'recognition' | 'celebration' | 'milestone')}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="recognition">Reconhecimento</option>
                <option value="celebration">Celebracao</option>
                <option value="milestone">Marco do time</option>
              </select>
              <Button onClick={publish} disabled={posting || !content.trim()} className="sm:ml-auto">
                {posting ? 'Publicando...' : 'Publicar'}
              </Button>
            </div>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Escreva um reconhecimento ou celebracao com contexto real."
            />
          </CardContent>
        </Card>
      )}

      <div className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <Card className="border-border/50">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Carregando feed...</CardContent>
          </Card>
        ) : filteredFeed.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-8">
              <div className="flex flex-col items-center text-center">
                <Megaphone className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">Nenhuma atividade real nesta categoria.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Conclua missoes, ganhe badges ou publique um reconhecimento para movimentar o feed.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredFeed.map((event) => (
            <Card key={event.id} className="border-border/50">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-accent text-[10px]">{event.user_initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{event.user_name}</span>{' '}
                      <span className="text-muted-foreground">{event.description}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(event.timestamp)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {eventIcon(event.type)}
                    {event.xp > 0 && <Badge variant="secondary" className="text-[9px]">+{event.xp} XP</Badge>}
                    <button
                      onClick={() => toggleLike(event)}
                      disabled={event.kind !== 'post'}
                      className="flex items-center gap-1 rounded-md p-1 text-[10px] text-muted-foreground transition-colors enabled:hover:bg-accent/50"
                    >
                      <Heart className={`h-3.5 w-3.5 ${event.liked ? 'fill-red-500 text-red-500' : ''}`} />
                      {event.likes_count}
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
