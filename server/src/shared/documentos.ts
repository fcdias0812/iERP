/*
 * Documentos e formatos brasileiros (mesmas regras de src/lib/validators/br.ts do frontend).
 * Guardamos sempre o valor LIMPO (sem pontuação); a tela formata.
 */

const soDigitos = (v: string) => v.replace(/\D/g, '')

/** Letras e números, em maiúsculas (CNPJ alfanumérico). */
export const soAlfanumerico = (v: string) => v.replace(/[^0-9a-z]/gi, '').toUpperCase()

/**
 * CNPJ numérico ou alfanumérico (IN RFB 2.229/2024): 12 posições com letras/números + 2 dígitos
 * verificadores. Cada caractere vale (código ASCII − 48).
 */
export function cnpjValido(valor: string): boolean {
  const v = soAlfanumerico(valor)
  if (!/^[0-9A-Z]{12}\d{2}$/.test(v)) return false
  if (/^(\d)\1{13}$/.test(v)) return false
  const vals = v.split('').map((c) => c.charCodeAt(0) - 48)
  const dv = (len: number) => {
    const pesos =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const r = pesos.reduce((acc, p, i) => acc + p * vals[i]!, 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === vals[12] && dv(13) === vals[13]
}

/** CNPJ com pontuação: 12.ABC.345/01DE-35. */
export function formatarCnpj(valor: string): string {
  const v = soAlfanumerico(valor)
  if (v.length !== 14) return valor
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`
}

/** Telefone com DDD: fixo (10 dígitos) ou celular (11, começando com 9). */
export function telefoneValido(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length === 10) return /^[1-9]{2}[2-8]\d{7}$/.test(d)
  if (d.length === 11) return /^[1-9]{2}9\d{8}$/.test(d)
  return false
}

export const limparTelefone = soDigitos

/** CPF: 11 dígitos, dois dígitos verificadores (módulo 11). */
export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const n = d.split('').map(Number)
  const dv = (len: number) => {
    const soma = n.slice(0, len).reduce((acc, x, i) => acc + x * (len + 1 - i), 0)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === n[9] && dv(10) === n[10]
}

export const limparCpf = soDigitos
