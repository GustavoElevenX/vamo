import { test, expect } from '../fixtures/auth'

test.describe('Gestor — Objetivos', () => {
  test('/objetivos/metas carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/objetivos/metas')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/objetivos/metas')
  })

  test('/objetivos/plano-acao carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/objetivos/plano-acao')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/objetivos/plano-acao')
  })

  test('/objetivos/recompensas carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/objetivos/recompensas')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/objetivos/recompensas')
  })

  test('/objetivos/lancamento carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/objetivos/lancamento')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/objetivos/lancamento')
  })
})
