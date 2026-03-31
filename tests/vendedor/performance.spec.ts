import { test, expect } from '../fixtures/auth'
import { PerformancePage } from '../pages/performance.page'

test.describe('Vendedor — Performance', () => {
  test('/performance carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const perf = new PerformancePage(page)
    await perf.goto()
    await perf.expectPageLoaded()
    expect(page.url()).toContain('/performance')
  })

  test('/performance/indicadores carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const perf = new PerformancePage(page)
    await perf.gotoIndicadores()
    await perf.expectPageLoaded()
    expect(page.url()).toContain('/performance/indicadores')
  })

  test('/performance/missoes carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const perf = new PerformancePage(page)
    await perf.gotoMissoes()
    await perf.expectPageLoaded()
    expect(page.url()).toContain('/performance/missoes')
  })
})
