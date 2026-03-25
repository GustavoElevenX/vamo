// VAMO IA — Powered by OpenAI

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const TIMEOUT_MS = 30000
const DEFAULT_MODEL = 'gpt-4o-mini'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIParams {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  model?: string
}

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not configured')
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
  messages: OpenAIMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const response = await fetchWithTimeout(
    OPENAI_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
    },
    TIMEOUT_MS,
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const content = (data.choices?.[0]?.message?.content as string) || ''
  if (!content.trim()) throw new Error('Empty response from OpenAI')
  return content
}

export async function callOpenAI(params: OpenAIParams): Promise<string> {
  const { systemPrompt, userPrompt, temperature = 0.4, maxTokens = 1200, model = DEFAULT_MODEL } = params

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  try {
    return await callApi(messages, model, temperature, maxTokens)
  } catch {
    // One retry on failure
    await new Promise((r) => setTimeout(r, 2000))
    return await callApi(messages, model, temperature, maxTokens)
  }
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

  let repaired = s.trimEnd().replace(/,\s*$/, '')
  while (stack.length > 0) {
    repaired += stack.pop()
  }

  return repaired
}

export async function callOpenAIJSON<T>(params: OpenAIParams): Promise<{ data: T; model: string }> {
  const model = params.model || DEFAULT_MODEL
  const rawContent = await callOpenAI(params)
  const jsonStr = extractAndCleanJson(rawContent)

  try {
    return { data: JSON.parse(jsonStr) as T, model }
  } catch {
    try {
      const repaired = repairTruncatedJson(jsonStr)
      return { data: JSON.parse(repaired) as T, model }
    } catch {
      // Fall through to retry
    }
  }

  // Retry with explicit JSON-only instruction
  const retryContent = await callOpenAI({
    ...params,
    systemPrompt:
      params.systemPrompt +
      '\n\nIMPORTANTE: Sua resposta deve conter APENAS o objeto JSON válido e completo. Nenhum texto antes ou depois. Nenhum markdown.',
  })
  const retryStr = extractAndCleanJson(retryContent)

  try {
    return { data: JSON.parse(retryStr) as T, model }
  } catch {
    const repaired = repairTruncatedJson(retryStr)
    return { data: JSON.parse(repaired) as T, model }
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}
