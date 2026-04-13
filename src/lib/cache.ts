/**
 * Client-side cache with TTL (stale-while-revalidate pattern).
 * Uses localStorage so data survives tab/browser close and reduces
 * re-fetches on page reload (sessionStorage was lost every time).
 */

const PREFIX = 'vc:'

function getStorage(): Storage | null {
  try {
    // Prefer localStorage for persistence across tabs/sessions
    return typeof window !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function getCached<T>(key: string): T | null {
  try {
    const storage = getStorage()
    if (!storage) return null
    const raw = storage.getItem(PREFIX + key)
    if (!raw) return null
    const { d, e } = JSON.parse(raw)
    if (Date.now() > e) {
      storage.removeItem(PREFIX + key)
      return null
    }
    return d as T
  } catch {
    return null
  }
}

export function setCache<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  try {
    const storage = getStorage()
    if (!storage) return
    storage.setItem(PREFIX + key, JSON.stringify({ d: data, e: Date.now() + ttlMs }))
  } catch { /* quota exceeded or private browsing */ }
}

export function clearCache(key: string): void {
  try {
    const storage = getStorage()
    if (!storage) return
    storage.removeItem(PREFIX + key)
  } catch {}
}
