import { createBrowserClient } from '@supabase/ssr'

const QUERY_TIMEOUT_MS = 15_000

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

  return createBrowserClient(url, key, {
    global: {
      fetch: (input, init) => {
        // If caller already provided an AbortSignal, respect it
        if (init?.signal) {
          return globalThis.fetch(input, init)
        }

        // Otherwise, add a timeout so queries never hang forever
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)

        return globalThis.fetch(input, {
          ...init,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout))
      },
    },
  })
}
