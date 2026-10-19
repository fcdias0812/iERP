import { expect, type Page } from '@playwright/test'
import { abrir } from './helpers'

/* Ajudantes dos e2e de lote (detalhe do lote e recebimento), sobre a API simulada. */

/** Tradução automática simulada (o MyMemory não é chamado nos testes). */
export async function traducaoSimulada(page: Page) {
  await page.route('**/api.mymemory.translated.net/**', (route) =>
    route.fulfill({
      json: { responseStatus: 200, responseData: { translatedText: 'texto traduzido' } },
    }),
  )
}

/** Foto de teste (PNG 2×2). */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==',
  'base64',
)

/** Cria um lote AGENDADO na API simulada (como o Agendamento faz) e devolve o id. */
export async function loteAgendado(page: Page) {
  await abrir(page, '/ordens/lotes')
  return page.evaluate(async () => {
    const sites = (await (await fetch('/api/clientes/cli00001/sites')).json()) as {
      id: string
      docas: { id: string }[]
    }[]
    const form = new FormData()
    form.set(
      'dados',
      JSON.stringify({
        clienteId: 'cli00001',
        siteId: sites[0]!.id,
        docaId: sites[0]!.docas[0]!.id,
        transportadoraId: null,
        referenciaCliente: 'PO-1',
        dataColeta: '2026-11-10',
        coletaPrevista: null,
        dataChegada: null,
        rastrear: false,
        motoristaId: null,
        placa: null,
        servicos: {
          psm: false,
          onsiteShredding: false,
          recycleOnly: true,
          valueRecoveryRacks: false,
          valueRecoveryItad: false,
        },
        quantidades: {
          boxes: null,
          pallets: 4,
          gaylords: null,
          racks: null,
          placasPolicarbonato: null,
          requerPalletsVazios: false,
          palletsVazios: null,
          itensMais25kg: false,
          fatorLimitante: null,
        },
        escopo: 'Coleta de pallets.',
        observacoes: null,
      }),
    )
    const r = await fetch('/api/ordens', { method: 'POST', body: form })
    return ((await r.json()) as { id: string }).id
  })
}

/**
 * Abre uma rota SEM recarregar a página (recarregar zera a API simulada e o lote criado some).
 */
export async function irSemRecarregar(page: Page, url: string) {
  await page.evaluate((u) => {
    history.pushState({}, '', u)
    dispatchEvent(new PopStateEvent('popstate'))
  }, url)
  await expect(page.locator('main h1').first()).toBeVisible()
}
