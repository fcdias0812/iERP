import { normalizar } from './texto.js'

/*
 * Regiões do Brasil (lista fechada — pedido do usuário, 19/10/2026): o site do cliente guarda o
 * CÓDIGO; a tela traduz. O CEP (ViaCEP) devolve o nome ("Sudeste", "Centro-Oeste"…), convertido
 * aqui.
 */
export const REGIOES = ['norte', 'nordeste', 'centro_oeste', 'sudeste', 'sul'] as const
export type RegiaoBrasil = (typeof REGIOES)[number]

/** Código da região a partir do nome escrito ("Centro-Oeste" → centro_oeste); null se não for uma. */
export function regiaoDoTexto(texto: string | null | undefined): RegiaoBrasil | null {
  if (!texto) return null
  const chave = normalizar(texto).replace(/[^a-z]/g, '')
  return REGIOES.find((r) => r.replace('_', '') === chave) ?? null
}

const UFS: Record<RegiaoBrasil, string[]> = {
  norte: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
  nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  centro_oeste: ['DF', 'GO', 'MS', 'MT'],
  sudeste: ['ES', 'MG', 'RJ', 'SP'],
  sul: ['PR', 'RS', 'SC'],
}

/** Região da UF (sigla do estado); null se não for uma UF. */
export function regiaoDaUf(uf: string | null | undefined): RegiaoBrasil | null {
  const sigla = uf?.trim().toUpperCase()
  if (!sigla) return null
  return REGIOES.find((r) => UFS[r].includes(sigla)) ?? null
}
