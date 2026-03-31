import { test, expect } from '../fixtures/auth'
import { MonitoramentoPage } from '../pages/monitoramento.page'

test.describe('Gestor — Monitoramento', () => {
  test('dashboard principal carrega sem erros', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const mon = new MonitoramentoPage(page)
    await mon.goto()
    await mon.expectPageLoaded()
    await expect(page.locator('main')).toBeVisible()
  })

  test('/monitoramento/equipe carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const mon = new MonitoramentoPage(page)
    await mon.gotoEquipe()
    await mon.expectPageLoaded()
    expect(page.url()).toContain('/monitoramento/equipe')
  })

  test('/monitoramento/saude-equipe carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const mon = new MonitoramentoPage(page)
    await mon.gotoSaudeEquipe()
    await mon.expectPageLoaded()
    expect(page.url()).toContain('/monitoramento/saude-equipe')
  })

  test('/monitoramento/alertas carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const mon = new MonitoramentoPage(page)
    await mon.gotoAlertas()
    await mon.expectPageLoaded()
    expect(page.url()).toContain('/monitoramento/alertas')
  })

  test('/monitoramento/roi carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const mon = new MonitoramentoPage(page)
    await mon.gotoRoi()
    await mon.expectPageLoaded()
    expect(page.url()).toContain('/monitoramento/roi')
  })

  test('/monitoramento/comissionamento carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/monitoramento/comissionamento')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    expect(page.url()).toContain('/monitoramento/comissionamento')
    await expect(page.locator('main')).toBeVisible()
  })

  test('/monitoramento/funil carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    await page.goto('/monitoramento/funil')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    expect(page.url()).toContain('/monitoramento/funil')
    await expect(page.locator('main')).toBeVisible()
  })
})
