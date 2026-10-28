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

test('excluir lote: só o agendado; digita o código, some e volta para a lista', async ({
  page,
}) => {
  // Lote já recebido (ord00001): sem o botão.
  await abrir(page, '/ordens/lotes/ord00001')
  await expect(page.getByRole('button', { name: 'Excluir', exact: true })).toHaveCount(0)

  const id = await loteAgendado(page)
  await irSemRecarregar(page, `/ordens/lotes/${id}`)
  const codigo = (await page.locator('main h1').first().textContent())!.trim()
  await page.getByRole('button', { name: 'Excluir', exact: true }).click()
  const dialogo = page.getByRole('alertdialog')
  await expect(dialogo).toContainText(`O lote ${codigo}`)
  expect(await violacoes(page)).toEqual([])
  const confirmar = dialogo.getByRole('button', { name: 'Excluir lote' })
  await expect(confirmar).toBeDisabled()
  await dialogo.getByRole('textbox').fill(codigo)
  await confirmar.click()
  await expect(page.getByText(`Lote excluído: ${codigo}.`)).toBeVisible()
  await expect(page).toHaveURL(/\/ordens\/lotes$/)
})

test('um caminhão com 2 rastreadores: um card só, com "Adicionar rastreador"', async ({ page }) => {
  await abrir(page, '/ordens/viagens')
  const card = page.getByRole('article', { name: 'Viagem do lote LOT-00003' })
  await card.getByRole('button', { name: 'Adicionar rastreador' }).click()
  const janela = page.getByRole('dialog', { name: 'Adicionar rastreador' })
  await expect(janela).toContainText('caminhão 1 do LOT-00003')
  expect(await violacoes(page)).toEqual([])
  await janela.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Rastreador adicionado ao caminhão 1.')).toBeVisible()
  // Continua UM card para o caminhão, agora com a lista dos outros rastreadores.
  await expect(page.getByRole('article', { name: 'Viagem do lote LOT-00003' })).toHaveCount(1)
  await expect(card).toContainText('2 rastreadores neste caminhão')
  await expect(
    card.getByRole('list', { name: 'Outros rastreadores deste caminhão' }),
  ).toContainText('Rastreador 2')
})

test('Nova viagem em Viagens: escolhe a ordem agendada e cria mais um caminhão', async ({
  page,
}) => {
  const id = await loteAgendado(page)
  await irSemRecarregar(page, `/ordens/lotes/${id}`)
  const codigo = (await page.locator('main h1').first().textContent())!.trim()
  await irSemRecarregar(page, '/ordens/viagens')
  await page.getByRole('button', { name: 'Nova viagem' }).click()
  const painel = page.getByRole('dialog', { name: /Nova viagem/ })
  await expect(painel).toContainText('Mais um caminhão para uma ordem já agendada')
  await painel.getByRole('combobox', { name: /^Ordem agendada/ }).click()
  await page.getByPlaceholder('Digite para buscar…').fill(codigo)
  await page.getByRole('option', { name: new RegExp(codigo) }).click()
  await painel.getByLabel(/^Placa/).fill('QWE4R56')
  expect(await violacoes(page)).toEqual([])
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText(`Caminhão 1 criado no ${codigo}.`)).toBeVisible()
  // O card novo já vem escolhido (no mapa).
  const novo = page
    .getByRole('article', { name: `Viagem do lote ${codigo}` })
    .filter({ hasText: 'QWE4R56' })
  await expect(novo).toHaveCount(1)
  await expect(novo).toContainText('Aguardando motorista')
})

test('Agendamento: lote da mesma coleta avisa que vai junto com o lote que já existe', async ({
  page,
}) => {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(),
  )
  const id = await loteAgendado(page, { coletaPrevista: hoje })
  await irSemRecarregar(page, `/ordens/lotes/${id}`)
  const codigo = (await page.locator('main h1').first().textContent())!.trim()
  await irSemRecarregar(page, '/ordens/agendamento')
  const nome = await page.evaluate(async () => {
    const r = await fetch('/api/clientes/cli00001')
    return ((await r.json()) as { nome: string }).nome
  })
  await page.getByRole('combobox', { name: /^Cliente/ }).click()
  await page.getByPlaceholder('Digite para buscar…').fill(nome.slice(0, 6))
  await page.getByRole('option', { name: nome }).click()
  await page.getByRole('combobox', { name: /^Site/ }).click()
  await page.getByRole('option', { name: 'SPO-01' }).click()
  await page.getByLabel(/^Coleta prevista/).click()
  await page.locator('[data-today] button').click()
  await expect(page.getByText(`Vai junto com o ${codigo} (mesma coleta)`)).toBeVisible()
  expect(await violacoes(page)).toEqual([])
})
