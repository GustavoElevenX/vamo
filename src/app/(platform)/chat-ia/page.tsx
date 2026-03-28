'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Send,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Target,
  BarChart3,
  Zap,
  Users,
  MessageCircle,
  TrendingUp,
  ArrowDown,
  ChevronRight,
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  id: number
}

interface Suggestion {
  icon: React.ReactNode
  label: string
  prompt: string
}

const MANAGER_SUGGESTIONS: Suggestion[] = [
  { icon: <Target className="h-4 w-4" />, label: 'Criar missão', prompt: 'Crie uma missão eficiente para minha equipe de vendas esta semana, focada em aumentar conversão.' },
  { icon: <BarChart3 className="h-4 w-4" />, label: 'Analisar KPIs', prompt: 'Quais KPIs devo priorizar para monitorar agora e quais sinais de alerta devo observar?' },
  { icon: <Zap className="h-4 w-4" />, label: 'Plano de ação', prompt: 'Monte um plano de ação passo a passo para ajudar minha equipe a bater a meta mensal.' },
  { icon: <Users className="h-4 w-4" />, label: 'Motivar equipe', prompt: 'Como devo abordar um vendedor com baixa performance sem desmotivá-lo ainda mais?' },
  { icon: <MessageCircle className="h-4 w-4" />, label: 'Dar feedback', prompt: 'Como estruturar um feedback de performance eficaz e construtivo para minha equipe?' },
  { icon: <TrendingUp className="h-4 w-4" />, label: 'Identificar gargalos', prompt: 'Quais são os principais gargalos que costumam impedir equipes de vendas de bater metas?' },
]

const SELLER_SUGGESTIONS: Suggestion[] = [
  { icon: <Target className="h-4 w-4" />, label: 'Bater minha meta', prompt: 'Me ajude com um plano prático para atingir minha meta de vendas esta semana.' },
  { icon: <Zap className="h-4 w-4" />, label: 'Quebrar objeção de preço', prompt: 'Como quebrar a objeção de preço quando o cliente diz que está caro?' },
  { icon: <MessageCircle className="h-4 w-4" />, label: 'Script de prospecção', prompt: 'Me dê um script eficaz para prospectar novos clientes por telefone ou WhatsApp.' },
  { icon: <TrendingUp className="h-4 w-4" />, label: 'Fechar venda difícil', prompt: 'Quais técnicas posso usar para fechar uma venda quando o cliente está indeciso?' },
  { icon: <BarChart3 className="h-4 w-4" />, label: 'Negociar melhor', prompt: 'Como negociar condições sem perder margem e sem parecer desesperado para vender?' },
  { icon: <Users className="h-4 w-4" />, label: 'Follow-up eficiente', prompt: 'Como fazer um follow-up com cliente que sumiu sem ser chato ou inconveniente?' },
]

let msgIdCounter = 0

export default function ChatIAPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const role = user?.role ?? 'seller'
  const firstName = user?.name?.split(' ')[0] ?? ''
  const suggestions = role === 'manager' ? MANAGER_SUGGESTIONS : SELLER_SUGGESTIONS

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (messages.length > 0) scrollToBottom()
  }, [messages, scrollToBottom])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: Message = { role: 'user', content: text.trim(), id: ++msgIdCounter }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setStreaming(true)
    const aiMsgId = ++msgIdCounter
    setMessages((prev) => [...prev, { role: 'assistant', content: '', id: aiMsgId }])

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({ role, content })),
          role,
          userName: user?.name ?? 'Usuário',
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: 'Desculpe, ocorreu um erro. Tente novamente.' } : m
          )
        )
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: fullText } : m))
        )
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: 'Erro de conexão. Verifique sua internet e tente novamente.' } : m
        )
      )
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const copyMessage = async (content: string, id: number) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const clearChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
  }

  const lastMsgIsStreaming = streaming && messages.at(-1)?.role === 'assistant' && messages.at(-1)?.content === ''

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">VAMO IA</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {role === 'manager' ? 'Assistente de Gestão Comercial' : 'Coach Pessoal de Vendas'}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearChat}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Nova conversa
          </Button>
        )}
      </div>

      {/* ── Messages ── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {/* Welcome state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center px-4 pt-10 pb-6 gap-8 max-w-2xl mx-auto">

            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {firstName ? `Olá, ${firstName}!` : 'Olá!'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {role === 'manager'
                    ? 'Como posso ajudar sua gestão hoje?'
                    : 'Como posso te ajudar a vender mais hoje?'}
                </p>
              </div>
            </div>

            {/* Suggestion cards */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.prompt)}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-all duration-150"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.label}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{s.prompt.slice(0, 52)}…</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-primary/60 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages list */}
        {messages.length > 0 && (
          <div className="flex flex-col gap-1 px-4 py-5 max-w-3xl mx-auto">
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              const isLastAI = !isUser && i === messages.length - 1

              return (
                <div key={msg.id} className={`flex gap-3 group ${isUser ? 'justify-end' : 'justify-start'} mb-1`}>

                  {/* AI avatar */}
                  {!isUser && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-1 self-start">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}

                  <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} max-w-[78%]`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted/80 rounded-tl-sm'
                      }`}
                    >
                      {/* Typing indicator */}
                      {isLastAI && lastMsgIsStreaming ? (
                        <span className="flex gap-1 items-center h-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:120ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:240ms]" />
                        </span>
                      ) : (
                        <>
                          {msg.content}
                          {/* Streaming cursor */}
                          {isLastAI && streaming && msg.content !== '' && (
                            <span className="inline-block w-0.5 h-3.5 bg-muted-foreground/60 ml-0.5 align-middle animate-pulse" />
                          )}
                        </>
                      )}
                    </div>

                    {/* Copy button for AI messages */}
                    {!isUser && msg.content && !streaming && (
                      <button
                        onClick={() => copyMessage(msg.content, msg.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {copiedId === msg.id ? (
                          <><Check className="h-3 w-3 text-emerald-500" /> Copiado</>
                        ) : (
                          <><Copy className="h-3 w-3" /> Copiar</>
                        )}
                      </button>
                    )}
                  </div>

                  {/* User avatar placeholder for alignment */}
                  {isUser && <div className="w-7 shrink-0" />}
                </div>
              )
            })}

            {/* Quick follow-ups after first exchange */}
            {messages.length === 2 && !streaming && (
              <div className="flex flex-wrap gap-2 mt-2 pl-10">
                {suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.prompt)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <span className="text-muted-foreground">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <div className="absolute bottom-[84px] right-5 z-10">
          <Button
            size="icon"
            variant="secondary"
            className="rounded-full h-8 w-8 shadow-md border"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur-sm px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={
                role === 'manager'
                  ? 'Pergunte sobre sua equipe, metas ou missões...'
                  : 'Pergunte sobre vendas, objeções ou suas missões...'
              }
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 min-h-[28px] max-h-[160px] placeholder:text-muted-foreground/60"
              disabled={streaming}
            />
            <Button
              size="icon"
              className="h-8 w-8 rounded-xl shrink-0 mb-0.5"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/60 mt-1.5">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  )
}
