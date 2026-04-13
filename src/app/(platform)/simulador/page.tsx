'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { getCached, setCache } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Swords,
  Send,
  RotateCcw,
  Star,
  AlertTriangle,
  Lightbulb,
  Trophy,
  Lock,
  MessageSquare,
} from 'lucide-react'

interface ClientScenario {
  nome: string
  empresa: string
  cargo: string
  setor: string
  objecao_principal: string
  contexto: string
  temperamento: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Feedback {
  ponto_forte: string
  erro_especifico: string
  frase_ideal: string
  nota: number
}

interface Session {
  id: string
  scenario: ClientScenario
  difficulty: number
  completed: boolean
  feedback?: Feedback
  created_at: string
}

type Phase = 'select' | 'chat' | 'feedback'

export default function SimuladorPage() {
  const { user } = useRequiredAuth()
  const [phase, setPhase] = useState<Phase>('select')
  const [difficulty, setDifficulty] = useState(1)
  const [starting, setStarting] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [generatingFeedback, setGeneratingFeedback] = useState(false)
  const cachedHist = useRef(getCached<{ history: Session[]; maxUnlocked: number }>('sim-hist'))
  const [history, setHistory] = useState<Session[]>(cachedHist.current?.history ?? [])
  const [maxUnlocked, setMaxUnlocked] = useState(cachedHist.current?.maxUnlocked ?? 1)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load history and determine max unlocked difficulty
  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    fetch('/api/ai/simulador', { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const sessions: Session[] = data.sessions || []
        setHistory(sessions)
        let maxCompleted = 0
        for (const s of sessions) {
          if (s.completed && s.difficulty > maxCompleted) {
            maxCompleted = s.difficulty
          }
        }
        const unlocked = Math.min(3, maxCompleted + 1)
        setMaxUnlocked(unlocked)
        setCache('sim-hist', { history: sessions, maxUnlocked: unlocked }, 5 * 60 * 1000)
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout))

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [user])

