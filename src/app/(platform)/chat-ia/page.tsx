'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { clearCache } from '@/lib/cache'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ActionCard } from '@/components/ai/action-card'
import type { ChatMessage, ActionCard as ActionCardType, ActionPayload, ActionStatus } from '@/types/chat'
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
  Plus,
  AlertCircle,
} from 'lucide-react'

interface Suggestion {
  icon: React.ReactNode
  label: string
  prompt: string
}

const MANAGER_SUGGESTIONS: Suggestion[] = [
  { icon: <Target className="h-4 w-4" />, label: 'Criar missão', prompt: 'Crie uma missão de prospecção para minha equipe esta semana.' },
  { icon: <Users className="h-4 w-4" />, label: 'Adicionar vendedor', prompt: 'Quero adicionar um novo vendedor na equipe.' },
  { icon: <Zap className="h-4 w-4" />, label: 'Dar XP de bônus', prompt: 'Quero premiar o melhor vendedor da semana com XP bônus.' },
  { icon: <BarChart3 className="h-4 w-4" />, label: 'Analisar KPIs', prompt: 'Quais KPIs devo priorizar e quais sinais de alerta devo observar?' },
  { icon: <MessageCircle className="h-4 w-4" />, label: 'Gerar briefing', prompt: 'Gere o briefing semanal da minha equipe.' },
  { icon: <TrendingUp className="h-4 w-4" />, label: 'Plano de ação', prompt: 'Monte um plano de ação para ajudar minha equipe a bater a meta mensal.' },
]

const SELLER_SUGGESTIONS: Suggestion[] = [
  { icon: <Target className="h-4 w-4" />, label: 'Bater minha meta', prompt: 'Me ajude com um plano prático para atingir minha meta de vendas esta semana.' },
  { icon: <Zap className="h-4 w-4" />, label: 'Quebrar objeção de preço', prompt: 'Como quebrar a objeção de preço quando o cliente diz que está caro?' },
  { icon: <MessageCircle className="h-4 w-4" />, label: 'Script de prospecção', prompt: 'Me dê um script eficaz para prospectar novos clientes por telefone ou WhatsApp.' },
  { icon: <TrendingUp className="h-4 w-4" />, label: 'Fechar venda difícil', prompt: 'Quais técnicas posso usar para fechar uma venda quando o cliente está indeciso?' },
  { icon: <BarChart3 className="h-4 w-4" />, label: 'Negociar melhor', prompt: 'Como negociar condições sem perder margem e sem parecer desesperado para vender?' },
  { icon: <Users className="h-4 w-4" />, label: 'Follow-up eficiente', prompt: 'Como fazer um follow-up com cliente que sumiu sem ser chato ou inconveniente?' },
]

const ACTION_DELIMITER = '\n---ACTION---\n'
const AUTO_EXECUTE_ACTIONS = ['analyze_operation', 'simulate_decision', 'generate_manager_briefing', 'generate_meeting_agenda']

let msgIdCounter = 0
let actionIdCounter = 0

