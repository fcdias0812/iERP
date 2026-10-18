import { expect, test } from '@playwright/test'
import { abrir, preferencias, violacoes, type Idioma, type Tema } from './helpers'

/*
 * WCAG 2.2 AA (axe-core) nas telas principais: todas no tema claro em pt-BR e uma amostra de cada
 * padrão de página no tema escuro e nos outros idiomas.
 */

const TODAS = [
  '/',
  '/admin/usuarios',
  '/admin/usuarios/usr00001',
  '/admin/usuarios/usr00001/editar',
  '/admin/usuarios/novo',
  '/perfil',
  '/configuracoes',
  '/login',
]

const AMOSTRA = ['/', '/admin/usuarios', '/admin/usuarios/usr00001', '/admin/usuarios/novo']

const CENARIOS: { tema: Tema; idioma: Idioma; rotas: string[] }[] = [
  { tema: 'light', idioma: 'pt-BR', rotas: TODAS },
  { tema: 'dark', idioma: 'pt-BR', rotas: AMOSTRA },
  { tema: 'light', idioma: 'en', rotas: AMOSTRA },
  { tema: 'dark', idioma: 'zh-TW', rotas: AMOSTRA },
]

for (const { tema, idioma, rotas } of CENARIOS) {
  test.describe(`acessibilidade — ${tema}, ${idioma}`, () => {
    test.beforeEach(async ({ page }) => preferencias(page, { theme: tema, language: idioma }))

    for (const rota of rotas) {
      test(rota, async ({ page }) => {
        // /login: a sessão de demonstração já entra autenticada; sair leva ao login.
        if (rota === '/login')
          await page.addInitScript(() =>
            localStorage.setItem(
              'reteck-session',
              JSON.stringify({ state: { status: 'signedOut' }, version: 1 }),
            ),
          )
        await abrir(page, rota)
        await expect(page.locator('html')).toHaveClass(tema === 'dark' ? /dark/ : /^(?!.*dark)/)
        await expect(page.locator('html')).toHaveAttribute('lang', idioma)
        expect(await violacoes(page)).toEqual([])
      })
    }
  })
}
