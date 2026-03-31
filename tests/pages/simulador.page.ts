import { Page, expect } from '@playwright/test'

export class SimuladorPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/simulador')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async expectPageLoaded() {
    await expect(this.page.locator('main')).toBeVisible({ timeout: 10_000 })
    await expect(this.page).not.toHaveURL(/\/monitoramento/)
  }
}
