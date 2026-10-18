/*
 * Validadores de documentos e formatos brasileiros.
 * Todos aceitam o valor com ou sem máscara.
 */

const onlyDigits = (v: string) => v.replace(/\D/g, '')

/** Mantém letras e números, em maiúsculas (CNPJ alfanumérico, placa). */
const alnumUpper = (v: string) => v.replace(/[^0-9a-z]/gi, '').toUpperCase()

/** CPF: 11 dígitos, dois dígitos verificadores (módulo 11). */
export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const nums = d.split('').map(Number)
  const dv = (len: number) => {
    const sum = nums.slice(0, len).reduce((acc, n, i) => acc + n * (len + 1 - i), 0)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === nums[9] && dv(10) === nums[10]
}

/**
 * CNPJ numérico ou alfanumérico (IN RFB 2.229/2024, em produção desde jul/2026):
 * as 12 primeiras posições aceitam letras e números; os 2 dígitos verificadores
 * são numéricos. Cada caractere vale (código ASCII − 48): '0'..'9' → 0..9, 'A' → 17.
 */
export function isValidCnpj(value: string): boolean {
  const v = alnumUpper(value)
  if (!/^[0-9A-Z]{12}\d{2}$/.test(v)) return false
  if (/^(\d)\1{13}$/.test(v)) return false
  const vals = v.split('').map((c) => c.charCodeAt(0) - 48)
  const dv = (len: number) => {
    const weights =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((acc, w, i) => acc + w * vals[i]!, 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === vals[12] && dv(13) === vals[13]
}

/** CEP: 8 dígitos. */
export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8
}

/** Telefone BR com DDD: fixo (10 dígitos) ou celular (11, começando com 9). */
export function isValidPhone(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length === 10) return /^[1-9]{2}[2-8]\d{7}$/.test(d)
  if (d.length === 11) return /^[1-9]{2}9\d{8}$/.test(d)
  return false
}

/** Placa: padrão antigo (ABC1234) ou Mercosul (ABC1D23). */
export function isValidPlate(value: string): boolean {
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(alnumUpper(value))
}
