import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Sistema › Cadastros (API simulada: 5 materiais de amostra, áreas DELL e SHREDDING, um caixote
 * CXT-20260001): abas, materiais nos 3 idiomas, área nova e caixote com código automático.
 */

test('menu Cadastros abre os itens; materiais no idioma da tela', async ({ page }) => {
  await abrir(page, '/')
  const menu = page.locator('aside')
  await menu.getByRole('button', { name: 'Cadastros' }).click()
  for (const item of ['Materiais', 'Pallets', 'Caixotes', 'Áreas do estoque', 'Rastreadores GPS'])
    await expect(menu.getByRole('link', { name: item })).toBeVisible()
  await menu.getByRole('link', { name: 'Materiais' }).click()
  await expect(page).toHaveURL(/\/cadastros\/materiais$/)
  await expect(page.locator('main tbody')).toContainText('Cobre')
  expect(await violacoes(page)).toEqual([])

  await menu.getByRole('link', { name: 'Rastreadores GPS' }).click()
  await expect(page.getByText('Aguardando a integração')).toBeVisible()
})

test('área nova (descrição opcional) e caixote com código automático', async ({ page }) => {
  await abrir(page, '/cadastros/areas')
  await page.getByRole('button', { name: 'Nova área' }).click()
  const painel = page.getByRole('dialog')
  await painel.getByLabel(/^Nome/).fill('ESTOQUE')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Área ESTOQUE cadastrada.')).toBeVisible()
  await expect(page.locator('main tbody tr', { hasText: 'ESTOQUE' })).toBeVisible()

  // Nome repetido aparece no próprio campo.
  await page.getByRole('button', { name: 'Nova área' }).click()
  await painel.getByLabel(/^Nome/).fill('dell')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(painel.getByText('Já existe um cadastro com este nome.')).toBeVisible()
  await painel.getByRole('button', { name: 'Cancelar' }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Sair|Descartar/ })
    .click()

  await page.locator('aside').getByRole('link', { name: 'Caixotes' }).click()
  await expect(page).toHaveURL(/\/cadastros\/caixotes$/)
  await page.getByRole('button', { name: 'Novo caixote' }).click()
  await expect(painel).toContainText('Novo caixote')
  await painel.getByRole('combobox', { name: /^Material/ }).click()
  await page.getByPlaceholder('Digite para buscar…').fill('vidro')
  await page.getByRole('option', { name: 'Vidro' }).click()
  await expect(painel.getByRole('combobox', { name: /^Material/ })).toHaveText(/Vidro/)
  await painel.getByLabel(/^Tara/).fill('12,5')
  await painel.getByRole('combobox', { name: /^Área/ }).click()
  await page.getByRole('option', { name: 'ESTOQUE' }).click()
  await painel.getByLabel(/^Posição/).fill('B-07')
  expect(await violacoes(page)).toEqual([])
  await painel.getByRole('button', { name: 'Salvar' }).click()

  const ano = new Date().getFullYear()
  await expect(page.getByText(`CXT-${ano}0002 cadastrado.`)).toBeVisible()
  const linha = page.locator('main tbody tr', { hasText: `CXT-${ano}0002` })
  await expect(linha).toContainText('Vidro')
  await expect(linha).toContainText('ESTOQUE')
  await expect(linha).toContainText('12,5 kg')
})
