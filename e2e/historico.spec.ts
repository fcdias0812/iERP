import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Histórico do módulo (API simulada; lote de demonstração LOT-00001 com uma ocorrência de coleta
 * e o recebimento): cada módulo mostra só os seus eventos, com o lote e o cliente.
 */

test('Operação › Histórico: recebimento, sem a ocorrência de coleta', async ({ page }) => {
  await abrir(page, '/operacao/historico')
  const tabela = page.locator('main tbody')
  await expect(tabela).toContainText('Recebeu o lote')
  await expect(tabela).toContainText('LOT-00001')
  await expect(tabela).not.toContainText('Registrou ocorrência')
  await page.getByRole('button', { name: 'Tudo' }).click()
  await expect(page.getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'true')
  expect(await violacoes(page)).toEqual([])
})

test('Ordens › Histórico: agendamento e ocorrência de coleta; o lote abre no histórico dele', async ({
  page,
}) => {
  await abrir(page, '/ordens/historico')
  const tabela = page.locator('main tbody')
  await expect(tabela).toContainText('Registrou ocorrência')
  await expect(tabela).toContainText('Agendou o lote')
  await expect(tabela).not.toContainText('Recebeu o lote')
  await tabela.getByRole('link', { name: 'LOT-00001' }).first().click()
  await expect(page).toHaveURL(/\/ordens\/lotes\/ord00001\?aba=historico/)
})