  const startSimulation = async () => {
    setStarting(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    try {
      const res = await fetch('/api/ai/simulador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', difficulty }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.session) {
        setSession(data.session)
        setMessages([])
        setFeedback(null)
        setPhase('chat')
      }
    } catch {
      // timeout or network error
    } finally {
      clearTimeout(timeout)
      setStarting(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !session || sending) return
    const userMsg = input.trim()
    setInput('')
    setSending(true)
    setStreaming(true)

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)

    // Add placeholder for assistant
    setMessages([...newMessages, { role: 'assistant', content: '' }])

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    try {
      const res = await fetch('/api/ai/simulador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          sessionId: session.id,
          message: userMsg,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error('Erro')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        assistantText += chunk
        setMessages([...newMessages, { role: 'assistant', content: assistantText }])
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Desculpe, houve um erro na simulação. Tente novamente.' },
      ])
    } finally {
      clearTimeout(timeout)
      setSending(false)
      setStreaming(false)
    }
  }

  const requestFeedback = async () => {
    if (!session) return
    setGeneratingFeedback(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)
    try {
      const res = await fetch('/api/ai/simulador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feedback', sessionId: session.id }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.feedback) {
        setFeedback(data.feedback)
        setPhase('feedback')
        // Refresh history to update unlocked levels
        const histRes = await fetch('/api/ai/simulador', { signal: controller.signal })
        const histData = await histRes.json()
        const sessions: Session[] = histData.sessions || []
        setHistory(sessions)
        let maxCompleted = 0
        for (const s of sessions) {
          if (s.completed && s.difficulty > maxCompleted) {
            maxCompleted = s.difficulty
          }
        }
        setMaxUnlocked(Math.min(3, maxCompleted + 1))
      }
    } catch {
      // timeout or network error
    } finally {
      clearTimeout(timeout)
      setGeneratingFeedback(false)
    }
  }

  const resetToSelect = () => {
    setPhase('select')
    setSession(null)
    setMessages([])
    setFeedback(null)
  }


  const difficultyConfig = [
    { level: 1, label: 'Iniciante', desc: 'Objeção de preço', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    { level: 2, label: 'Intermediário', desc: 'Objeção de timing', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    { level: 3, label: 'Avançado', desc: 'Múltiplas objeções', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  ]

  // === DIFFICULTY SELECT PHASE ===
  if (phase === 'select') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Swords className="h-5 w-5 text-primary" />
            Simulador de Proposta
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pratique vendas com um cliente fictício gerado por IA
          </p>
        </div>

        {/* Difficulty selection */}
        <div className="grid gap-4 sm:grid-cols-3">
          {difficultyConfig.map((d) => {
            const locked = d.level > maxUnlocked
            return (
              <Card
                key={d.level}
                className={cn(
                  'cursor-pointer transition-all',
                  locked && 'opacity-50 cursor-not-allowed',
                  difficulty === d.level && !locked && d.border,
                  difficulty === d.level && !locked && 'ring-2 ring-primary/30',
                )}
                onClick={() => !locked && setDifficulty(d.level)}
              >
                <CardContent className="pt-5 text-center">
                  {locked ? (
                    <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  ) : (
                    <div className={cn('mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full', d.bg)}>
                      <span className={cn('text-lg font-bold', d.color)}>{d.level}</span>
                    </div>
                  )}
                  <p className="font-medium">{d.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{d.desc}</p>
                  {locked && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Complete o nível {d.level - 1} para desbloquear
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Button
          onClick={startSimulation}
          disabled={starting}
          className="w-full"
          size="lg"
        >
          {starting ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Gerando cenário...
            </>
          ) : (
            <>
              <Swords className="mr-2 h-4 w-4" />
              Iniciar Simulação — Nível {difficulty}
            </>
          )}
        </Button>

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Simulações anteriores</h3>
            {history.slice(0, 5).map((s) => {
              const sc = s.scenario as ClientScenario
              const dc = difficultyConfig[s.difficulty - 1]
              return (
                <Card key={s.id} className="border-muted">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', dc?.bg)}>
                      <MessageSquare className={cn('h-4 w-4', dc?.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sc?.nome} — {sc?.empresa}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nível {s.difficulty} &middot;{' '}
                        {s.completed ? `Nota: ${(s.feedback as Feedback | undefined)?.nota ?? '—'}/10` : 'Não finalizada'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // === CHAT PHASE ===
  if (phase === 'chat' && session) {
    const scenario = session.scenario as ClientScenario
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Scenario header */}
        <Card className="mb-4 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Swords className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {scenario.nome} &middot; {scenario.cargo} &middot; {scenario.empresa}
              </p>
              <p className="text-xs text-muted-foreground">
                Setor: {scenario.setor} &middot; Nível {session.difficulty}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={requestFeedback}
              disabled={messages.length < 4 || generatingFeedback}
            >
              {generatingFeedback ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <>
                  <Trophy className="mr-1.5 h-3.5 w-3.5" />
                  Finalizar
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Context tip */}
        {messages.length === 0 && (
          <Card className="mb-4 border-amber-500/20 bg-amber-500/5">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-amber-600">Contexto:</strong> {scenario.contexto}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong className="text-amber-600">Objeção esperada:</strong> {scenario.objecao_principal}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 italic">
                Inicie a conversa como se estivesse em uma reunião de vendas com esse cliente.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md',
                )}
              >
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="mt-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Sua abordagem de vendas..."
            disabled={sending}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={!input.trim() || sending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {messages.length >= 4 && !streaming && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Quando sentir que a conversa chegou ao ponto, clique em &quot;Finalizar&quot; para receber feedback.
          </p>
        )}
      </div>
    )
  }

  // === FEEDBACK PHASE ===
  if (phase === 'feedback' && feedback) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Trophy className="h-5 w-5 text-primary" />
            Feedback da Simulação
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Análise do seu desempenho na simulação nível {session?.difficulty}
          </p>
        </div>

        {/* Score */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="flex items-center gap-4 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <span className="text-2xl font-bold text-primary">{feedback.nota}</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sua nota</p>
              <p className="text-lg font-semibold">
                {feedback.nota >= 8 ? 'Excelente!' : feedback.nota >= 6 ? 'Bom trabalho!' : feedback.nota >= 4 ? 'Continue praticando' : 'Precisa melhorar'}
              </p>
              <div className="mt-1 flex gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-4 w-4',
                      i < feedback.nota ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20',
                    )}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback blocks */}
        <div className="space-y-4">
          <Card className="border-emerald-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <Trophy className="h-4 w-4" />
                Ponto Forte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{feedback.ponto_forte}</p>
            </CardContent>
          </Card>

          <Card className="border-red-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-500">
                <AlertTriangle className="h-4 w-4" />
                Erro Identificado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{feedback.erro_especifico}</p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-blue-500">
                <Lightbulb className="h-4 w-4" />
                Frase Ideal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm italic text-foreground">&quot;{feedback.frase_ideal}&quot;</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={resetToSelect} variant="outline" className="flex-1">
            <RotateCcw className="mr-2 h-4 w-4" />
            Nova Simulação
          </Button>
          <Button onClick={() => { setDifficulty(Math.min(3, (session?.difficulty || 1) + 1)); resetToSelect() }} className="flex-1">
            <Swords className="mr-2 h-4 w-4" />
            Próximo Nível
          </Button>
        </div>
      </div>
    )
  }

  return null
}
