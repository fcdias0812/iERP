import QRCode from 'qrcode'
import { useTranslation } from 'react-i18next'
import { formatDate, formatNumber } from '@/lib/format'

/*
 * ETIQUETA DE PALLET (pedido do usuário, 27/10/2026 — a mesma do iERP 1.0, mais o QR code): uma
 * por pallet, 100 × 70 mm, com cliente, lote, data, pallet i/N, peso bruto, tara e líquido e um
 * QR code que abre o lote no iERP. No recebimento novo ela sai ANTES de gravar (os pallets ainda
 * estão só no formulário — `EtiquetasDoRecebimento`); depois, pelo menu Gerar do lote, com os pesos
 * gravados.
 *
 * Vai num HTML próprio, numa janela à parte: a página do sistema tem menu, topo e painéis, e o
 * papel só deve levar a etiqueta. Etiqueta impressa = tinta preta sobre branco (não é tela; os
 * tokens de cor do sistema não se aplicam).
 */

export interface EtiquetaPallet {
  cliente: string
  lote: string
  /** Dia do recebimento ("2026-10-27"). */
  data: string
  posicao: number
  total: number
  bruto: number | null
  tara: number | null
  liquido: number | null
}

export interface RotulosEtiqueta {
  /** Topo da etiqueta ("Re-Teck · iERP"). */
  sistema: string
  pallet: string
  data: string
  bruto: string
  tara: string
  liquido: string
}

/** Uma etiqueta por pallet. Sem tara, o líquido é desconhecido (a etiqueta não inventa). */
export function etiquetasDosPallets({
  cliente,
  lote,
  data,
  pallets,
}: {
  cliente: string
  lote: string
  data: string
  pallets: { bruto: number | null; tara: number | null }[]
}): EtiquetaPallet[] {
  return pallets.map((p, i) => ({
    cliente,
    lote,
    data,
    posicao: i + 1,
    total: pallets.length,
    bruto: p.bruto,
    tara: p.tara,
    liquido:
      p.bruto !== null && p.tara !== null ? Math.round((p.bruto - p.tara) * 1000) / 1000 : null,
  }))
}

const escapar = (texto: string) =>
  texto.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

const kg = (n: number | null) =>
  n === null ? '—' : `${formatNumber(n, { maximumFractionDigits: 3 })} kg`

/** O HTML das etiquetas (uma por página) — o QR leva ao lote no iERP. */
export async function htmlDasEtiquetas(
  etiquetas: EtiquetaPallet[],
  rotulos: RotulosEtiqueta,
  urlDoLote: string,
) {
  const qr = await QRCode.toString(urlDoLote, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  const paginas = etiquetas
    .map(
      (e) => `
<section class="etq">
  <div class="topo"><span>${escapar(rotulos.sistema)}</span><span>${escapar(rotulos.pallet)} ${e.posicao}/${e.total}</span></div>
  <div class="meio">
    <div class="dados">
      <div class="cliente">${escapar(e.cliente)}</div>
      <div class="lote">${escapar(e.lote)}</div>
      <div class="linha"><b>${escapar(rotulos.data)}:</b> ${escapar(formatDate(e.data))}</div>
    </div>
    <div class="qr">${qr}</div>
  </div>
  <div class="peso"><b>${escapar(rotulos.bruto)}:</b> ${kg(e.bruto)}</div>
  ${
    e.liquido !== null
      ? `<div class="linha"><b>${escapar(rotulos.tara)}:</b> ${kg(e.tara)} · <b>${escapar(rotulos.liquido)}:</b> ${kg(e.liquido)}</div>`
      : ''
  }
</section>`,
    )
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapar(etiquetas[0]?.lote ?? '')}</title>
<style>
  @page { size: 100mm 70mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: black; background: white; }
  .etq { width: 100mm; height: 70mm; padding: 4mm 5mm; page-break-after: always; display: flex; flex-direction: column; gap: 1.5mm; overflow: hidden; }
  .etq:last-child { page-break-after: auto; }
  .topo { display: flex; justify-content: space-between; font-size: 10pt; font-weight: 700; border-bottom: 0.4mm solid black; padding-bottom: 1.5mm; }
  .meio { display: flex; gap: 3mm; align-items: flex-start; }
  .dados { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1mm; }
  .qr { width: 24mm; height: 24mm; flex: none; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .cliente { font-size: 15pt; font-weight: 700; line-height: 1.1; overflow-wrap: anywhere; max-height: 2.3em; overflow: hidden; }
  .lote { font-size: 20pt; font-weight: 800; letter-spacing: 0.02em; }
  .peso { font-size: 18pt; margin-top: auto; }
  .linha { font-size: 11pt; }
</style></head><body>${paginas}<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},150)})</script></body></html>`
}

/**
 * Abre a janela de impressão com TODAS as etiquetas (uma por página). A janela abre NA HORA do
 * clique (senão o navegador bloqueia) e recebe o HTML quando o QR fica pronto. Devolve false se o
 * navegador bloqueou a janela — quem chama avisa e o botão continua para tentar de novo.
 */
export async function imprimirEtiquetas(
  etiquetas: EtiquetaPallet[],
  rotulos: RotulosEtiqueta,
  urlDoLote: string,
) {
  const janela = window.open('', '_blank')
  if (!janela) return false
  const html = await htmlDasEtiquetas(etiquetas, rotulos, urlDoLote)
  janela.document.open()
  janela.document.write(html)
  janela.document.close()
  return true
}

/** Imprime as etiquetas do lote (o QR abre o lote em Operação › Lotes). */
export function useImprimirEtiquetas() {
  const { t } = useTranslation()
  return (etiquetas: EtiquetaPallet[], loteId: string) =>
    imprimirEtiquetas(
      etiquetas,
      {
        sistema: `Re-Teck · ${t('app.name')}`,
        pallet: t('recebimento.etiquetas.pallet'),
        data: t('recebimento.etiquetas.data'),
        bruto: t('recebimento.campos.pesoBruto'),
        tara: t('recebimento.campos.tara'),
        liquido: t('recebimento.etiquetas.liquido'),
      },
      `${window.location.origin}/operacao/lotes/${loteId}`,
    )
}
