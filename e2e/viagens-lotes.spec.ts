import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'
import { irSemRecarregar, loteAgendado, traducaoSimulada } from './lotes-helpers'

/*
 * Viagens e lotes — pedido de 22/10/2026 (API simulada): vários caminhões no mesmo lote, tipos de
 * documento por cliente e o botão Gerar (PDF da OS e relatório final).
 */

test('lote agendado: "Adicionar caminhão" cria o Caminhão 2 com viagem própria', async ({
  page,
}) => {
  const id = await loteAgendado(page)
  await irSemRecarregar(page, `/ordens/lotes/${id}`)
  await page.getByRole('button', { name: 'Adicionar caminhão' }).click()
  const painel = page.getByRole('dialog')
  await expect(painel).toContainText('Mais um caminhão para esta coleta')
  expect(await violacoes(page)).toEqual([])
  await painel.getByLabel(/^Placa/).fill('XYZ9A87')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Caminhão 1 adicionado.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Adicionar caminhão' }).click()
  await page
    .getByRole('dialog')
    .getByLabel(/^Placa/)
    .fill('QWE4R56')
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Caminhão 2 adicionado.')).toBeVisible()
  await expect(page.getByRole('article', { name: /caminhão 2/i })).toContainText('QWE4R56')
})

test('Gerar: PDF da OS sempre; o relatório final diz o que falta', async ({ page }) => {
  // Lote recebido (ord00001) e sem documento marcado para o relatório: o ZIP sai.
  await abrir(page, '/operacao/lotes/ord00001')
  expect(await violacoes(page)).toEqual([])
  await page.getByRole('button', { name: 'Gerar' }).click()
  await expect(page.getByRole('menuitem', { name: 'PDF da OS' })).toHaveAttribute(
    'href',
    /\/api\/ordens\/ord00001\/pdf$/,
  )
  await expect(page.getByRole('menuitem', { name: 'Relatório final (ZIP)' })).toHaveAttribute(
    'href',
    /\/api\/ordens\/ord00001\/relatorio-final$/,
  )
  await page.keyboard.press('Escape')

  // Lote ainda agendado: o item explica que falta receber.
  const id = await loteAgendado(page)
  await irSemRecarregar(page, `/operacao/lotes/${id}`)
  await page.getByRole('button', { name: 'Gerar' }).click()
  const zip = page.getByRole('menuitem', { name: /Relatório final \(ZIP\)/ })
  await expect(zip).toContainText('Falta: receber o lote')
  await zip.click()
  await expect(page.getByText('O relatório final ainda não pode ser gerado')).toBeVisible()
})

test('configurações do cliente: tipos de documento do lote, tipo novo e a aba Documentos', async ({
  page,
}) => {
  await traducaoSimulada(page)
  await abrir(page, '/clientes/cli00001?aba=configuracoes')
  await page.getByRole('button', { name: 'Editar configurações' }).click()
  const painel = page.getByRole('dialog')
  await painel.getByRole('switch', { name: 'Aceita — Foto' }).click()
  await painel.getByRole('switch', { name: /^Vai no relatório final — CDF/ }).click()
  await painel.getByLabel(/^Tipo novo/).fill('Laudo técnico')
  await painel.getByRole('button', { name: 'Criar tipo' }).click()
  await expect(painel.getByRole('switch', { name: 'Aceita — Laudo técnico' })).toBeChecked()
  await painel.getByRole('switch', { name: 'Vai no relatório final — Laudo técnico' }).click()
  expect(await violacoes(page)).toEqual([])
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const docs = page.locator('main [data-slot="card"]', { hasText: 'Tipos aceitos' })
  await expect(docs).toContainText(
    /Vão no relatório final\s*CDF \(certificado de destinação\), Laudo técnico/,
  )
  await expect(docs).not.toContainText('Foto')

  // Na aba Documentos de um lote do cliente só aparecem os tipos aceitos.
  const id = await loteAgendado(page)
  await irSemRecarregar(page, `/operacao/lotes/${id}?aba=documentos`)
  await page.getByRole('combobox', { name: /^Tipo/ }).click()
  await expect(page.getByRole('option', { name: 'Laudo técnico' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Foto' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // E o botão Gerar lista o que falta para o relatório.
  await page.getByRole('button', { name: 'Gerar' }).click()
  await expect(page.getByRole('menuitem', { name: /Relatório final \(ZIP\)/ })).toContainText(
    'Falta: receber o lote, CDF (certificado de destinação), Laudo técnico',
  )
})
