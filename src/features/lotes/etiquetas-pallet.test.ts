import { describe, expect, it } from 'vitest'
import { etiquetasDosPallets, htmlDasEtiquetas } from './etiquetas-pallet'

const ROTULOS = {
  sistema: 'Re-Teck · iERP',
  pallet: 'Pallet',
  data: 'Data',
  bruto: 'Peso bruto',
  tara: 'Tara',
  liquido: 'Peso líquido',
}

describe('etiquetas de pallet', () => {
  const etiquetas = etiquetasDosPallets({
    cliente: 'Cliente <&> Ltda',
    lote: 'LOT-00012',
    data: '2026-10-27',
    pallets: [
      { bruto: 120.5, tara: 20 },
      { bruto: 80, tara: null },
    ],
  })

  it('uma por pallet, com a posição e o líquido só quando há tara', () => {
    expect(etiquetas.map((e) => [e.posicao, e.total, e.liquido])).toEqual([
      [1, 2, 100.5],
      [2, 2, null],
    ])
  })

  it('o HTML tem uma página por pallet, o QR do lote e o texto escapado', async () => {
    const html = await htmlDasEtiquetas(etiquetas, ROTULOS, 'https://ierp/operacao/lotes/x')
    expect(html.match(/<section class="etq">/g)).toHaveLength(2)
    expect(html.match(/<svg/g)).toHaveLength(2)
    expect(html).toContain('Cliente &lt;&amp;&gt; Ltda')
    expect(html).toContain('Pallet 1/2')
    expect(html).toContain('27/10/2026')
    expect(html).toContain('@page { size: 100mm 70mm')
    // Sem tara, a etiqueta não inventa o líquido.
    expect(html.match(/Peso líquido/g)).toHaveLength(1)
  })
})
