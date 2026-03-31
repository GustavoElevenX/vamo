import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') })

const BASE_URL = 'http://localhost:3000'

async function getAuthCookie(role: 'gestor' | 'vendedor'): Promise<string> {
  const fs = await import('fs')
  const statePath = path.resolve(__dirname, `../../.auth/${role}.json`)

  if (!fs.existsSync(statePath)) {
    return ''
  }

  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
  const cookies = state.cookies ?? []
  return cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join('; ')
}

const AI_ENDPOINTS = [
  { path: '/api/ai/generate-missions', method: 'POST', body: {} },
  { path: '/api/ai/briefing-semanal', method: 'POST', body: {} },
  { path: '/api/ai/retrospectiva', method: 'POST', body: {} },
]

test.describe('API — Endpoints de IA (proteção)', () => {
  for (const endpoint of AI_ENDPOINTS) {
    test(`${endpoint.method} ${endpoint.path} sem auth retorna 401`, async ({ request }) => {
      const res = await request.fetch(`${BASE_URL}${endpoint.path}`, {
        method: endpoint.method,
        data: endpoint.body,
      })
      expect([401, 403]).toContain(res.status())
    })
  }

  test('POST /api/ai/generate-missions com auth do gestor responde', async ({ request }) => {
    const cookie = await getAuthCookie('gestor')
    if (!cookie) {
      test.skip()
      return
    }

    const res = await request.post(`${BASE_URL}/api/ai/generate-missions`, {
      headers: { Cookie: cookie },
      data: { seller_id: 'test', context: 'QA test' },
    })

    // 200 = sucesso, 503 = sem API key, 400/422 = validação
    expect([200, 201, 400, 422, 503]).toContain(res.status())
  })

  test('POST /api/diagnostics/save sem auth retorna 401', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/diagnostics/save`, {
      data: {},
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/team/invite sem auth retorna 401', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/team/invite`, {
      data: { email: 'test@test.com', role: 'seller' },
    })
    expect([401, 403]).toContain(res.status())
  })
})
