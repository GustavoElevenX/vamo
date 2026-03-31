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

test.describe('API — Gamificação', () => {
  test('GET /api/gamification/leaderboard sem auth retorna 401', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/gamification/leaderboard`)
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/gamification/leaderboard com auth retorna array', async ({ request }) => {
    const cookie = await getAuthCookie('gestor')
    if (!cookie) {
      test.skip()
      return
    }

    const res = await request.get(`${BASE_URL}/api/gamification/leaderboard`, {
      headers: { Cookie: cookie },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('POST /api/gamification/award-xp sem auth retorna 401', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/gamification/award-xp`, {
      data: { user_id: 'test', amount: 100, source_type: 'bonus' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/gamification/check-badges sem auth retorna 401', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/gamification/check-badges`, {
      data: {},
    })
    expect([401, 403]).toContain(res.status())
  })
})
