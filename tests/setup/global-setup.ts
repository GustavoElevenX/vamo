import { chromium, FullConfig } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test.local') })

const BASE_URL = 'http://localhost:3000'

async function waitForServer(maxWaitMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE_URL}/login`)
      if (res.ok || res.status === 200) return
    } catch {
      // servidor ainda não está pronto
    }
    await new Promise((r) => setTimeout(r, 1_000))
  }
  throw new Error(`[QA Setup] Servidor não respondeu em ${maxWaitMs}ms. Inicie o dev server com: npm run dev`)
}

async function loginAndSaveSession(
  email: string,
  password: string,
  outputPath: string,
  label: string
) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    console.log(`\n[QA Setup] Fazendo login como ${label} (${email})...`)

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Aguarda o formulário ficar interativo
    await page.waitForSelector('#email', { state: 'visible', timeout: 15_000 })
    await page.waitForSelector('#password', { state: 'visible', timeout: 5_000 })

    await page.fill('#email', email)
    await page.fill('#password', password)

    // Aguarda o botão e clica
    const submitBtn = page.locator('button[type="submit"]')
    await submitBtn.waitFor({ state: 'visible', timeout: 5_000 })
    await submitBtn.click()

    // Aguarda sair da página de login
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 25_000,
      })
    } catch {
      // Verifica se há mensagem de erro (credenciais inválidas)
      const errorText = await page.locator('.text-destructive, [class*="destructive"]').textContent().catch(() => '')
      const pageContent = await page.content().catch(() => '')

      // Salva screenshot de debug
      const screenshotDir = path.resolve(__dirname, '../../.auth')
      fs.mkdirSync(screenshotDir, { recursive: true })
      await page.screenshot({ path: path.join(screenshotDir, `debug-${label}.png`) })

      if (errorText?.includes('inválidos') || errorText?.includes('invalid')) {
        throw new Error(
          `[QA Setup] Credenciais inválidas para ${label} (${email}).\n` +
          `Execute o SQL seed: supabase/seeds/test_users.sql`
        )
      }

      throw new Error(
        `[QA Setup] Login de ${label} travou na página /login.\n` +
        `Screenshot salvo em .auth/debug-${label}.png\n` +
        `Verifique se o dev server está rodando e as credenciais estão corretas.`
      )
    }

    // Aguarda a página carregar completamente (auth context hidratado)
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Garante diretório .auth
    const authDir = path.dirname(outputPath)
    fs.mkdirSync(authDir, { recursive: true })

    await context.storageState({ path: outputPath })
    console.log(`[QA Setup] ✓ Sessão salva: ${path.basename(outputPath)} (URL atual: ${page.url()})`)
  } finally {
    await browser.close()
  }
}

export default async function globalSetup(_config: FullConfig) {
  const gestorEmail = process.env.TEST_GESTOR_EMAIL
  const gestorPassword = process.env.TEST_GESTOR_PASSWORD
  const vendedorEmail = process.env.TEST_VENDEDOR_EMAIL
  const vendedorPassword = process.env.TEST_VENDEDOR_PASSWORD

  if (!gestorEmail || !gestorPassword || !vendedorEmail || !vendedorPassword) {
    throw new Error(
      `[QA Setup] Credenciais de teste não encontradas.\n` +
      `Crie o arquivo .env.test.local com:\n` +
      `  TEST_GESTOR_EMAIL=...\n` +
      `  TEST_GESTOR_PASSWORD=...\n` +
      `  TEST_VENDEDOR_EMAIL=...\n` +
      `  TEST_VENDEDOR_PASSWORD=...`
    )
  }

  const authDir = path.resolve(__dirname, '../../.auth')
  fs.mkdirSync(authDir, { recursive: true })

  // Aguarda dev server estar pronto
  console.log('\n[QA Setup] Aguardando dev server...')
  await waitForServer()
  console.log('[QA Setup] ✓ Dev server pronto.')

  await loginAndSaveSession(
    gestorEmail, gestorPassword,
    path.join(authDir, 'gestor.json'),
    'Gestor'
  )

  await loginAndSaveSession(
    vendedorEmail, vendedorPassword,
    path.join(authDir, 'vendedor.json'),
    'Vendedor'
  )

  console.log('\n[QA Setup] ✓ Sessões criadas. Iniciando testes...\n')
}
