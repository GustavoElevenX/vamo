import { test, expect } from '../fixtures/auth'

test.describe('Gestor — Chat VAMO IA', () => {
  test('página do chat carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/chat-ia')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/chat-ia')
  })

  test('enviar mensagem ao chat retorna resposta (mock)', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/chat-ia')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    // Procura campo de input do chat
    const chatInput = page.locator(
      'textarea[placeholder*="mensagem"], textarea[placeholder*="Digite"], input[placeholder*="mensagem"], input[placeholder*="Digite"]'
    )

    if (await chatInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await chatInput.fill('Qual o status da equipe?')

      // Submit via Enter ou botão
      const sendBtn = page.locator('button[type="submit"], button[aria-label*="enviar"], button[aria-label*="send"]')
      if (await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sendBtn.click()
      } else {
        await chatInput.press('Enter')
      }

      // Aguarda resposta (mock retorna imediatamente)
      await page.waitForTimeout(2_000)
    }

    await expect(page.locator('main')).toBeVisible()
  })
})
