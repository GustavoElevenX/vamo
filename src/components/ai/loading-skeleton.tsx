'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

const MESSAGES = [
  'Analisando seus dados com VAMO IA...',
  'Identificando padrões de performance...',
  'Gerando insights personalizados...',
  'Preparando recomendações...',
]

export function AILoadingSkeleton() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      <div className="relative">
        <Sparkles className="h-8 w-8 text-primary animate-pulse" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">
        {MESSAGES[messageIndex]}
      </p>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-primary/40 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