export default function ChatIAPage() {
  const { user } = useRequiredAuth()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [dynamicSuggestions, setDynamicSuggestions] = useState<Suggestion[] | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const role = user?.role ?? 'seller'
  const firstName = user?.name?.split(' ')[0] ?? ''
  const suggestions = role === 'manager' ? (dynamicSuggestions ?? MANAGER_SUGGESTIONS) : SELLER_SUGGESTIONS

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (messages.length > 0) scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (role !== 'manager') return

    let cancelled = false
    fetch('/api/manager/cockpit')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.actionQueue?.length) return
        const items = data.actionQueue.slice(0, 4).map((item: { title: string; description: string }) => ({
          icon: <Sparkles className="h-4 w-4" />,
          label: item.title.length > 28 ? `${item.title.slice(0, 25)}...` : item.title,
          prompt: `Analise este ponto e recomende a melhor acao: ${item.title}. Contexto: ${item.description}`,
        }))
        setDynamicSuggestions([
          ...items,
          { icon: <BarChart3 className="h-4 w-4" />, label: 'Analisar operacao', prompt: 'Analise a operacao atual e me diga o que devo fazer hoje.' },
          { icon: <TrendingUp className="h-4 w-4" />, label: 'Criar plano', prompt: 'Crie um plano de acao priorizado para recuperar os principais riscos da operacao.' },
        ])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [role])

  useEffect(() => {
    const prefill = sessionStorage.getItem('chat_prefill')
    const queryPrompt = searchParams.get('prompt')
    const prompt = queryPrompt || prefill
    if (prompt) {
      sessionStorage.removeItem('chat_prefill')
      setInput(prompt)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
          textareaRef.current.focus()
        }
      }, 50)
    }
  }, [searchParams])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim(), id: ++msgIdCounter }
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
      const timeout = setTimeout(() => controller.abort(), 60_000)

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content, actionCard }) => {
            let serializedContent = content
            if (actionCard) {
              const p = JSON.stringify(actionCard.action.params)
              if (actionCard.status === 'completed') {
                serializedContent += `\n[AÇÃO EXECUTADA: ${actionCard.action.action}(${p}) → ${actionCard.result?.message ?? 'sucesso'}]`
              } else if (actionCard.status === 'failed') {
                serializedContent += `\n[AÇÃO FALHOU: ${actionCard.action.action}(${p}) → ERRO: ${actionCard.result?.message ?? 'erro desconhecido'}]`
              } else if (actionCard.status === 'rejected') {
                serializedContent += `\n[AÇÃO RECUSADA pelo usuário: ${actionCard.action.action}(${p})]`
              } else {
                serializedContent += `\n[AÇÃO AGUARDANDO APROVAÇÃO: ${actionCard.action.action}(${p})]`
              }
            }
            return { role, content: serializedContent }
          }),
          role,
          userName: user?.name ?? 'Usuário',
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

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

        const displayText = fullText.includes(ACTION_DELIMITER)
          ? fullText.split(ACTION_DELIMITER)[0]
          : fullText

        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: displayText } : m))
        )
      }

      if (fullText.includes(ACTION_DELIMITER)) {
        const [textContent, actionJson] = fullText.split(ACTION_DELIMITER)
        try {
          const actionPayload: ActionPayload = JSON.parse(actionJson.trim())

          if (AUTO_EXECUTE_ACTIONS.includes(actionPayload.action)) {
            // Mostrar card executando imediatamente
            const actionCard: ActionCardType = {
              id: `action-${++actionIdCounter}`,
              action: actionPayload,
              status: 'executing',
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: textContent.trim(), actionCard } : m
              )
            )

            // Executar sem aprovação
            try {
              const execRes = await fetch('/api/ai/chat/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  actionType: actionPayload.action,
                  params: actionPayload.params,
                }),
              })
              const execResult = await execRes.json()
              if (execResult.success && actionPayload.action === 'generate_briefing') {
                clearCache('briefings')
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId && m.actionCard
                    ? {
                        ...m,
                        actionCard: {
                          ...m.actionCard,
                          status: execResult.success ? 'completed' : 'failed',
                          result: execResult,
                        },
                      }
                    : m
                )
              )
            } catch {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId && m.actionCard
                    ? {
                        ...m,
                        actionCard: {
                          ...m.actionCard,
                          status: 'failed',
                          result: { success: false, message: 'Erro ao executar ação' },
                        },
                      }
                    : m
                )
              )
            }
          } else {
            // Demais ações mantêm fluxo de aprovação normal
            const actionCard: ActionCardType = {
              id: `action-${++actionIdCounter}`,
              action: actionPayload,
              status: 'pending',
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId ? { ...m, content: textContent.trim(), actionCard } : m
              )
            )
          }
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: textContent.trim() } : m
            )
          )
        }
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

  const handleApprove = async (messageId: number) => {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg?.actionCard) return

    updateActionStatus(messageId, 'executing')

    try {
      const res = await fetch('/api/ai/chat/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: msg.actionCard.action.action,
          params: msg.actionCard.action.params,
        }),
      })

      const result = await res.json()

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.actionCard
            ? {
                ...m,
                actionCard: {
                  ...m.actionCard,
                  status: result.success ? 'completed' : 'failed',
                  result,
                },
              }
            : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.actionCard
            ? {
                ...m,
                actionCard: {
                  ...m.actionCard,
                  status: 'failed',
                  result: { success: false, message: 'Erro de conexão ao executar ação' },
                },
              }
            : m
        )
      )
    }
  }

  const handleReject = (messageId: number) => {
    updateActionStatus(messageId, 'rejected')
  }

  const handleRetry = (messageId: number) => {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg?.actionCard) return

    const errorMsg = msg.actionCard.result?.message ?? ''
    const isPermanentError = errorMsg.includes('já está cadastrado') ||
      errorMsg.includes('não encontrado') ||
      errorMsg.includes('inválido') ||
      errorMsg.includes('obrigatório')

    if (isPermanentError) {
      updateActionStatus(messageId, 'rejected')
      const action = msg.actionCard.action.action
      const hints: Record<string, string> = {
        add_seller: 'Preciso corrigir o cadastro do vendedor. Qual dado devo mudar?',
        create_mission: 'A missão falhou. Como devo ajustar?',
        define_kpi: 'O KPI falhou. Como devo ajustar?',
      }
      const hint = hints[action] || `A ação falhou (${errorMsg}). Pode corrigir?`
      sendMessage(hint)
    } else {
      handleApprove(messageId)
    }
  }

  const updateActionStatus = (messageId: number, status: ActionStatus) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.actionCard
          ? { ...m, actionCard: { ...m.actionCard, status } }
          : m
      )
    )
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

  const lastExchangeNeedsAction = useMemo(() => {
    if (streaming || messages.length < 2) return false
    const lastAI = messages.at(-1)
    const lastUser = messages.at(-2)
    if (!lastAI || lastAI.role !== 'assistant') return false
    if (lastAI.actionCard) return false
    if (!lastUser || lastUser.role !== 'user') return false
    const hasEmail = /@/.test(lastUser.content)
    const aiDescribedAction = /vou cadastrar|vou criar|vou adicionar|vou registrar|vou dar|vou gerar/i.test(lastAI.content)
    return hasEmail && aiDescribedAction
  }, [messages, streaming])

  const lastMsgIsStreaming = streaming && messages.at(-1)?.role === 'assistant' && messages.at(-1)?.content === ''
  const hasMessages = messages.length > 0

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-background">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-border/60 bg-background/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 ring-1 ring-primary/25 shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none tracking-tight">VAMO IA</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {role === 'manager' ? 'Consultora de Performance Comercial' : 'Coach Pessoal de Vendas'}
            </p>
          </div>
        </div>

        {hasMessages && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={clearChat}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nova conversa</span>
          </Button>
        )}
      </div>

      {/* ── Messages Container ── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        {/* Welcome / Empty State */}
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center min-h-full px-4 py-10">
            <div className="w-full max-w-2xl">

              {/* Hero */}
              <div className="flex flex-col items-center gap-4 text-center mb-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/25 to-primary/10 ring-1 ring-primary/20 shadow-lg shadow-primary/10">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
                    {firstName ? `Olá, ${firstName}!` : 'Olá!'}
                  </h1>
                  <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                    {role === 'manager'
                      ? 'Sou sua consultora de performance comercial. Posso criar missões, adicionar vendedores, analisar KPIs e muito mais.'
                      : 'Sou seu coach de vendas. Posso ajudar com scripts, técnicas de fechamento, negociação e estratégias para bater sua meta.'}
                  </p>
                </div>
              </div>

              {/* Suggestion Cards */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-widest px-1">
                  Comece com uma sugestão
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(s.prompt)}
                      className="group text-left p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary transition-colors mt-0.5">
                          {s.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground mb-0.5">{s.label}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{s.prompt}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-1 group-hover:text-primary/50 transition-all group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground/50 mt-8">
                Ou digite sua pergunta abaixo para uma conversa livre
              </p>
            </div>
          </div>
        )}

        {/* Messages List */}
        {hasMessages && (
          <div className="w-full max-w-3xl mx-auto px-4 py-6">
            <div className="space-y-4">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                const isLastMsg = idx === messages.length - 1

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 group ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* AI Avatar */}
                    {!isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 ring-1 ring-primary/20 mt-0.5 self-start">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}

                    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} max-w-[82%] sm:max-w-[72%]`}>
                      {/* Bubble */}
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed break-words transition-all ${
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-br-sm shadow-sm'
                            : 'bg-muted/70 text-foreground rounded-bl-sm border border-border/40'
                        }`}
                      >
                        {/* Typing dots */}
                        {isLastMsg && lastMsgIsStreaming ? (
                          <span className="flex gap-1.5 items-center h-5">
                            <span className="w-2 h-2 rounded-full bg-current opacity-50 animate-bounce [animation-delay:0ms]" />
                            <span className="w-2 h-2 rounded-full bg-current opacity-50 animate-bounce [animation-delay:150ms]" />
                            <span className="w-2 h-2 rounded-full bg-current opacity-50 animate-bounce [animation-delay:300ms]" />
                          </span>
                        ) : (
                          <>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                            {isLastMsg && streaming && msg.content !== '' && (
                              <span className="inline-block w-0.5 h-4 bg-current ml-1 align-middle animate-pulse opacity-60" />
                            )}
                          </>
                        )}
                      </div>

                      {/* Action Card */}
                      {!isUser && msg.actionCard && !streaming && (
                        <div className="w-full">
                          <ActionCard
                            actionCard={msg.actionCard}
                            onApprove={() => handleApprove(msg.id)}
                            onReject={() => handleReject(msg.id)}
                            onRetry={() => handleRetry(msg.id)}
                          />
                        </div>
                      )}

                      {/* Copy button */}
                      {!isUser && msg.content && !streaming && (
                        <button
                          onClick={() => copyMessage(msg.content, msg.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all opacity-0 group-hover:opacity-100"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {isUser && <div className="w-8 shrink-0" />}
                  </div>
                )
              })}

              {/* Action missing safeguard */}
              {lastExchangeNeedsAction && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 mt-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-400">Card de ação não apareceu?</p>
                    <p className="text-xs text-amber-700/70 dark:text-amber-500/70 mt-0.5">Clique em prosseguir para continuar a ação.</p>
                  </div>
                  <button
                    onClick={() => sendMessage('pode prosseguir com a ação agora')}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                  >
                    Prosseguir
                  </button>
                </div>
              )}

              {/* Quick follow-up suggestions after first exchange */}
              {messages.length === 2 && !streaming && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border/30">
                  <p className="w-full text-xs text-muted-foreground/60 uppercase tracking-widest font-medium mb-1">
                    Próximos passos
                  </p>
                  {suggestions.slice(0, 3).map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(s.prompt)}
                      className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-border/60 bg-card hover:bg-muted/50 hover:border-primary/40 transition-all text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5 opacity-50" />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} className="h-2" />
            </div>
          </div>
        )}
      </div>

      {/* Scroll to Bottom */}
      {showScrollBtn && (
        <div className="absolute bottom-24 right-4 z-20 md:right-6">
          <Button
            size="icon"
            variant="secondary"
            className="rounded-full h-9 w-9 shadow-lg border border-border/60 hover:scale-105 transition-transform"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Input Bar ── */}
      <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-md px-4 md:px-6 py-4">
        <div className="w-full max-w-3xl mx-auto">
          <div className="flex items-end gap-3 rounded-2xl border border-border/80 bg-card/90 px-4 py-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition-all duration-200 shadow-sm hover:shadow-md">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={
                role === 'manager'
                  ? 'Peça qualquer coisa: criar missão, adicionar vendedor, dar XP...'
                  : 'Pergunte sobre vendas, objeções ou suas missões...'
              }
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 min-h-6 max-h-36 placeholder:text-muted-foreground/50"
              disabled={streaming}
            />
            <div className="flex items-center gap-2 shrink-0">
              {streaming && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent opacity-70" />
              )}
              <Button
                size="icon"
                className="h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:shadow-md disabled:opacity-40"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/50 mt-2 px-2">
            <span className="font-medium">↵ Enter</span> para enviar · <span className="font-medium">Shift + ↵</span> para nova linha
          </p>
        </div>
      </div>
    </div>
  )
}
