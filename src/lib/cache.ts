/**
 * Client-side cache with TTL (stale-while-revalidate pattern).
 * Pages load cached data instantly, then refresh in background.
 */

const PREFIX = 'vc:'

export function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { d, e } = JSON.parse(raw)
    if (Date.now() > e) return null
    return d as T
  } catch {
    return null
  }
}

export function setCache<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ d: data, e: Date.now() + ttlMs }))
  } catch { /* quota exceeded or private browsing */ }
}

export function clearCache(key: string): void {
  try {
    sessionStorage.removeItem(PREFIX + key)
  } catch {}
}
