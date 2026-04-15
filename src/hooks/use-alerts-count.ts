'use client'

import { useEffect, useState } from 'react'

/**
 * Busca a contagem de alertas não lidos para o gestor.
 * Revalida a cada 60s.
 */
export function useAlertsCount(enabled: boolean = true): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const fetchCount = async () => {
      try {
        const res = await fetch('/api/ai/alerts')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setCount(data.unreadCount || 0)
      } catch {
        // silent fail
      }
    }

    fetchCount()
    const interval = setInterval(fetchCount, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [enabled])

  return count
}
