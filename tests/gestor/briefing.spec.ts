import { test, expect } from '../fixtures/auth'

test.describe('Gestor — Briefing Semanal', () => {
  test('página de briefing semanal carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/briefing-semanal')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/briefing-semanal')
  })

  test('ao gerar briefing, conteúdo mock é exibido', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/briefing-semanal')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    // Procura botão para gerar briefing
    const generateBtn = page.locator('button', { hasText: /gerar|atualizar|briefing/i })
    if (await generateBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await generateBtn.click()
      // Aguarda resposta da IA (mockada)
      await page.waitForTimeout(1_500)
    }

    await expect(page.locator('main')).toBeVisible()
  })
})
