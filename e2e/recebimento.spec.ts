import { expect, test, type Locator } from '@playwright/test'
import { abrir, violacoes } from './helpers'
import { irSemRecarregar, loteAgendado, PNG, traducaoSimulada } from './lotes-helpers'

/*
 * Operação › Recebimento (API simulada): escolher o lote agendado, lacre com foto, inspeção
 * Avaria (vira ocorrência), pallet com peso bruto, tara (peso líquido calculado) e foto. O lote
 * vai para Inspeção e o recebimento aparece no Progresso.
 */

/** Anexa a foto de teste pelo botão "Escolher arquivo" de um bloco (lacre, pallet…). */
async function anexarFoto(bloco: Locator, nome: string) {
  await bloco
    .locator('input[data-campo-fotos="galeria"]')
    .setInputFiles({ name: nome, mimeType: 'image/png', buffer: PNG })
  await expect(bloco.getByRole('img', { name: nome })).toBeVisible()
}

test('lista A receber e Recebidos; painel do recebimento acessível', async ({ page }) => {
  await abrir(page, '/operacao/recebimento?visao=recebidos')
  // Recebidos = chegou e o processamento ainda não começou (Inspeção). O LOT-00001 de
  // demonstração já está em processamento: não aparece mais aqui.
  await expect(page.locator('main tbody tr', { hasText: 'LOT-00001' })).toHaveCount(0)
  await page.getByRole('button', { name: 'A receber' }).click()
  await expect(page.getByText('Nenhum lote a receber')).toBeVisible()
  await page.getByRole('button', { name: 'Receber lote' }).first().click()
  await expect(page.getByRole('dialog')).toContainText('Receber lote')
  expect(await violacoes(page)).toEqual([])
})

test('receber lote: obrigatórios, avaria vira ocorrência, lote vai para Inspeção', async ({
  page,
}) => {
  await traducaoSimulada(page)
  const id = await loteAgendado(page)
  await irSemRecarregar(page, `/operacao/recebimento?aberto=${id}`)
  const painel = page.getByRole('dialog')
  await expect(painel).toContainText('Receber lote')
  // O cliente vem do lote; a data já vem com hoje.
  await expect(painel.getByLabel(/^Cliente/)).not.toHaveValue('')
  await expect(painel.getByLabel(/^Data de recebimento/)).not.toContainText('Selecione')

  // Sem preencher: inspeção e peso bruto obrigatórios; pallet sem foto também.
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(painel.getByText('Campo obrigatório.').first()).toBeVisible()
  await expect(painel.getByText('Tire ou escolha pelo menos uma foto.')).toBeVisible()

  await painel.getByRole('radio', { name: 'Avaria' }).click()
  await painel.getByLabel(/^O que foi encontrado/).fill('Pallet 2 chegou com a base quebrada.')

  await painel.getByRole('button', { name: 'Adicionar lacre' }).click()
  const lacre = painel.locator('fieldset', { hasText: 'Lacre 1' })
  await lacre.getByLabel(/^Número do lacre/).fill('LAC-00912')
  await anexarFoto(lacre, 'lacre.png')

  const pallet = painel.locator('fieldset', { hasText: 'Pallet 1' })
  await pallet.getByLabel(/^Peso bruto/).fill('250,5')
  await pallet.getByLabel(/^Tara/).fill('20')
  await pallet.getByLabel(/^Conteúdo/).click()
  await expect(pallet.locator('output')).toHaveText('230,5 kg')
  await anexarFoto(pallet, 'pallet.png')
  expect(await violacoes(page)).toEqual([])

  // Recebimento novo: só conclui depois de abrir a impressão das etiquetas (uma por pallet).
  await painel.getByRole('button', { name: 'Salvar' }).click()
  const etiquetas = page.getByRole('dialog', { name: 'Imprima as etiquetas dos pallets' })
  await expect(etiquetas).toContainText('Pallet 1/1')
  await expect(etiquetas).toContainText('250,5 kg')
  await expect(etiquetas.getByRole('button', { name: /concluir recebimento/ })).toHaveCount(0)
  expect(await violacoes(page)).toEqual([])
  const [janela] = await Promise.all([
    page.waitForEvent('popup'),
    etiquetas.getByRole('button', { name: 'Imprimir 1 etiqueta(s)' }).click(),
  ])
  await expect(janela.locator('section.etq')).toHaveCount(1)
  await expect(janela.locator('section.etq')).toContainText('Pallet 1/1')
  await expect(janela.locator('section.etq')).toContainText('230,5 kg')
  await expect(janela.locator('section.etq svg')).toHaveCount(1)
  await janela.close()
  await etiquetas.getByRole('button', { name: /concluir recebimento/ }).click()
  await expect(page.getByText(/Lote LOT-\d+ recebido\./)).toBeVisible()
  await expect(page).not.toHaveURL(/aberto=/)

  // No lote: Inspeção, recebimento no Progresso e a ocorrência criada pela avaria.
  await irSemRecarregar(page, `/operacao/lotes/${id}?aba=progresso`)
  await expect(page.locator('main h1').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Dados do recebimento' })).toContainText('Avaria')
  await expect(page.getByRole('region', { name: 'Dados do recebimento' })).toContainText(
    'LAC-00912',
  )
  await expect(
    page.getByRole('list', { name: 'Linha do tempo' }).locator('[aria-current="step"]'),
  ).toContainText('Inspeção')
  await expect(page.locator('main tbody tr', { hasText: '250,5 kg' })).toContainText('230,5 kg')
  await page.getByRole('tab', { name: /Ocorrências/ }).click()
  const oc = page.locator('main tbody tr', { hasText: 'Avaria na carga' })
  await expect(oc).toContainText('Recebimento')
  await expect(page.getByRole('button', { name: 'Corrigir recebimento' })).toBeVisible()

  // Etiqueta perdida: imprime de novo pelo menu Gerar, com os pesos gravados.
  await page.getByRole('button', { name: 'Gerar' }).click()
  const [deNovo] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('menuitem', { name: 'Etiquetas dos pallets (1)' }).click(),
  ])
  await expect(deNovo.locator('section.etq')).toContainText('250,5 kg')
  await deNovo.close()
})
