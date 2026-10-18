import { defineConfig, devices } from '@playwright/test'

/*
 * Testes de ponta a ponta (e2e) com Playwright + axe-core.
 * Rodam contra o BUILD estático (vite preview) com a API SIMULADA ligada (VITE_USE_MOCKS=true):
 * testam as telas sem depender do backend. Primeira vez na máquina:
 * `npx playwright install chromium`.
 */
const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { VITE_USE_MOCKS: 'true' },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
