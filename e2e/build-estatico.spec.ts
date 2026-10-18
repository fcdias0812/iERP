import { expect, test } from '@playwright/test'
import { abrir } from './helpers'

/*
 * O build é estático e não depende de nada de fora: nenhuma requisição sai do localhost
 * (fontes, ícones, imagens e a API simulada estão no próprio pacote).
 */
test('nenhuma requisição para fora do servidor', async ({ page }) => {
  const externas: string[] = []
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => {
    externas.push(route.request().url())
    return route.abort()
  })
  for (const rota of ['/', '/admin/usuarios', '/admin/usuarios/usr00001']) {
    await abrir(page, rota)
  }
  // Troca para chinês: carrega a fonte Noto Sans TC (local).
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('reteck-ui') ?? '{"state":{},"version":1}')
    s.state.language = 'zh-TW'
    localStorage.setItem('reteck-ui', JSON.stringify(s))
  })
  await abrir(page, '/')
  expect(externas).toEqual([])
})
