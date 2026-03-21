const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT_MS = 30000

// Models tried in order until one succeeds
const MODEL_CHAIN = [
  'openrouter/free',
  'stepfun/step-3.5-flash:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
]

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenRouterParams {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  model?: string
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not configured')
  return key
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function callApi(
  messages: OpenRouterMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const response = await fetchWithTimeout(
    OPENROUTER_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
        'HTTP-Referer': 'https://gamificacaoia.netlify.app',
        'X-Title': 'MOTIVA',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    },
    TIMEOUT_MS,
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const msg = data.choices?.[0]?.message
  // Some free models return text in `reasoning` instead of `content`
  const content = (msg?.content as string) || (msg?.reasoning as string) || ''
  if (!content.trim()) throw new Error('Empty response from OpenRouter')
  return content
}

export async function callOpenRouter(params: OpenRouterParams): Promise<string> {
  const { systemPrompt, userPrompt, temperature = 0.4, maxTokens = 1200, model } = params

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  // If a specific model was requested, try it with one retry
  if (model) {
    try {
      return await callApi(messages, model, temperature, maxTokens)
    } catch {
      await new Promise((r) => setTimeout(r, 2000))
      return await callApi(messages, model, temperature, maxTokens)
    }
  }

  // Otherwise walk the model chain until one succeeds
  let lastError: Error = new Error('All models failed')
  for (const m of MODEL_CHAIN) {
    try {
      return await callApi(messages, m, temperature, maxTokens)
    } catch (err: any) {
      lastError = err
      // Short wait between model attempts to avoid hammering
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  throw lastError
}

function extractAndCleanJson(raw: string): string {
  let s = raw.trim()

  // Strip markdown code fences
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    s = fenceMatch[1].trim()
  } else if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  // Extract first JSON object or array
  const objMatch = s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (objMatch) s = objMatch[1]

  return s
}

function repairTruncatedJson(s: string): string {
  // Count unclosed brackets/braces and close them
  const stack: string[] = []
  let inString = false
  let escape = false

  for (const ch of s) {
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }

  // Remove trailing incomplete value (comma or partial key)
  let repaired = s.trimEnd().replace(/,\s*$/, '')

  // Close all open structures
  while (stack.length > 0) {
    repaired += stack.pop()
  }

  return repaired
}

export async function callOpenRouterJSON<T>(params: OpenRouterParams): Promise<{ data: T; model: string }> {
  const rawContent = await callOpenRouter(params)
  const jsonStr = extractAndCleanJson(rawContent)

  // Try parsing as-is
  try {
    return { data: JSON.parse(jsonStr) as T, model: params.model || MODEL_CHAIN[0] }
  } catch {
    // Try repairing truncated JSON before retrying the API
    try {
      const repaired = repairTruncatedJson(jsonStr)
      return { data: JSON.parse(repaired) as T, model: params.model || MODEL_CHAIN[0] }
    } catch {
      // Fall through to API retry
    }
  }

  // Retry with explicit JSON-only instruction
  const retryContent = await callOpenRouter({
    ...params,
    systemPrompt:
      params.systemPrompt +
      '\n\nIMPORTANTE: Sua resposta deve conter APENAS o objeto JSON válido e completo. Nenhum texto antes ou depois. Nenhum markdown.',
  })
  const retryStr = extractAndCleanJson(retryContent)

  try {
    return { data: JSON.parse(retryStr) as T, model: params.model || MODEL_CHAIN[0] }
  } catch {
    const repaired = repairTruncatedJson(retryStr)
    return { data: JSON.parse(repaired) as T, model: params.model || MODEL_CHAIN[0] }
  }
}

export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}
