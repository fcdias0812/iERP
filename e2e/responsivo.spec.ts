import { expect, test } from '@playwright/test'
import { abrir, rolagemHorizontal } from './helpers'

/* Celular (375), tablet (768) e desktop (1280): sem rolagem horizontal; DataTable vira cards no celular. */

const LARGURAS = [375, 768, 1280]
const ROTAS = [
  '/',
  '/clientes',
  '/clientes/cli00001',
  '/clientes/cli00001?editar=true',
  '/transportadoras/tra00001',
  '/transportadoras?aberto=novo',
  '/motoristas?aberto=mot00001',
  '/veiculos?aberto=vei00001',
  '/ordens/lotes',
  '/ordens/agendamento',
  '/operacao/dashboard',
  '/admin/usuarios',
  '/admin/usuarios/usr00001',
  '/admin/usuarios?aberto=novo',
  '/perfil',
]

for (const largura of LARGURAS) {
  test.describe(`${largura}px`, () => {
    test.use({ viewport: { width: largura, height: 900 } })
    for (const rota of ROTAS) {
      test(rota, async ({ page }) => {
        await abrir(page, rota)
        expect(await rolagemHorizontal(page)).toBe(false)
      })
    }
  })
}

test.describe('DataTable no celular', () => {
  test.use({ viewport: { width: 375, height: 812 } })
  test('lista vira cards (sem tabela)', async ({ page }) => {
    await abrir(page, '/admin/usuarios')
    await expect(page.locator('main table')).toHaveCount(0)
    expect(await page.locator('main li').count()).toBeGreaterThan(5)
  })
})
