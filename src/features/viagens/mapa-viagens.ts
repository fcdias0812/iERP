/*
 * Tipos e preferências leves do mapa de Viagens (a página importa daqui sem puxar o Leaflet, que
 * só carrega com o mapa).
 */

export interface CamadasMapa {
  transito: boolean
  pois: boolean
  pontos: boolean
}

export interface CaixaMapa {
  s: number
  w: number
  n: number
  e: number
}

const CHAVE = 'ierp.viagens.camadas.v1'
const PADRAO: CamadasMapa = { transito: false, pois: false, pontos: true }

export function lerCamadas(): CamadasMapa {
  try {
    const salvo = JSON.parse(globalThis.localStorage?.getItem(CHAVE) ?? 'null') as unknown
    if (salvo && typeof salvo === 'object')
      return {
        transito: (salvo as CamadasMapa).transito === true,
        pois: (salvo as CamadasMapa).pois === true,
        pontos: (salvo as CamadasMapa).pontos !== false,
      }
  } catch {
    /* sem armazenamento */
  }
  return PADRAO
}

export function gravarCamadas(c: CamadasMapa) {
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(c))
  } catch {
    // Sem armazenamento (janela privada): vale só nesta visita.
  }
}

/** A região arredondada (meio grau) — muda pouco ao arrastar, e o servidor guarda por célula. */
export function arredondarCaixa(c: CaixaMapa | null): CaixaMapa | null {
  if (!c) return null
  const baixo = (v: number) => Math.floor(v * 2) / 2
  const cima = (v: number) => Math.ceil(v * 2) / 2
  return { s: baixo(c.s), w: baixo(c.w), n: cima(c.n), e: cima(c.e) }
}
