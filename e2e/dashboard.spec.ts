import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'
import { irSemRecarregar, loteAgendado } from './lotes-helpers'

/*
 * Operação › Dashboard (API simulada, com lotes fictícios em processo): cards de SLA, situação
 * por cliente, anomalias de prazo, controles do mapa e acessibilidade. Tiles do mapa
 * bloqueados (o teste não depende de internet).
 */

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|arcgis\.com/, (r) => r.abort())
})

test('cards e tabelas calculados pelo SLA do cliente', async ({ page }) => {
  await abrir(page, '/operacao/dashboard')
  const cards = page.getByRole('region', { name: 'Dashboard da operação' })
  await expect(cards).toContainText(/Lotes em processo\s*4\s*lotes/)
  await expect(cards).toContainText(/SLA vencido\s*1\s*lotes/)
  await expect(cards).toContainText(/SLA em risco\s*1\s*lotes/)
  await expect(cards).toContainText('50%')
  await expect(cards).toContainText(/COD pendente\s*1\s*lotes/)

  // Situação por cliente: o atrasado aparece primeiro.
  const porCliente = page.locator('main [data-slot="card"]', {
    hasText: 'Situação dos pedidos por cliente',
  })
  await expect(porCliente.locator('tbody tr').first()).toContainText('Atrasado')

  // Anomalias: só as anomalias por padrão; "Todos em processo" mostra os 4.
  await expect(page.getByRole('button', { name: /Só anomalias/ })).toContainText('(2)')
  const anomalias = page.locator('main [data-slot="card"]', { hasText: 'Pedidos com anomalia' })
  await expect(anomalias.locator('tbody tr').first()).toContainText('LOT-90001')
  await expect(anomalias.locator('tbody tr').first()).toContainText('Atrasado 5 dias')
  await page.getByRole('button', { name: /Todos em processo/ }).click()
  await expect(anomalias.locator('tbody tr')).toHaveCount(4)

  expect(await violacoes(page)).toEqual([])
})

test('mapa: troca o período e o fundo', async ({ page }) => {
  await abrir(page, '/operacao/dashboard')
  await expect(page.getByRole('region', { name: 'Mapa dos datacenters Microsoft' })).toBeVisible()
  await page.getByRole('button', { name: 'Mês', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mês', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Cinza' }).click()
  await expect(page.getByRole('button', { name: 'Cinza' })).toHaveAttribute('aria-pressed', 'true')
  // O mapa continua montado (antes, trocar o fundo apagava as classes do Leaflet: mapa em branco).
  const mapa = page.getByRole('region', { name: 'Mapa dos datacenters Microsoft' })
  await expect(mapa).toHaveClass(/leaflet-container/)
  await expect(mapa.locator('.leaflet-tile-pane')).toHaveCSS('filter', 'grayscale(1)')
  await page.getByRole('button', { name: 'Limpo' }).click()
  await expect(mapa).toHaveClass(/leaflet-container/)
  // Sem chave da Esri, o fundo Satélite não aparece.
  await expect(page.getByRole('button', { name: 'Satélite' })).toHaveCount(0)
})

test('forecast: borda tracejada (prevista) ou contínua (confirmada); detalhes ao passar o mouse', async ({
  page,
}) => {
  const dia = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  }
  await loteAgendado(page, { coletaPrevista: dia(1) })
  await loteAgendado(page, { coletaPrevista: dia(2), dataColeta: dia(2) })
  await irSemRecarregar(page, '/operacao/dashboard')
  const prevista = page.locator('a[data-confirmada="false"]')
  const confirmada = page.locator('a[data-confirmada="true"]')
  await expect(prevista).toHaveCSS('border-top-style', 'dashed')
  await expect(confirmada).toHaveCSS('border-top-style', 'solid')
  await expect(prevista).toContainText('Data prevista') // texto para leitor de tela

  await prevista.hover()
  const janela = page.locator('[data-slot="hover-card-content"]')
  await expect(janela).toContainText('Coleta prevista')
  await expect(janela).toContainText('Pré-cálculo')
  await expect(janela).toContainText('SPO-01')
  // O mouse entra na janela e ela continua aberta (dá para selecionar o texto).
  await janela.getByRole('link', { name: 'Abrir o lote' }).hover()
  await expect(janela).toBeVisible()
  expect(await violacoes(page)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(janela).toHaveCount(0)
})
