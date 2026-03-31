import { Page, expect } from '@playwright/test'

export class DiagnosticoPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/diagnostico')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async gotoNovo() {
    await this.page.goto('/diagnostico/novo')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async gotoIndividual() {
    await this.page.goto('/diagnostico/individual')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async expectPageLoaded() {
    await expect(this.page.locator('main')).toBeVisible({ timeout: 10_000 })
    await expect(this.page).not.toHaveURL(/\/hoje/)
  }
}
