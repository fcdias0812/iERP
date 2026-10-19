import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Clientes › abas do detalhe (API simulada): contatos com o principal fixo no topo, cadastro de
 * site com CEP → endereço → mapa e docas, envio de documento, histórico em tabela.
 * Os tiles do mapa (internet) são bloqueados: o teste não depende de rede.
 */

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort())
})

test('contatos: o principal fica em primeiro mesmo ordenando por nome ao contrário', async ({
  page,
}) => {
  await abrir(page, '/clientes/cli00001?aba=contatos')
  const primeira = page.locator('main tbody tr').first()
  await expect(primeira).toContainText('Principal')
  await page.getByRole('button', { name: /^Nome do contato/ }).click() // crescente → decrescente
  await page.getByRole('button', { name: /^Nome do contato/ }).click()
  await expect(page.locator('main tbody tr').first()).toContainText('Principal')
})

test('logística: cadastra site pelo CEP (endereço, região e mapa) com doca', async ({ page }) => {
  await abrir(page, '/clientes/cli00001?aba=logistica')
  await page.getByRole('button', { name: 'Novo site' }).first().click()
  const painel = page.getByRole('dialog')
  await painel.getByLabel(/^Código do site/).fill('RJ-01')
  await painel.getByLabel(/^CEP/).fill('01001000')
  await painel.getByRole('button', { name: 'Buscar CEP' }).click()
  await expect(painel.getByLabel(/^Endereço/)).toHaveValue('Praça da Sé, Sé, São Paulo – SP')
  // Região: lista das 5 regiões do Brasil; o CEP já escolhe a do endereço.
  const regiao = painel.getByRole('combobox', { name: /^Região/ })
  await expect(regiao).toHaveText('Sudeste')
  await regiao.click()
  await expect(page.getByRole('option')).toHaveText([
    'Sem região',
    'Norte',
    'Nordeste',
    'Centro-Oeste',
    'Sudeste',
    'Sul',
  ])
  await page.keyboard.press('Escape')
  await expect(painel.getByLabel(/^Latitude, longitude/)).toHaveValue('-23.550390, -46.633081')
  await painel.getByRole('button', { name: 'Adicionar doca' }).click()
  await painel.getByLabel(/^Número da doca/).fill('A1')
  await painel.getByLabel(/^Altura máx. do caminhão/).fill('4')
  expect(await violacoes(page)).toEqual([])
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Site RJ-01 cadastrado.')).toBeVisible()
  await expect(page.locator('main tbody tr', { hasText: 'RJ-01' })).toContainText('Sudeste')
})

test('logística: código de site repetido mostra erro no campo', async ({ page }) => {
  await abrir(page, '/clientes/cli00001?aba=logistica')
  await page.getByRole('button', { name: 'Novo site' }).first().click()
  const painel = page.getByRole('dialog')
  await painel.getByLabel(/^Código do site/).fill('spo-01')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(painel.getByText('Já existe um site com este código neste cliente.')).toBeVisible()
})

test('documentos: envia um contrato e aparece na lista e no histórico', async ({ page }) => {
  await abrir(page, '/clientes/cli00001?aba=documentos')
  await page.getByRole('combobox', { name: /^Tipo/ }).click()
  await page.getByRole('option', { name: 'Licença' }).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'Licença ambiental.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 teste'),
  })
  await expect(page.locator('main tbody').getByText('Licença ambiental.pdf')).toBeVisible()
  await page.getByRole('tab', { name: /Histórico/ }).click()
  await expect(page.locator('main tbody tr').first()).toContainText('Adicionou documento')
})
