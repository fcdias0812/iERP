/*
 * Geradores de documentos FICTÍCIOS com dígitos verificadores válidos
 * (passam nos validadores de src/lib/validators/br.ts). Só para dados de teste.
 */

type Rand = () => number

const digits = (rand: Rand, n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10))

export function gerarCpf(rand: Rand, formatado = true): string {
  const n = digits(rand, 9)
  const dv = (len: number) => {
    const sum = n.slice(0, len).reduce((acc, d, i) => acc + d * (len + 1 - i), 0)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  n.push(dv(9))
  n.push(dv(10))
  const s = n.join('')
  return formatado ? `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}` : s
}

export function gerarCnpj(rand: Rand, formatado = true): string {
  // 8 dígitos de raiz + filial 0001
  const n = [...digits(rand, 8), 0, 0, 0, 1]
  const dv = (len: number) => {
    const w =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const r = w.reduce((acc, x, i) => acc + x * n[i]!, 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  n.push(dv(12))
  n.push(dv(13))
  const s = n.join('')
  return formatado
    ? `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`
    : s
}

/** Gerador pseudoaleatório com semente (mulberry32): mesmos dados a cada recarga. */
export function seeded(seed: number): Rand {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
