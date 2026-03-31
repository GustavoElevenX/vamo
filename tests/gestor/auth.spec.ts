import { test, expect } from '../fixtures/auth'
import { LoginPage } from '../pages/login.page'

test.describe('Gestor — Autenticação', () => {
  test('login com credenciais erradas mostra erro', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('errado@email.com', 'senhaerrada')
    await login.expectError()
  })

  test('após login, gestor é redirecionado para /monitoramento', async ({ page }) => {
    // storageState já está autenticado — basta navegar para /dashboard
    await page.goto('/dashboard')
    await page.waitForURL((url) => url.pathname.startsWith('/monitoramento'), {
      timeout: 20_000,
    })
    expect(page.url()).toContain('/monitoramento')
  })

  test('gestor não pode acessar /hoje (rota de vendedor)', async ({ page }) => {
    await page.goto('/hoje')
    // Deve ser redirecionado de volta ao home do gestor
    await page.waitForURL((url) => url.pathname.startsWith('/monitoramento'), {
      timeout: 15_000,
    })
    expect(page.url()).toContain('/monitoramento')
  })

  test('gestor não pode acessar /performance (rota de vendedor)', async ({ page }) => {
    await page.goto('/performance')
    await page.waitForURL((url) => url.pathname.startsWith('/monitoramento'), {
      timeout: 15_000,
    })
    expect(page.url()).toContain('/monitoramento')
  })

  test('gestor não pode acessar /ganhos (rota de vendedor)', async ({ page }) => {
    await page.goto('/ganhos/comissao')
    await page.waitForURL((url) => url.pathname.startsWith('/monitoramento'), {
      timeout: 15_000,
    })
    expect(page.url()).toContain('/monitoramento')
  })
})
