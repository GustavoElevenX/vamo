import { Page, expect } from '@playwright/test'

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login')
    await this.page.waitForSelector('input[type="email"]', { timeout: 15_000 })
  }

  async login(email: string, password: string) {
    await this.page.fill('input[type="email"]', email)
    await this.page.fill('input[type="password"]', password)
    await this.page.click('button[type="submit"]')
  }

  async expectError() {
    await expect(
      this.page.getByText('Email ou senha inválidos.')
    ).toBeVisible({ timeout: 8_000 })
  }

  async waitForRedirect(expectedPath: string) {
    await this.page.waitForURL(
      (url) => url.pathname.startsWith(expectedPath),
      { timeout: 20_000 }
    )
  }
}
