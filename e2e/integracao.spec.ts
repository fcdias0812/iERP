import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Administração › Integração (API simulada: o MoonShot cadastrado, sem chave). A chave aparece
 * UMA vez, ao gerar; trocar pede confirmação.
 */

test('gera a chave do MoonShot (aparece uma vez) e mostra só o começo depois', async ({ page }) => {
  await abrir(page, '/admin/integracao')
  const linha = page.locator('main tbody tr', { hasText: 'MoonShot (Dell)' })
  await expect(linha).toContainText('Sem chave')
  await linha.click()
  const painel = page.getByRole('dialog')
  await expect(painel).toContainText('Avisos (iERP → sistema)')
  await painel.getByRole('button', { name: 'Gerar chave' }).click()

  const chave = page.getByRole('dialog', { name: 'Chave gerada' })
  await expect(chave).toContainText(/rtk_[0-9a-f]{8}/)
  await expect(chave).toContainText('não aparece de novo')
  expect(await violacoes(page)).toEqual([])
  await chave.getByRole('button', { name: 'Já copiei' }).click()

  await expect(painel.getByRole('button', { name: 'Trocar chave' })).toBeVisible()
  await painel.getByRole('button', { name: 'Trocar chave' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('para de funcionar na hora')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
  await painel.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('main tbody tr', { hasText: 'MoonShot (Dell)' })).toContainText('rtk_')
})

test('token do painel curto é recusado na tela', async ({ page }) => {
  await abrir(page, '/admin/integracao?aberto=int00001')
  const painel = page.getByRole('dialog')
  await painel.getByLabel(/^Token do painel/).fill('curto')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(painel).toContainText('pelo menos 32 caracteres')
})
