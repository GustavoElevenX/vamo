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

export async function callOpenRouterJSON<T>(params: OpenRouterParams): Promise<{ data: T; model: string }> {
  const rawContent = await callOpenRouter(params)

  // Strip markdown code fences if present
  let jsonStr = rawContent.trim()
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  // Extract JSON object/array if there's surrounding text
  const objMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (objMatch) jsonStr = objMatch[1]

  try {
    return { data: JSON.parse(jsonStr) as T, model: params.model || MODEL_CHAIN[0] }
  } catch {
    // Retry with explicit JSON-only instruction
    const retryContent = await callOpenRouter({
      ...params,
      systemPrompt:
        params.systemPrompt +
        '\n\nIMPORTANTE: Sua resposta deve conter APENAS o objeto JSON. Nenhum texto antes ou depois. Nenhum markdown.',
    })
    let retryStr = retryContent.trim()
    const retryFence = retryStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (retryFence) {
      retryStr = retryFence[1].trim()
    }
    const retryObj = retryStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (retryObj) retryStr = retryObj[1]
    return { data: JSON.parse(retryStr) as T, model: params.model || MODEL_CHAIN[0] }
  }
}

export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}
