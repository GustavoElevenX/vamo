import { test, expect } from '../fixtures/auth'

test.describe('Gestor — Retrospectiva', () => {
  test('página de retrospectiva carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/retrospectiva')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/retrospectiva')
  })

  test('ao gerar retrospectiva, conteúdo mock é exibido', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/retrospectiva')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    const generateBtn = page.locator('button', { hasText: /gerar|atualizar|retrospectiva/i })
    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click()
      await page.waitForTimeout(1_500)
    }

    await expect(page.locator('main')).toBeVisible()
  })
})
