import { defineConfig } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.test.local') })

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ['html', { outputFolder: 'qa-report', open: 'never' }],
    ['json', { outputFile: 'qa-report/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  globalSetup: './tests/setup/global-setup.ts',
  projects: [
    {
      name: 'gestor',
      testDir: './tests/gestor',
      use: { storageState: '.auth/gestor.json' },
    },
    {
      name: 'vendedor',
      testDir: './tests/vendedor',
      use: { storageState: '.auth/vendedor.json' },
    },
    {
      name: 'api',
      testDir: './tests/api',
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
