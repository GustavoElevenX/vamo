import { test, expect } from '../fixtures/auth'

test.describe('Vendedor — Autenticação', () => {
  test('após login, vendedor é redirecionado para /hoje', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL((url) => url.pathname.startsWith('/hoje'), {
      timeout: 20_000,
    })
    expect(page.url()).toContain('/hoje')
  })

  test('vendedor não pode acessar /monitoramento (rota de gestor)', async ({ page }) => {
    await page.goto('/monitoramento')
    await page.waitForURL((url) => url.pathname.startsWith('/hoje'), {
      timeout: 15_000,
    })
    expect(page.url()).toContain('/hoje')
  })

  test('vendedor não pode acessar /diagnostico (rota de gestor)', async ({ page }) => {
    await page.goto('/diagnostico')
    await page.waitForURL((url) => url.pathname.startsWith('/hoje'), {
      timeout: 15_000,
    })
    expect(page.url()).toContain('/hoje')
  })

  test('vendedor não pode acessar /objetivos (rota de gestor)', async ({ page }) => {
    await page.goto('/objetivos/metas')
    await page.waitForURL((url) => url.pathname.startsWith('/hoje'), {
      timeout: 15_000,
    })
    expect(page.url()).toContain('/hoje')
  })

  test('vendedor não pode acessar /configuracao (rota de gestor)', async ({ page }) => {
    await page.goto('/configuracao/kpis')
    await page.waitForURL((url) => url.pathname.startsWith('/hoje'), {
      timeout: 15_000,
    })
    expect(page.url()).toContain('/hoje')
  })
})
