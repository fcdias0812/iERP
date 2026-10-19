import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

/*
 * Relacionamento (API simulada): Veículos e Motoristas em painel lateral, Transportadoras com
 * detalhe em abas. "Não está na lista? Cadastre agora": transportadora nova a partir do motorista
 * e motorista novo a partir da transportadora.
 */

// Documentos fictícios com dígitos verificadores válidos.
const CPF_NOVO = '52998224725'
const CPF_OUTRO = '11144477735'
const CNPJ_NOVO = '11444777000161'

test('veículos: valida volume mínimo ≤ máximo e cadastra pelo painel', async ({ page }) => {
  await abrir(page, '/veiculos')
  await page.getByRole('button', { name: 'Novo veículo' }).first().click()
  const painel = page.getByRole('dialog')
  await painel.getByRole('combobox', { name: /^Tipo de veículo/ }).click()
  await page.getByRole('option', { name: 'Truck' }).click()
  await painel.getByLabel(/^Volume mínimo/).fill('30')
  await painel.getByLabel(/^Volume máximo/).fill('20')
  await painel.getByLabel(/^Capacidade \(pallets\)/).fill('12')
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(painel.getByText('O volume mínimo não pode ser maior que o máximo.')).toBeVisible()
  await painel.getByLabel(/^Volume mínimo/).fill('10')
  expect(await violacoes(page)).toEqual([])
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Veículo VEI-00004 cadastrado.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('main tbody').getByText('VEI-00004')).toBeVisible()
})

test('veículos: inativar registra no histórico do painel', async ({ page }) => {
  await abrir(page, '/veiculos?aberto=vei00001')
  const painel = page.getByRole('dialog')
  await painel.getByRole('button', { name: 'Inativar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Inativar' }).click()
  await expect(page.getByText('VEI-00001 foi inativado.')).toBeVisible()
  await painel.getByRole('tab', { name: /Histórico/ }).click()
  await expect(painel.locator('tbody tr').first()).toContainText('Status')
})

test('motoristas: cadastra com transportadora nova, que entra em Transportadoras', async ({
  page,
}) => {
  await abrir(page, '/motoristas')
  await page.getByRole('button', { name: 'Novo motorista' }).first().click()
  const painel = page.getByRole('dialog')
  await painel.getByLabel(/^Nome completo/).fill('Eduardo Pires')
  await painel.getByLabel(/^CPF/).fill(CPF_NOVO)
  await painel.getByLabel(/^Telefone/).fill('11988887777')
  await painel.getByRole('combobox', { name: /^Transportadora/ }).click()
  await page.getByRole('option', { name: 'Cadastrar nova transportadora…' }).click()
  await painel.getByLabel(/^Nome da transportadora/).fill('Via Norte Fretes')
  await painel.getByLabel(/^CNPJ da transportadora/).fill(CNPJ_NOVO)
  expect(await violacoes(page)).toEqual([])
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Motorista Eduardo Pires cadastrado.')).toBeVisible()
  await expect(page.locator('main tbody').getByText('Via Norte Fretes')).toBeVisible()

  await page.locator('main tbody').getByRole('link', { name: 'Via Norte Fretes' }).click()
  await expect(page.locator('main h1')).toHaveText('Via Norte Fretes')
  await page.getByRole('tab', { name: /Motoristas/ }).click()
  await expect(page.locator('main tbody').getByText('Eduardo Pires')).toBeVisible()
})

test('motoristas: CPF repetido mostra erro no campo', async ({ page }) => {
  await abrir(page, '/motoristas?aberto=mot00002')
  const painel = page.getByRole('dialog')
  const cpfAntonio = await page.evaluate(async () => {
    const r = await fetch('/api/motoristas/mot00001')
    return ((await r.json()) as { cpf: string }).cpf
  })
  await painel.getByLabel(/^CPF/).fill(cpfAntonio)
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(painel.getByText('Já existe um motorista com este CPF.')).toBeVisible()
})

test('transportadoras: nova com motorista da lista e motorista novo', async ({ page }) => {
  await abrir(page, '/transportadoras')
  await page.getByRole('button', { name: 'Nova transportadora' }).first().click()
  const painel = page.getByRole('dialog')
  await painel.getByLabel(/^Nome/).first().fill('Estrada Livre')
  await painel.getByLabel(/^CNPJ/).fill(CNPJ_NOVO)
  // Motorista da lista (Daniela está sem transportadora).
  await painel.getByRole('combobox', { name: 'Adicionar motorista da lista…' }).click()
  await page.getByRole('option', { name: /Daniela Rocha/ }).click()
  // Motorista que ainda não existe.
  await painel.getByRole('button', { name: 'Cadastrar novo motorista' }).click()
  const novo = painel.getByRole('list', { name: 'Cadastrar novo motorista' })
  await novo.getByLabel(/^Nome completo/).fill('Fábio Nunes')
  await novo.getByLabel(/^CPF/).fill(CPF_OUTRO)
  await novo.getByLabel(/^Telefone/).fill('11977776666')
  expect(await violacoes(page)).toEqual([])
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Transportadora Estrada Livre cadastrada.')).toBeVisible()
  await expect(page.locator('main h1')).toHaveText('Estrada Livre')
  await page.getByRole('tab', { name: /Motoristas/ }).click()
  await expect(page.locator('main tbody tr')).toHaveCount(2)
  await expect(page.locator('main tbody')).toContainText('Daniela Rocha')
  await expect(page.locator('main tbody')).toContainText('Fábio Nunes')
})

test('transportadoras: motorista de outra transportadora mostra onde está hoje', async ({
  page,
}) => {
  await abrir(page, '/transportadoras/tra00003')
  await page.getByRole('button', { name: 'Editar' }).first().click()
  const painel = page.getByRole('dialog')
  await painel.getByRole('combobox', { name: 'Adicionar motorista da lista…' }).click()
  await page.getByRole('option', { name: /Antônio Ferreira.*hoje em Rápido Sul/ }).click()
  await expect(painel.getByRole('list', { name: 'Motoristas' })).toContainText(
    'hoje em Rápido Sul Transportes',
  )
  await painel.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('main h1')).toHaveText('Carga Certa Logística')
  await page.getByRole('tab', { name: /Histórico/ }).click()
  await expect(page.locator('main tbody')).toContainText('Antônio Ferreira')
})
