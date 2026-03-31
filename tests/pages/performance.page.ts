import { Page, expect } from '@playwright/test'

export class PerformancePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/performance')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async gotoIndicadores() {
    await this.page.goto('/performance/indicadores')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async gotoMissoes() {
    await this.page.goto('/performance/missoes')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async expectPageLoaded() {
    await expect(this.page.locator('main')).toBeVisible({ timeout: 10_000 })
    await expect(this.page).not.toHaveURL(/\/monitoramento/)
  }
}
