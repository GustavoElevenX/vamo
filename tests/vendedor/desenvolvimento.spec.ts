import { test, expect } from '../fixtures/auth'

test.describe('Vendedor — Desenvolvimento', () => {
  test('/desenvolvimento/feedback-ia carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/desenvolvimento/feedback-ia')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/desenvolvimento/feedback-ia')
  })

  test('/desenvolvimento/conquistas carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/desenvolvimento/conquistas')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/desenvolvimento/conquistas')
  })

  test('/desenvolvimento/loja carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/desenvolvimento/loja')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/desenvolvimento/loja')
  })

  test('/feed carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/feed')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/feed')
  })
})
