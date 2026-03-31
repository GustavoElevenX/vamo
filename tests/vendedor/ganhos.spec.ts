import { test, expect } from '../fixtures/auth'

test.describe('Vendedor — Ganhos', () => {
  test('/ganhos/comissao carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/ganhos/comissao')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/ganhos/comissao')
  })

  test('/ganhos/projecao carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/ganhos/projecao')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/ganhos/projecao')
  })
})
