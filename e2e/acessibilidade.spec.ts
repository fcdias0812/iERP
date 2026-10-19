import { expect, test } from '@playwright/test'
import { abrir, preferencias, violacoes, type Idioma, type Tema } from './helpers'

/*
 * WCAG 2.2 AA (axe-core) nas telas principais: todas no tema claro em pt-BR e uma amostra de cada
 * padrão de página no tema escuro e nos outros idiomas.
 */

const TODAS = [
  '/',
  '/clientes',
  '/clientes/cli00001',
  '/clientes/cli00001?aba=contatos',
  '/clientes/cli00001?aba=logistica',
  '/clientes/cli00001?aba=documentos',
  '/clientes/cli00001?aba=historico',
  '/clientes/cli00001?editar=true',
  '/clientes?aberto=novo',
  '/transportadoras',
  '/transportadoras/tra00001',
  '/transportadoras/tra00001?aba=contatos',
  '/transportadoras/tra00001?aba=motoristas',
  '/transportadoras/tra00001?aba=historico',
  '/transportadoras/tra00001?editar=true',
  '/transportadoras?aberto=novo',
  '/motoristas',
  '/motoristas?aberto=mot00001',
  '/motoristas?aberto=novo',
  '/veiculos',
  '/veiculos?aberto=vei00001',
  '/veiculos?aberto=novo',
  '/ordens/lotes',
  '/ordens/lotes/ord00001',
  '/ordens/agendamento',
  '/operacao/dashboard',
  '/operacao/lotes',
  '/operacao/recebimento',
  '/ordens/historico',
  '/cadastros/materiais',
  '/cadastros/pallets',
  '/cadastros/caixotes?aberto=novo',
  '/cadastros/areas?aberto=novo',
  '/cadastros/materiais?aberto=novo',
  '/cadastros/rastreadores',
  '/operacao/historico',
  '/ordens/viagens',
  '/operacao/recebimento?aberto=novo',
  '/operacao/recebimento?visao=recebidos',
  '/operacao/lotes/ord00001?receber=true',
  '/operacao/lotes/ord00001?aba=progresso',
  '/operacao/lotes/ord00001?aba=ocorrencias',
  '/operacao/lotes/ord00001?aba=ocorrencias&ocorrencia=oco00001',
  '/operacao/lotes/ord00001?aba=documentos',
  '/operacao/lotes/ord00001?aba=historico',
  // Operação: ainda "em construção" (menu já montado).
  '/estoque/materiais',
  '/admin/usuarios',
  '/admin/usuarios/usr00001',
  '/admin/usuarios/usr00001?editar=true',
  '/admin/usuarios?aberto=novo',
  '/perfil',
  '/configuracoes',
  '/login',
]

const AMOSTRA = [
  '/',
  '/clientes',
  '/clientes/cli00001',
  '/clientes/cli00001?editar=true',
  '/transportadoras/tra00001',
  '/transportadoras/tra00001?editar=true',
  '/motoristas?aberto=mot00001',
  '/veiculos',
  '/ordens/agendamento',
  '/operacao/dashboard',
  '/operacao/lotes/ord00001',
  '/operacao/lotes/ord00001?aba=progresso',
  '/operacao/recebimento?aberto=novo',
  '/operacao/historico',
  '/cadastros/materiais',
  '/cadastros/pallets',
  '/admin/usuarios',
  '/admin/usuarios/usr00001',
]

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
