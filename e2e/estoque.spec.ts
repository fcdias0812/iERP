import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Estoque (API simulada): Materiais ← armazém, Assets e Peças ← Controle de Notebooks, E-commerce
 * ← RTB WMS (sem cadastro na simulação). Só para ver: lista, "Atualizar", "Abrir no sistema".
 */

test('Materiais: os paletes do armazém, com o estado no idioma da tela', async ({ page }) => {
  await abrir(page, '/estoque/materiais')
  await expect(page.locator('main h1')).toHaveText('Materiais')
  const linha = page.locator('main tbody tr', { hasText: 'LOT-20261010-0001' })
  await expect(linha).toContainText('Funcionando')
  await expect(linha).toContainText('Vendável')
  await expect(page.locator('main tbody tr', { hasText: 'LOT-20261012-0003' })).toContainText(
    '~120',
  )
  await expect(page.getByRole('link', { name: /Abrir no Armazém/ })).toHaveAttribute(
    'href',
    'http://localhost:4000/',
  )
  await page.getByRole('button', { name: 'Atualizar' }).click()
  await expect(page.getByText(/Lido do Armazém/)).toBeVisible()
})

test('Assets e Peças: a mesma lista do Controle de Notebooks, dividida pelo tipo', async ({
  page,
}) => {
  await abrir(page, '/estoque/assets')
  await expect(page.locator('main tbody tr', { hasText: '5CG1234XYZ' })).toContainText(
    'Pronto para venda',
  )
  // Servidor fica em Assets ("Servidor será um sistema separado").
  await expect(page.locator('main tbody tr', { hasText: 'SRV-0001' })).toContainText('Servidor')
  await expect(page.locator('main tbody tr', { hasText: 'PCA-0099' })).toHaveCount(0)

  await abrir(page, '/estoque/pecas')
  await expect(page.locator('main tbody tr', { hasText: 'PCA-0099' })).toContainText('Recebido')
  await expect(page.locator('main tbody tr', { hasText: '5CG1234XYZ' })).toHaveCount(0)
})

test('E-commerce sem cadastro: a tela diz o que falta e leva à Integração', async ({ page }) => {
  await abrir(page, '/estoque/ecommerce')
  await expect(page.getByText('RTB WMS (e-commerce) não cadastrado')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir Integração' })).toBeVisible()
  expect(await violacoes(page)).toEqual([])
})

test('Integração: o armazém pede o endereço do sistema e a chave de integração', async ({
  page,
}) => {
  await abrir(page, '/admin/integracao?aberto=novo')
  const painel = page.getByRole('dialog')
  await painel.getByRole('combobox', { name: /Sistema/ }).click()
  await page.getByRole('option', { name: /ARMAZEM/ }).click()
  await expect(painel).toContainText('Estoque (sistema → iERP)')
  await expect(painel).not.toContainText('Avisos (iERP → sistema)')
  await painel.getByLabel(/^Endereço do sistema/).fill('http://192.168.0.10:4000')
  await painel.getByLabel(/^Chave de integração/).fill('sgi_chave')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.locator('main tbody tr', { hasText: 'ARMAZEM' })).toBeVisible()
})
