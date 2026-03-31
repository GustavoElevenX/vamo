import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') })

const BASE_URL = 'http://localhost:3000'

// Obtém cookie de autenticação do storage state salvo pelo global-setup
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

test.describe('API — Check-in Diário', () => {
  test('POST /api/checkin sem auth retorna 401', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/checkin`, {
      data: { energy_level: 3, intention: 'Teste', obstacle: '' },
    })
    // Sem cookie de auth, deve retornar 401
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/checkin com auth do vendedor retorna 200 ou 409', async ({ request }) => {
    const cookie = await getAuthCookie('vendedor')
    if (!cookie) {
      test.skip()
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const res = await request.post(`${BASE_URL}/api/checkin`, {
      headers: { Cookie: cookie },
      data: {
        energy_level: 4,
        intention: 'Focar nas propostas do dia',
        obstacle: 'Reuniões excessivas',
        checkin_date: today,
      },
    })

    // 200 = primeiro check-in do dia, 409 = já fez hoje
    expect([200, 201, 409]).toContain(res.status())
  })

  test('POST /api/checkin com energy_level inválido retorna 400', async ({ request }) => {
    const cookie = await getAuthCookie('vendedor')
    if (!cookie) {
      test.skip()
      return
    }

    const res = await request.post(`${BASE_URL}/api/checkin`, {
      headers: { Cookie: cookie },
      data: { energy_level: 99, intention: '', obstacle: '' },
    })

    expect([400, 422]).toContain(res.status())
  })
})
