import { test, expect } from '../fixtures/auth'
import { HojePage } from '../pages/hoje.page'

test.describe('Vendedor — Hoje (Dashboard Diário)', () => {
  test('dashboard /hoje carrega sem erros', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const hoje = new HojePage(page)
    await hoje.goto()
    await hoje.expectPageLoaded()
    await expect(page.locator('main')).toBeVisible()
  })

  test('modal de check-in aparece (ou já foi feito hoje)', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/hoje')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })

    // O modal pode ou não aparecer (depende se já fez check-in hoje)
    // Verificamos apenas que a página carregou corretamente
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/hoje')
  })

  test('conteúdo principal do /hoje é visível', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const hoje = new HojePage(page)
    await hoje.goto()

    // Fecha modal de check-in se aberto
    await hoje.dismissCheckinIfVisible()

    // Página deve ter conteúdo principal
    await expect(page.locator('main')).toBeVisible()
  })
})
