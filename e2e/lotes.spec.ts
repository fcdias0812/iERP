import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'
import { loteAgendado, PNG, traducaoSimulada } from './lotes-helpers'

/*
 * Detalhe do lote (API simulada; lote de demonstração ord00001 em processo, com 2 pallets e
 * uma ocorrência): mesma lista em Ordens e Operação, abas Informações · Progresso ·
 * Ocorrências · Documentos · Histórico.
 */

const LOTE = '/operacao/lotes/ord00001'

test('Operação › Lotes é a mesma lista e abre o detalhe na aba Informações', async ({ page }) => {
  await abrir(page, '/operacao/lotes')
  await page.locator('main tbody tr', { hasText: 'LOT-00001' }).click()
  await expect(page).toHaveURL(/\/operacao\/lotes\/ord00001$/)
  await expect(page.getByRole('heading', { level: 1, name: 'LOT-00001' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Informações' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const local = page.getByRole('region', { name: 'Cliente e local da coleta' })
  await expect(local).toContainText('SPO-01')
  await expect(local).toContainText('Praça da Sé')
  await expect(page.getByRole('region', { name: 'Transporte' })).toContainText('PO-7781')
  expect(await violacoes(page)).toEqual([])
})

test('Ordens › Lotes abre o mesmo lote, com o caminho de Ordens', async ({ page }) => {
  await abrir(page, '/ordens/lotes/ord00001')
  await expect(page.getByRole('navigation', { name: /caminho|breadcrumb/i })).toContainText(
    'Ordens',
  )
})

test('progresso: etapa atual, pallets, peso bruto e linha do tempo', async ({ page }) => {
  await abrir(page, `${LOTE}?aba=progresso`)
  const resumo = page.locator('main ul').first()
  await expect(resumo).toContainText('Processo')
  await expect(resumo).toContainText(/Pallets recebidos\s*2/)
  await expect(resumo).toContainText('800,5 kg')
  const linha = page.getByRole('list', { name: 'Linha do tempo' })
  await expect(linha.locator('[aria-current="step"]')).toContainText('Processo')
  await expect(linha.getByRole('listitem')).toHaveCount(5)
  await expect(page.getByText('Servidores rack 1U')).toBeVisible()
  expect(await violacoes(page)).toEqual([])
})

test('ocorrência: obrigatórios, registro com foto, histórico e cancelamento', async ({ page }) => {
  await traducaoSimulada(page)
  await abrir(page, `${LOTE}?aba=ocorrencias`)
  await page.getByRole('button', { name: 'Registrar ocorrência' }).first().click()
  const painel = page.getByRole('dialog')
  await expect(painel).toContainText('Registrar ocorrência')
  expect(await violacoes(page)).toEqual([])

  // Sem preencher: momento, categoria e descrição obrigatórios.
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(painel.getByRole('combobox', { name: /^Momento/ })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(painel.getByLabel(/^Descrição/)).toHaveAttribute('aria-invalid', 'true')

  await painel.getByRole('combobox', { name: /^Momento/ }).click()
  await page.getByRole('option', { name: 'Recebimento' }).click()
  await painel.getByRole('combobox', { name: /^Categoria/ }).click()
  await page.getByRole('option', { name: 'Avaria na carga' }).click()
  await painel.getByLabel(/^Descrição/).fill('Pallet 2 chegou com a base quebrada.')
  await painel
    .locator('input[type=file]')
    .setInputFiles({ name: 'base-quebrada.png', mimeType: 'image/png', buffer: PNG })
  await expect(painel.getByRole('img', { name: 'base-quebrada.png' })).toBeVisible()
  await painel.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('Ocorrência registrada.')).toBeVisible()
  await expect(page).not.toHaveURL(/ocorrencia=/)
  const nova = page.locator('main tbody tr', { hasText: '#2' })
  await expect(nova).toContainText('Recebimento')
  await expect(nova).toContainText('Avaria na carga')
  await expect(page.getByRole('tab', { name: /Ocorrências/ })).toContainText('2')

  // Cancela a #1: fica na lista como cancelada.
  const primeira = page.locator('main tbody tr', { hasText: '#1' })
  await primeira.getByRole('button', { name: /^Ações de/ }).click()
  await page.getByRole('menuitem', { name: 'Cancelar ocorrência' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar ocorrência' }).click()
  await expect(page.getByText('Ocorrência #1 cancelada.')).toBeVisible()
  await expect(primeira).toContainText('Cancelado')

  await page.getByRole('tab', { name: 'Histórico' }).click()
  const historico = page.locator('main tbody')
  await expect(historico).toContainText('Registrou ocorrência')
  await expect(historico).toContainText('Cancelou ocorrência')
})

test('documentos: tipo obrigatório, envio e remoção', async ({ page }) => {
  await abrir(page, `${LOTE}?aba=documentos`)
  await expect(page.getByText('Escolha o tipo antes de enviar.')).toBeVisible()
  await page.getByRole('combobox', { name: /^Tipo/ }).click()
  await page.getByRole('option', { name: 'Nota fiscal' }).click()
  await page.locator('main input[type=file]').setInputFiles({
    name: 'Nota fiscal.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 nf'),
  })
  await expect(page.getByText('Documentos adicionados: 1.')).toBeVisible()
  const linha = page.locator('main tbody tr', { hasText: 'Nota fiscal.pdf' })
  await expect(linha).toContainText('Nota fiscal')
  await expect(linha).toContainText('Adicionado ao lote')
  expect(await violacoes(page)).toEqual([])

  await linha.getByRole('button', { name: /^Ações de/ }).click()
  await page.getByRole('menuitem', { name: 'Remover' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Nota fiscal.pdf removido.')).toBeVisible()
  await expect(linha).toHaveCount(0)
})

test('editar lote agendado no painel; o cliente não muda; histórico registra', async ({ page }) => {
  const id = await loteAgendado(page)
  // Navegação dentro do app: recarregar a página zeraria a API simulada (o lote sumiria).
  await page.evaluate((url) => {
    history.pushState({}, '', url)
    dispatchEvent(new PopStateEvent('popstate'))
  }, `/ordens/lotes/${id}`)
  await expect(page.getByRole('heading', { level: 1, name: /^LOT-/ })).toBeVisible()
  await page.getByRole('button', { name: 'Editar' }).click()
  const painel = page.getByRole('dialog')
  await expect(painel).toContainText('Editar lote')
  await expect(painel.getByLabel(/^Cliente/)).toHaveAttribute('readonly', '')
  expect(await violacoes(page)).toEqual([])

  const ref = painel.getByLabel(/^Nº do lote de referência/)
  await ref.fill('PO-2')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText(/Lote LOT-\d+ atualizado\./)).toBeVisible()
  await expect(page).not.toHaveURL(/editar=/)
  await expect(page.getByRole('region', { name: 'Transporte' })).toContainText('PO-2')

  await page.getByRole('tab', { name: 'Histórico' }).click()
  const editou = page.locator('main tbody tr', { hasText: 'Editou o lote' })
  await expect(editou).toContainText('PO-1')
  await expect(editou).toContainText('PO-2')
})

test('lote que já chegou não tem Editar e mostra o aviso', async ({ page }) => {
  await abrir(page, LOTE)
  await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  await expect(page.getByText('Dados do agendamento travados')).toBeVisible()
})
