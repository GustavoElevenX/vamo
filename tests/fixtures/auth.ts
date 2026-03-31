import { test as base, expect, Page } from '@playwright/test'
import { mockAIRoutes } from '../helpers/mock-ai'

type AuthFixtures = {
  /** Página com IA mockada (aplicado a todos os testes) */
  pageWithMocks: Page
}

export const test = base.extend<AuthFixtures>({
  pageWithMocks: async ({ page }, use) => {
    await mockAIRoutes(page)
    await use(page)
  },
})

export { expect }

/** Aguarda a página plataforma carregar (sidebar visível) */
export async function waitForPlatformLoad(page: Page) {
  // Aguarda algum elemento do layout principal aparecer
  await page.waitForLoadState('networkidle', { timeout: 20_000 })
}

/** Verifica se está na rota esperada (considera redirects) */
export async function expectRoute(page: Page, expectedPath: string) {
  await page.waitForURL((url) => url.pathname.startsWith(expectedPath), {
    timeout: 15_000,
  })
}
