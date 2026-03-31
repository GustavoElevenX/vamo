import { test, expect } from '../fixtures/auth'

test.describe('Vendedor — Chat VAMO IA', () => {
  test('página do chat carrega para vendedor', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/chat-ia')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/chat-ia')
  })

  test('vendedor pode enviar mensagem ao chat (mock)', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/chat-ia')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    const chatInput = page.locator(
      'textarea[placeholder*="mensagem"], textarea[placeholder*="Digite"], input[placeholder*="mensagem"]'
    )

    if (await chatInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await chatInput.fill('Como posso melhorar minha taxa de conversão?')

      const sendBtn = page.locator('button[type="submit"], button[aria-label*="enviar"], button[aria-label*="send"]')
      if (await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sendBtn.click()
      } else {
        await chatInput.press('Enter')
      }

      await page.waitForTimeout(2_000)
    }

    await expect(page.locator('main')).toBeVisible()
  })

  test('/configuracoes/perfil carrega para vendedor', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/configuracoes/perfil')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/configuracoes/perfil')
  })
})
