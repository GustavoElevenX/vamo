import { test, expect } from '../fixtures/auth'

test.describe('Gestor — Configuração', () => {
  test('/configuracao/kpis carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/configuracao/kpis')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/configuracao/kpis')
  })

  test('/configuracao/gamificacao carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/configuracao/gamificacao')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/configuracao/gamificacao')
  })

  test('/configuracao/regras-gatilhos carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/configuracao/regras-gatilhos')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/configuracao/regras-gatilhos')
  })

  test('/configuracao/integracoes carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/configuracao/integracoes')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/configuracao/integracoes')
  })

  test('/configuracoes/empresa carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/configuracoes/empresa')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/configuracoes/empresa')
  })

  test('/configuracoes/perfil carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/configuracoes/perfil')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await expect(page.locator('main')).toBeVisible()
    expect(page.url()).toContain('/configuracoes/perfil')
  })
})
