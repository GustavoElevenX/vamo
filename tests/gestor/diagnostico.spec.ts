import { test, expect } from '../fixtures/auth'
import { DiagnosticoPage } from '../pages/diagnostico.page'

test.describe('Gestor — Diagnóstico', () => {
  test('lista de diagnósticos carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const diag = new DiagnosticoPage(page)
    await diag.goto()
    await diag.expectPageLoaded()
    expect(page.url()).toContain('/diagnostico')
  })

  test('página novo diagnóstico carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const diag = new DiagnosticoPage(page)
    await diag.gotoNovo()
    await diag.expectPageLoaded()
    expect(page.url()).toContain('/diagnostico/novo')
  })

  test('diagnóstico individual carrega', async ({ pageWithMocks }) => {
    const page = pageWithMocks
    const diag = new DiagnosticoPage(page)
    await diag.gotoIndividual()
    await diag.expectPageLoaded()
    expect(page.url()).toContain('/diagnostico/individual')
  })
})
