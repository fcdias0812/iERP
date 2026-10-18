import { enUS, ptBR, zhTW, type Locale } from 'date-fns/locale'
import i18n from '@/i18n'
import type { Language } from '@/stores/ui-store'

/*
 * Formatos conforme o idioma (pt-BR: dd/mm/aaaa, R$ 1.234,56) e sempre no fuso
 * da empresa. A formatação usa a API nativa Intl (com `timeZone`), que já
 * converte o instante para o fuso — sem pacote extra.
 * date-fns entra onde precisa de locale (seletor de data, cálculos): `dateFnsLocale()`.
 */

export const TIME_ZONE = 'America/Sao_Paulo'
export const CURRENCY = 'BRL'

const DATE_FNS_LOCALES: Record<Language, Locale> = { 'pt-BR': ptBR, en: enUS, 'zh-TW': zhTW }

type DateInput = Date | string | number

function currentLang(): Language {
  return (i18n.language as Language | undefined) ?? 'pt-BR'
}

function toDate(value: DateInput): Date {
  if (value instanceof Date) return value
  // Data sem hora ("2026-10-26") é um DIA: o JS leria como meia-noite UTC, que no fuso de
  // São Paulo ainda é o dia anterior. Lê como meio-dia no fuso da empresa.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Date(`${value}T12:00:00-03:00`)
  return new Date(value)
}

function isValid(d: Date) {
  return !Number.isNaN(d.getTime())
}

/** Valor vazio exibido nas telas (cinza "—"). */
export const EMPTY = '—'

export function dateFnsLocale(lang: Language = currentLang()): Locale {
  return DATE_FNS_LOCALES[lang]
}

/** 15/10/2026 */
export function formatDate(value: DateInput | null | undefined, lang = currentLang()): string {
  if (value == null) return EMPTY
  const d = toDate(value)
  if (!isValid(d)) return EMPTY
  return new Intl.DateTimeFormat(lang, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** 15/10/2026, 14:30 */
export function formatDateTime(value: DateInput | null | undefined, lang = currentLang()): string {
  if (value == null) return EMPTY
  const d = toDate(value)
  if (!isValid(d)) return EMPTY
  return new Intl.DateTimeFormat(lang, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** R$ 1.234,56 (sempre em reais; o símbolo segue o idioma). */
export function formatCurrency(value: number | null | undefined, lang = currentLang()): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return new Intl.NumberFormat(lang, { style: 'currency', currency: CURRENCY }).format(value)
}

/** 1.234,5 */
export function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = {},
  lang = currentLang(),
): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 2, ...options }).format(value)
}

/** 0.125 → 12,5% */
export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 1,
  lang = currentLang(),
): string {
  if (value == null || Number.isNaN(value)) return EMPTY
  return new Intl.NumberFormat(lang, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/** "há 5 minutos", "em 2 dias". Use com a data completa no tooltip. */
export function formatRelative(
  value: DateInput | null | undefined,
  now: DateInput = new Date(),
  lang = currentLang(),
): string {
  if (value == null) return EMPTY
  const d = toDate(value)
  if (!isValid(d)) return EMPTY
  const diff = (d.getTime() - toDate(now).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs || unit === 'second') {
      return rtf.format(Math.round(diff / secs), unit)
    }
  }
  return EMPTY
}

/** Tamanho de arquivo: 512 B, 1,5 KB, 2,3 MB. */
export function formatBytes(bytes: number, lang = currentLang()): string {
  if (bytes < 1024) return `${formatNumber(bytes, {}, lang)} B`
  if (bytes < 1024 ** 2)
    return `${formatNumber(bytes / 1024, { maximumFractionDigits: 1 }, lang)} KB`
  return `${formatNumber(bytes / 1024 ** 2, { maximumFractionDigits: 1 }, lang)} MB`
}

/* ------------------------------------------------------------ documentos (guardados sem pontuação) */

/** CNPJ (numérico ou alfanumérico) com pontuação: 12.ABC.345/01DE-35. Inválido → como veio. */
export function formatCnpj(value: string | null | undefined): string {
  if (!value) return EMPTY
  const v = value.replace(/[^0-9a-z]/gi, '').toUpperCase()
  if (v.length !== 14) return value
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`
}

/** Telefone com DDD: (11) 98765-4321 ou (11) 3234-5678. Outro formato → como veio. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return EMPTY
  const d = value.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return value
}
