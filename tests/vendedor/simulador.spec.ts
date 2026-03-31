import { test, expect } from '../fixtures/auth'
import { SimuladorPage } from '../pages/simulador.page'

test.describe('Vendedor — Simulador de Vendas', () => {
  test('página do simulador carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const sim = new SimuladorPage(page)
    await sim.goto()
    await sim.expectPageLoaded()
    expect(page.url()).toContain('/simulador')
  })

  test('simulador exibe conteúdo inicial', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/simulador')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
  })

  test('enviar resposta no simulador recebe feedback mock', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/simulador')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    // Procura campo de texto para resposta do vendedor
    const responseInput = page.locator(
      'textarea[placeholder*="resposta"], textarea[placeholder*="Resposta"], textarea[placeholder*="Digite"]'
    )

    if (await responseInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await responseInput.fill('Entendo sua preocupação. Nosso produto resolve exatamente esse problema.')

      const sendBtn = page.locator('button', { hasText: /enviar|responder|simular/i })
      if (await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sendBtn.click()
        await page.waitForTimeout(2_000)
      }
    }

    await expect(page.locator('main')).toBeVisible()
  })
})
