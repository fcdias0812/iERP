import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export type Tema = 'light' | 'dark'
export type Idioma = 'pt-BR' | 'en' | 'zh-TW'

/** Preferências salvas antes de a página carregar (mesma chave da store `reteck-ui`). */
export async function preferencias(page: Page, prefs: { theme?: Tema; language?: Idioma }) {
  await page.addInitScript((p) => {
    localStorage.setItem('reteck-ui', JSON.stringify({ state: p, version: 1 }))
  }, prefs)
}

/** Abre a rota e espera a tela terminar de carregar (título + dados da API simulada). */
export async function abrir(page: Page, rota: string) {
  await page.goto(rota)
  await expect(page.locator('main h1').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  // Skeleton/aria-busy indicam que os dados ainda não chegaram.
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0)
  await expect(page.locator('main [data-slot="skeleton"]')).toHaveCount(0)
}

/** Regras WCAG 2.0, 2.1 e 2.2, níveis A e AA (tags do axe-core 4.14). */
export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Violações de acessibilidade na página, em texto curto (fácil de ler no relatório). */
export async function violacoes(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  return r.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  )
}

/** A página tem rolagem horizontal? */
export async function rolagemHorizontal(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}
