import { expect, test } from '@playwright/test'
import { abrir, violacoes } from './helpers'

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
  // Sem chave da Esri, o fundo Satélite não aparece.
  await expect(page.getByRole('button', { name: 'Satélite' })).toHaveCount(0)
})
