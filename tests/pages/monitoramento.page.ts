import { Page, expect } from '@playwright/test'

export class MonitoramentoPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/monitoramento')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async gotoEquipe() {
    await this.page.goto('/monitoramento/equipe')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async gotoSaudeEquipe() {
    await this.page.goto('/monitoramento/saude-equipe')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async gotoAlertas() {
    await this.page.goto('/monitoramento/alertas')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async gotoRoi() {
    await this.page.goto('/monitoramento/roi')
    await this.page.waitForLoadState('networkidle', { timeout: 20_000 })
  }

  async expectPageLoaded() {
    // A página não deve mostrar erro de acesso negado
    await expect(this.page).not.toHaveURL(/\/hoje/)
    await expect(this.page.locator('main')).toBeVisible({ timeout: 10_000 })
  }
}
