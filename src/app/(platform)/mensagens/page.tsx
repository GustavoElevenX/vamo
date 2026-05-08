'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRequiredAuth } from '@/hooks/use-required-auth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Send,
  MessageSquare,
  Users,
  Plus,
  ArrowLeft,
  Search,
  UserCircle2,
  X,
  Check,
} from 'lucide-react'

interface Participant {
  id: string
  name: string
  avatar_url: string | null
  role: string
}

interface Conversation {
  id: string
  is_group: boolean
  name: string
  participants: Participant[]
  last_message: { content: string; created_at: string; sender_id: string } | null
  last_message_at: string | null
  unread_count: number
}

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface Member {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string | null
  active: boolean
}

export default function MensagensPage() {
  const { user } = useRequiredAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [groupMode, setGroupMode] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [mobileShowThread, setMobileShowThread] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isManager = user.role === 'manager' || user.role === 'admin'

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // ── Fetch conversations ──
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations')
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations || [])
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    const iv = setInterval(fetchConversations, 8000)
    return () => clearInterval(iv)
  }, [fetchConversations])

  // Abre automaticamente uma conversa quando vier de /mensagens?conversation=ID
  useEffect(() => {
    if (typeof window === 'undefined') return
    const conversationId = new URLSearchParams(window.location.search).get('conversation')
    if (!conversationId || selectedId === conversationId) return
    if (!conversations.some((conversation) => conversation.id === conversationId)) return

    setSelectedId(conversationId)
    setMobileShowThread(true)
  }, [conversations, selectedId])

  // ── Fetch messages for selected conv ──
  const fetchMessages = useCallback(
    async (convId: string, isPoll = false) => {
      if (!isPoll) setLoadingMsgs(true)
      try {
        const res = await fetch(`/api/chat/conversations/${convId}/messages`)
        if (!res.ok) return
        const data = await res.json()
        setParticipants(data.participants || [])
        setMessages(data.messages || [])
        if (!isPoll) {
          // marca como lido
          fetch(`/api/chat/conversations/${convId}/read`, { method: 'POST' })
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
          )
        }
      } finally {
        if (!isPoll) setLoadingMsgs(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!selectedId) return
    fetchMessages(selectedId)
    const iv = setInterval(() => fetchMessages(selectedId, true), 3000)
    return () => clearInterval(iv)
  }, [selectedId, fetchMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // ── Fetch team members (para novo chat) ──
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team/members')
      if (!res.ok) return
      const data = await res.json()
      setMembers((data.members || []).filter((m: Member) => m.id !== user.id))
    } catch {
      /* ignore */
    }
  }, [user.id])

  const openNewDialog = () => {
    setShowNewDialog(true)
    setGroupMode(false)
    setGroupName('')
    setSelectedMemberIds(new Set())
    setSearchTerm('')
    fetchMembers()
  }

  // ── Start 1:1 conversation ──
  const startDirectChat = async (targetUserId: string) => {
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: targetUserId }),
    })
    if (!res.ok) return
    const data = await res.json()
    setShowNewDialog(false)
    await fetchConversations()
    setSelectedId(data.conversation_id)
    setMobileShowThread(true)
  }

  // ── Create group ──
  const createGroup = async () => {
    if (selectedMemberIds.size === 0 || !groupName.trim()) return
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_group: true,
        name: groupName.trim(),
        participant_ids: Array.from(selectedMemberIds),
      }),
    })
    if (!res.ok) return
    const data = await res.json()
    setShowNewDialog(false)
    await fetchConversations()
    setSelectedId(data.conversation_id)
    setMobileShowThread(true)
  }

  // ── Send message ──
  const sendMessage = async () => {
    if (!input.trim() || !selectedId || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await fetch(`/api/chat/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        await fetchMessages(selectedId, true)
      }
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId),
    [conversations, selectedId]
  )

  const participantById: Record<string, Participant> = useMemo(() => {
    const map: Record<string, Participant> = {}
    for (const p of participants) map[p.id] = p
    return map
  }, [participants])

  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return members
    return members.filter(
      (m) => m.name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)
    )
  }, [members, searchTerm])

  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* ── Conversation List ── */}
      <aside
        className={cn(
          'flex flex-col w-full md:w-80 md:border-r border-border/60 shrink-0',
          mobileShowThread && 'hidden md:flex'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold">Mensagens</h1>
          </div>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={openNewDialog}>
            <Plus className="h-3.5 w-3.5" />
            <span className="text-xs">Novo</span>
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Carregando...</div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-sm font-medium">Nenhuma conversa</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Comece uma nova conversa com sua equipe
                </p>
              </div>
              <Button size="sm" onClick={openNewDialog} className="mt-2">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nova conversa
              </Button>
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === selectedId
              const others = c.participants.filter((p) => p.id !== user.id)
              const avatar = c.is_group ? null : others[0]?.avatar_url
              const initial = (c.name || '?').charAt(0).toUpperCase()
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id)
                    setMobileShowThread(true)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-accent/40 transition-colors text-left',
                    isActive && 'bg-primary/5'
                  )}
                >
                  <div className="relative shrink-0">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatar}
                        alt={c.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold',
                          c.is_group
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : 'bg-primary/15 text-primary'
                        )}
                      >
                        {c.is_group ? <Users className="h-5 w-5" /> : initial}
                      </div>
                    )}
                    {c.unread_count > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {c.unread_count > 9 ? '9+' : c.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm truncate',
                          c.unread_count > 0 ? 'font-semibold' : 'font-medium'
                        )}
                      >
                        {c.name}
                      </p>
                      {c.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(c.last_message_at)}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-xs truncate mt-0.5',
                        c.unread_count > 0
                          ? 'text-foreground/80'
                          : 'text-muted-foreground'
                      )}
                    >
                      {c.last_message?.content || 'Nenhuma mensagem ainda'}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ── Thread ── */}
      <main
        className={cn(
          'flex-1 flex flex-col min-w-0',
          !mobileShowThread && 'hidden md:flex'
        )}
      >
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center text-center px-6">
            <div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium mb-1">Selecione uma conversa</p>
              <p className="text-xs text-muted-foreground">
                Escolha uma conversa ou inicie uma nova para começar a conversar
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden h-8 w-8 -ml-1"
                onClick={() => setMobileShowThread(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold shrink-0',
                  selectedConv?.is_group
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-primary/15 text-primary'
                )}
              >
                {selectedConv?.is_group ? (
                  <Users className="h-4 w-4" />
                ) : (
                  (selectedConv?.name || '?').charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{selectedConv?.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {selectedConv?.is_group
                    ? `${participants.length} participantes`
                    : selectedConv?.participants.find((p) => p.id !== user.id)?.role === 'manager'
                      ? 'Gestor'
                      : 'Vendedor'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingMsgs ? (
                <div className="text-center text-xs text-muted-foreground py-8">Carregando...</div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                  <p className="text-xs text-muted-foreground/70">Envie a primeira mensagem abaixo</p>
                </div>
              ) : (
                <div className="space-y-2 max-w-3xl mx-auto">
                  {messages.map((m, idx) => {
                    const isMe = m.sender_id === user.id
                    const prev = messages[idx - 1]
                    const showSender =
                      selectedConv?.is_group &&
                      !isMe &&
                      (!prev || prev.sender_id !== m.sender_id)
                    const sender = participantById[m.sender_id]
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'flex flex-col',
                          isMe ? 'items-end' : 'items-start'
                        )}
                      >
                        {showSender && (
                          <span className="text-[11px] text-muted-foreground ml-2 mb-0.5">
                            {sender?.name || 'Alguém'}
                          </span>
                        )}
                        <div
                          className={cn(
                            'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words',
                            isMe
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted text-foreground rounded-bl-sm'
                          )}
                        >
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 mt-0.5 px-2">
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border/60 bg-background px-4 py-3 shrink-0">
              <div className="flex items-end gap-2 max-w-3xl mx-auto rounded-2xl border border-border/70 bg-card/90 px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition">
                <Textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite uma mensagem..."
                  rows={1}
                  className="flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 min-h-6 max-h-28 placeholder:text-muted-foreground/50"
                  disabled={sending}
                />
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-xl shrink-0"
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── New Conversation Dialog ── */}
      {showNewDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowNewDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <p className="text-sm font-semibold">
                {groupMode ? 'Criar grupo' : 'Nova conversa'}
              </p>
              <button
                onClick={() => setShowNewDialog(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode switcher (manager only) */}
            {isManager && (
              <div className="flex gap-1 px-4 pt-3">
                <button
                  onClick={() => {
                    setGroupMode(false)
                    setSelectedMemberIds(new Set())
                  }}
                  className={cn(
                    'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition',
                    !groupMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  Individual
                </button>
                <button
                  onClick={() => setGroupMode(true)}
                  className={cn(
                    'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition',
                    groupMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  Grupo
                </button>
              </div>
            )}

            {/* Group name input */}
            {groupMode && (
              <div className="px-4 pt-3">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nome do grupo (ex: Equipe Comercial)"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar membro..."
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Members list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum membro encontrado
                </div>
              ) : (
                filteredMembers.map((m) => {
                  const isSelected = selectedMemberIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (groupMode) toggleMemberSelection(m.id)
                        else startDirectChat(m.id)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/60 transition text-left',
                        isSelected && 'bg-primary/10'
                      )}
                    >
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatar_url}
                          alt={m.name}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <UserCircle2 className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {m.role === 'manager' ? 'Gestor' : m.role === 'admin' ? 'Admin' : 'Vendedor'}
                          {' · '}
                          {m.email}
                        </p>
                      </div>
                      {groupMode && isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {/* Footer (group mode) */}
            {groupMode && (
              <div className="px-4 py-3 border-t border-border/60">
                <Button
                  className="w-full"
                  onClick={createGroup}
                  disabled={selectedMemberIds.size === 0 || !groupName.trim()}
                >
                  Criar grupo ({selectedMemberIds.size}{' '}
                  {selectedMemberIds.size === 1 ? 'membro' : 'membros'})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
