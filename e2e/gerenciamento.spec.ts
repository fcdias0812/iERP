import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Lote do Gerenciamento de Projetos (API simulada: ordgp001). Ele é criado, recebido e concluído
 * lá: aqui é só para ver — sem Editar, Receber nem Registrar ocorrência —, com o espelho do que
 * aconteceu lá (pesagens, materiais e documentos). Na Integração, o Gerenciamento mostra a
 * sincronização (e a coleta que espera o cliente ser cadastrado), sem chave nem avisos.
 */

test('lote do Gerenciamento é só para ver, com os dados e o espelho de lá', async ({ page }) => {
  await abrir(page, '/operacao/lotes/ordgp001')
  const main = page.locator('main')
  await expect(main).toContainText('Lote do Gerenciamento de Projetos')
  await expect(
    main.getByRole('link', { name: /Abrir no Gerenciamento de Projetos/ }).first(),
  ).toHaveAttribute('href', 'http://localhost:5005/coletas/1834')
  await expect(main.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Receber lote' })).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Registrar ocorrência' })).toHaveCount(0)
  const dados = page.getByRole('region', { name: 'Ordem no Gerenciamento de Projetos' })
  await expect(dados).toContainText('ECO_2608_5498157_BR')
  await expect(dados).toContainText('Transportadora Alfa')
  expect(await violacoes(page)).toEqual([])

  await page.getByRole('tab', { name: /Progresso/ }).click()
  await expect(main).toContainText('Processamento 6/8 · Processando')
  const recebimento = page.getByRole('region', { name: 'Recebimento no Gerenciamento de Projetos' })
  await expect(recebimento).toContainText('Rádios')
  await expect(recebimento).toContainText('612,5 kg')
  await expect(recebimento).toContainText('Placas de rádio')
  await expect(recebimento).toContainText('Chegou com lacre.')
  // Os cards usam o que foi pesado lá.
  await expect(main.locator('ul').first()).toContainText('1.212,5 kg')
  expect(await violacoes(page)).toEqual([])

  await page.getByRole('tab', { name: /Documentos/ }).click()
  await expect(main.getByRole('link', { name: 'Laudo de recebimento.pdf' })).toHaveAttribute(
    'target',
    '_blank',
  )
  expect(await violacoes(page)).toEqual([])
})

test('Integração: o Gerenciamento mostra a sincronização e o cliente que falta', async ({
  page,
}) => {
  await abrir(page, '/admin/integracao?aberto=int00002')
  const painel = page.getByRole('dialog')
  await expect(painel).toContainText('Sincronização')
  await expect(painel).toContainText('Cliente Nokia não cadastrado no iERP: 3 coleta(s) esperando')
  await expect(painel).not.toContainText('Avisos (iERP → sistema)')
  await expect(painel.getByRole('button', { name: 'Gerar chave' })).toHaveCount(0)
  // O token do Gerenciamento não precisa de 32 caracteres (o do MoonShot precisa).
  await painel.getByLabel(/^Token do painel/).fill('senha-curta')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(painel).not.toContainText('pelo menos 32 caracteres')
  expect(await violacoes(page)).toEqual([])
})

test('lote do MSDC (Microsoft): só para ver, com o resumo da desmontagem; documentos só lá', async ({
  page,
}) => {
  await abrir(page, '/operacao/lotes/ordms001?aba=progresso')
  const main = page.locator('main')
  await expect(main).toContainText('Lote do Re-Teck MSDC (Microsoft)')
  await expect(main.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Registrar ocorrência' })).toHaveCount(0)
  const operacao = page.getByRole('region', { name: 'O que aconteceu no Re-Teck MSDC (Microsoft)' })
  await expect(operacao).toContainText('4 · 4 inventariado(s)')
  await expect(operacao).toContainText('Memória: 120 peças')
  await expect(operacao).not.toContainText('Pesagens')
  expect(await violacoes(page)).toEqual([])

  await page.getByRole('tab', { name: /Documentos/ }).click()
  await expect(main).toContainText('só abrem lá')
  await expect(main.getByRole('link', { name: /Abrir no Re-Teck MSDC/ }).last()).toHaveAttribute(
    'href',
    'https://192.168.100.96:5013/lotes/12',
  )
  expect(await violacoes(page)).toEqual([])

  await page.getByRole('tab', { name: /Informações/ }).click()
  const dados = page.getByRole('region', { name: 'Ordem no Re-Teck MSDC (Microsoft)' })
  await expect(dados).toContainText('SP-HORTO')
  await expect(dados).toContainText('D2')
})
