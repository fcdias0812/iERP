import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/* Novidades da barra do topo: avisa a versão nova, mostra as atualizações e apaga o aviso. */

test('Novidades: aviso da versão nova, lista das atualizações e o aviso some depois de ver', async ({
  page,
}) => {
  await abrir(page, '/')
  await page.getByRole('button', { name: 'Novidades (versão nova)' }).click()
  const janela = page.getByRole('dialog', { name: 'Novidades' })
  await expect(janela.getByRole('heading', { name: /Versão 2\.4/ })).toBeVisible()
  await expect(janela.getByRole('heading', { name: /Versão 2\.0/ })).toBeVisible()
  await expect(janela).toContainText('Vários caminhões no mesmo lote')
  expect(await violacoes(page)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Novidades', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Novidades (versão nova)' })).toHaveCount(0)
})
