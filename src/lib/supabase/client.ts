import { createBrowserClient } from '@supabase/ssr'

const QUERY_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2
const RETRY_BASE_MS = 1_000

// Singleton — all pages & AuthProvider share the same client so token
// refreshes propagate everywhere and sessions never go stale.
let browserClient: ReturnType<typeof createBrowserClient> | null = null

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  retriesLeft: number = MAX_RETRIES
): Promise<Response> {
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

  try {
    const res = await globalThis.fetch(input, {
      ...init,
      signal: controller.signal,
    })

    // Retry on 5xx or 429 (rate limit)
    if (retriesLeft > 0 && (res.status >= 500 || res.status === 429)) {
      const delay = RETRY_BASE_MS * (MAX_RETRIES - retriesLeft + 1)
      await new Promise((r) => setTimeout(r, delay))
      return fetchWithRetry(input, init, retriesLeft - 1)
    }

    return res
  } catch (err) {
    // Retry on network errors / timeouts (but not if user aborted)
    if (retriesLeft > 0 && !signal?.aborted) {
      const delay = RETRY_BASE_MS * (MAX_RETRIES - retriesLeft + 1)
      await new Promise((r) => setTimeout(r, delay))
      return fetchWithRetry(input, init, retriesLeft - 1)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

  browserClient = createBrowserClient(url, key, {
    global: {
      fetch: (input, init) => {
        // Auth calls (token refresh, sign-in, etc.) must NOT be subject to
        // the short query timeout — they can take longer and killing them
        // causes the "black screen" / stuck-loading bug on session restore.
        const reqUrl = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url
        if (reqUrl.includes('/auth/')) {
          return globalThis.fetch(input, init)
        }

        return fetchWithRetry(input, init)
      },
    },
  })

  return browserClient
}
