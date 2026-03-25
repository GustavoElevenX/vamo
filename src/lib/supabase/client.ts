import { createBrowserClient } from '@supabase/ssr'

const QUERY_TIMEOUT_MS = 15_000

// Singleton — all pages & AuthProvider share the same client so token
// refreshes propagate everywhere and sessions never go stale.
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

  browserClient = createBrowserClient(url, key, {
    global: {
      fetch: (input, init) => {
        // Create our own abort controller for the strict timeout
        const controller = new AbortController()
        const timeout = setTimeout(() => {
          controller.abort(new Error('Timeout de requisição Supabase excedido'))
        }, QUERY_TIMEOUT_MS)

        // Merge with caller's signal if one exists (Supabase always provides one)
        const signal = init?.signal
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeout)
            controller.abort(signal.reason)
          }, { once: true })
          
          if (signal.aborted) {
            clearTimeout(timeout)
            controller.abort(signal.reason)
          }
        }

        return globalThis.fetch(input, {
          ...init,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout))
      },
    },
  })

  return browserClient
}
