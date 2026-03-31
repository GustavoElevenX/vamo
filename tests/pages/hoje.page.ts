import { Page, expect } from '@playwright/test'

export class HojePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/hoje')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async expectPageLoaded() {
    await expect(this.page).not.toHaveURL(/\/monitoramento/)
    await expect(this.page.locator('main')).toBeVisible({ timeout: 10_000 })
  }

  /** Fecha o modal de check-in se estiver visível */
  async dismissCheckinIfVisible() {
    const modal = this.page.locator('[role="dialog"]')
    if (await modal.isVisible()) {
      // Seleciona energia nível 3 se disponível
      const energyOption = this.page.locator('[data-energy="3"]')
      if (await energyOption.isVisible()) {
        await energyOption.click()
      }
      // Preenche intenção
      const intentionField = this.page.locator('textarea[name="intention"], input[name="intention"]')
      if (await intentionField.isVisible()) {
        await intentionField.fill('Focar em follow-up')
      }
      // Submete
      const submitBtn = modal.locator('button[type="submit"]')
      if (await submitBtn.isVisible()) {
        await submitBtn.click()
        await this.page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})
      }
    }
  }
}
