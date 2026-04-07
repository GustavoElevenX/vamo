'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Zap } from 'lucide-react'

const STORAGE_KEY = 'vamo-chat-fab-dismissed'

export function ChatFAB() {
  const pathname = usePathname()
  // Starts visible; only hides if user explicitly closed it this session
  const [isVisible, setIsVisible] = useState(false)
  const isChatPage = pathname === '/chat-ia'

  // Read persisted state after mount (avoid SSR mismatch)
  useEffect(() => {
    const dismissed = sessionStorage.getItem(STORAGE_KEY)
    setIsVisible(dismissed !== 'true')
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    sessionStorage.setItem(STORAGE_KEY, 'true')
  }

  const handleReopen = () => {
    setIsVisible(true)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  // Don't show on chat page itself
  if (isChatPage) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded card — always open unless user dismissed */}
      {isVisible ? (
        <div className="vamo-chat-fab-card animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Card header */}
          <div className="vamo-chat-fab-card-header">
            <div className="vamo-chat-fab-icon-wrap">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">VAMO IA</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Seu assistente de vendas</p>
            </div>
            <button
              onClick={handleClose}
              className="vamo-chat-fab-close"
              aria-label="Fechar"
              title="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* CTA link */}
          <Link href="/chat-ia" className="vamo-chat-fab-link">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight">Converse com VAMO IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pergunte, analise, decida mais rápido</p>
            </div>
            <div className="vamo-chat-fab-arrow">
              <Zap className="h-4 w-4" />
            </div>
          </Link>
        </div>
      ) : (
        /* Collapsed pill — click to reopen */
        <button
          onClick={handleReopen}
          className="vamo-chat-fab-btn"
          aria-label="Abrir VAMO IA Chat"
          title="Converse com VAMO IA"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="vamo-chat-fab-label">VAMO IA</span>
        </button>
      )}
    </div>
  )
}
