import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Ordens › Agendamento (API simulada): cliente → site → doca em cascata, serviços III e IV
 * já marcados, placas de policarbonato só com o IV, pré-cálculo e criação do lote.
 */

async function escolherCliente(page: import('@playwright/test').Page) {
  const nome = await page.evaluate(async () => {
    const r = await fetch('/api/clientes/cli00001')
    return ((await r.json()) as { nome: string }).nome
  })
  await page.getByRole('combobox', { name: /^Cliente/ }).click()
  await page.getByPlaceholder('Digite para buscar…').fill(nome.slice(0, 6))
  await page.getByRole('option', { name: nome }).click()
  return nome
}

test('cascata: site só depois do cliente; doca só depois do site', async ({ page }) => {
  await abrir(page, '/ordens/agendamento')
  await expect(page.getByRole('combobox', { name: /^Site/ })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: /^Doca/ })).toBeDisabled()
  await escolherCliente(page)
  await expect(page.getByRole('combobox', { name: /^Site/ })).toBeEnabled()
  await expect(page.getByRole('combobox', { name: /^Doca/ })).toBeDisabled()
  await page.getByRole('combobox', { name: /^Site/ }).click()
  await page.getByRole('option', { name: 'SPO-01' }).click()
  await expect(page.getByRole('combobox', { name: /^Doca/ })).toBeEnabled()
})

test('agendamento: pré-calcula e cria o lote agendado', async ({ page }) => {
  await abrir(page, '/ordens/agendamento')
  // III e IV vêm marcados; o IV pede as placas de policarbonato.
  await expect(page.getByRole('checkbox', { name: 'III. Recycle Only' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'IV. Value Recovery (Racks)' })).toBeChecked()
  await expect(page.getByLabel(/^Placas de policarbonato/)).toBeVisible()

  const nome = await escolherCliente(page)
  await page.getByRole('combobox', { name: /^Site/ }).click()
  await page.getByRole('option', { name: 'SPO-01' }).click()
  await page.getByRole('combobox', { name: /^Doca/ }).click()
  await page.getByRole('option', { name: 'Doca D1' }).click()
  // Data de coleta (obrigatória): hoje, no calendário.
  await page.getByLabel(/^Data de coleta/).click()
  await page.locator('[data-today] button').click()
  await page.getByLabel(/^Pallets$/).fill('6')
  await page.getByLabel(/^Gaylords$/).fill('2')
  await page.getByLabel(/^Racks$/).fill('3')
  await page.getByLabel(/^Placas de policarbonato/).fill('8')

  await page.getByRole('button', { name: 'Pré-calcular' }).first().click()
  const card = page.getByRole('region', { name: 'Pré-cálculo' })
  await expect(card).toContainText('11 volumes')
  await expect(card).toContainText('Truck')
  expect(await violacoes(page)).toEqual([])

  // Escopo obrigatório (texto ou arquivo).
  await page.getByRole('button', { name: 'Criar ordem' }).click()
  await expect(
    page.getByText('Escreva o escopo de trabalho ou anexe pelo menos um documento.'),
  ).toBeVisible()
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'Escopo técnico.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 escopo'),
    })
  await expect(page.getByText('Escopo técnico.pdf')).toBeVisible()
  await page.getByRole('button', { name: 'Criar ordem' }).click()

  // Já existe o lote de demonstração LOT-00001 na API simulada.
  await expect(page.getByText('Lote LOT-00002 agendado.')).toBeVisible()
  await expect(page).toHaveURL(/\/ordens\/lotes/)
  const linha = page.locator('main tbody tr').first()
  await expect(linha).toContainText('LOT-00002')
  await expect(linha).toContainText(nome)
  await expect(linha).toContainText('III · IV')
})

test('data de coleta é obrigatória', async ({ page }) => {
  await abrir(page, '/ordens/agendamento')
  await page.getByRole('button', { name: 'Criar ordem' }).click()
  const campo = page.getByLabel(/^Data de coleta/)
  await expect(campo).toHaveAttribute('aria-invalid', 'true')
})

test('desmarcar o serviço IV esconde as placas de policarbonato', async ({ page }) => {
  await abrir(page, '/ordens/agendamento')
  await page.getByRole('checkbox', { name: 'IV. Value Recovery (Racks)' }).click()
  await expect(page.getByLabel(/^Placas de policarbonato/)).toHaveCount(0)
})
