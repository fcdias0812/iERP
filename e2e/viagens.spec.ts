import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Ordens › Viagens (API simulada: LOT-00002 na rua, LOT-00003 esperando o motorista, o lote do
 * Gerenciamento só para ver e LOT-00001 finalizado com replay).
 */

test('cards por dia e cliente; o link do motorista nunca leva o código de chegada', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await abrir(page, '/ordens/viagens')
  await expect(page.getByRole('button', { name: /Em andamento/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const naRua = page.getByRole('article', { name: 'Viagem do lote LOT-00002' })
  await expect(naRua).toContainText('Em rota')
  await expect(naRua).toContainText('Código de chegada: 481930')
  await naRua.getByRole('button', { name: 'Copiar link do motorista' }).click()
  await expect(page.getByText('Link do motorista copiado.')).toBeVisible()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('os=LOT-00002')
  expect(link).not.toContain('481930')

  const esperando = page.getByRole('article', { name: 'Viagem do lote LOT-00003' })
  await expect(esperando).toContainText('Aguardando motorista')
  await expect(esperando).toContainText('Motorista a definir')
  await expect(esperando.getByRole('button', { name: 'Finalizar viagem' })).toHaveCount(0)

  // Lote do Gerenciamento: só para ver.
  const deFora = page.getByRole('article', { name: 'Viagem do lote LOT-00090' })
  await expect(deFora).toContainText('só para ver (Gerenciamento de Projetos)')
  await expect(deFora.getByRole('button', { name: 'Finalizar viagem' })).toHaveCount(0)
  await expect(deFora.getByRole('button', { name: 'Copiar código' })).toHaveCount(0)
})

test('escolher a viagem mostra o trajeto e as paradas; conversa com o motorista', async ({
  page,
}) => {
  await abrir(page, '/ordens/viagens')
  const naRua = page.getByRole('article', { name: 'Viagem do lote LOT-00002' })
  await naRua.getByRole('button', { name: /LOT-00002/ }).click()
  await expect(page.getByText('Viagem do lote LOT-00002', { exact: true })).toBeVisible()
  await expect(page.getByText('Paradas reportadas (1)')).toBeVisible()
  await expect(page.getByText('Abastecimento')).toBeVisible()

  await naRua.getByRole('button', { name: 'Conversa' }).click()
  const chat = page.getByRole('dialog', { name: 'Conversa com o motorista' })
  await expect(chat).toContainText('Saindo do cliente agora.')
  await chat.getByLabel('Mensagem').fill('Recebido, siga com cuidado.')
  await chat.getByRole('button', { name: 'Enviar' }).click()
  await expect(chat).toContainText('Recebido, siga com cuidado.')
  expect(await violacoes(page)).toEqual([])
})

test('finalizar pede confirmação e a viagem vai para Finalizadas, com replay', async ({ page }) => {
  await abrir(page, '/ordens/viagens')
  await page
    .getByRole('article', { name: 'Viagem do lote LOT-00002' })
    .getByRole('button', { name: 'Finalizar viagem' })
    .click()
  const confirmar = page.getByRole('alertdialog')
  await expect(confirmar).toContainText('ainda NÃO avisou a chegada')
  await confirmar.getByRole('button', { name: 'Finalizar viagem' }).click()
  await expect(page.getByText('Viagem do lote LOT-00002 finalizada.')).toBeVisible()
  await expect(page.getByRole('article', { name: 'Viagem do lote LOT-00002' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Finalizadas' }).click()
  const linha = page.locator('main tbody tr', { hasText: 'LOT-00001' })
  await expect(linha).toContainText('Recebimento do lote')
  await linha.click()
  await expect(page.getByText('Replay da viagem do lote LOT-00001')).toBeVisible()
  await page.getByRole('button', { name: 'Reproduzir' }).click()
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
  await expect(page.locator('main tbody tr', { hasText: 'LOT-00002' })).toContainText('Operador')
})

test('emergência aparece em qualquer tela até alguém dar ciência', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ierp-mock-emergencia', '1'))
  await abrir(page, '/clientes')
  const alerta = page
    .getByRole('alert')
    .filter({ hasText: 'Emergência na viagem do lote LOT-00002' })
  await expect(alerta).toContainText('assalto')
  expect(await violacoes(page)).toEqual([])
  await alerta.getByRole('button', { name: 'Dar ciência' }).click()
  await expect(page.getByText('Ciência da emergência registrada.')).toBeVisible()
  await expect(alerta).toHaveCount(0)
})

test('rastreador em Administração › Integração: endereço, chave interna e chave do trânsito', async ({
  page,
}) => {
  await abrir(page, '/admin/integracao?aberto=novo')
  const painel = page.getByRole('dialog')
  await painel.getByRole('combobox', { name: /Sistema/ }).click()
  await page.getByRole('option', { name: /RASTREADOR/ }).click()
  await expect(painel).toContainText('Rastreador de GPS (rastreador → iERP)')
  await expect(painel).not.toContainText('Avisos (iERP → sistema)')
  await painel.getByLabel(/^Endereço do rastreador/).fill('https://rastreador.exemplo.com.br')
  await painel.getByLabel(/^Chave interna/).fill('curta')
  await painel.getByLabel(/^Chave do mapa de trânsito/).fill('tomtom-teste')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.locator('main tbody tr', { hasText: 'RASTREADOR' })).toBeVisible()
})

test('lote com viagem na rua: card da viagem e mapa na aba Informações', async ({ page }) => {
  // Lote do Gerenciamento (ordgp001), rastreado pelo iERP antigo: só para ver.
  await abrir(page, '/operacao/lotes/ordgp001')
  const card = page.getByRole('article', { name: 'Viagem do lote LOT-00090' })
  await expect(card).toContainText('Em rota')
  await expect(card.getByRole('link', { name: 'Abrir lote' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Viagem do lote LOT-00090' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Postos/balanças' })).toBeVisible()
  await expect(page.getByText('Paradas reportadas (1)')).toBeVisible()
  expect(await violacoes(page)).toEqual([])
})
