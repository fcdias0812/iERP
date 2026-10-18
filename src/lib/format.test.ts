import { describe, expect, it } from 'vitest'
import {
  EMPTY,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
} from './format'

// Intl usa espaço não separável entre "R$" e o valor; normalizamos para comparar.
const SPACES = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, 'g')
const norm = (s: string) => s.replace(SPACES, ' ')

describe('format', () => {
  it('data em pt-BR no fuso de São Paulo', () => {
    // 02:30 UTC de 16/10 = 23:30 de 15/10 em São Paulo (UTC-3).
    expect(formatDate('2026-10-16T02:30:00Z', 'pt-BR')).toBe('15/10/2026')
    expect(norm(formatDateTime('2026-10-16T02:30:00Z', 'pt-BR'))).toBe('15/10/2026, 23:30')
  })

  it('data sem hora é o próprio dia (não volta um dia pelo fuso)', () => {
    expect(formatDate('2026-10-26', 'pt-BR')).toBe('26/10/2026')
    expect(formatDate('2026-01-01', 'pt-BR')).toBe('01/01/2026')
  })

  it('data em inglês e chinês tradicional', () => {
    expect(formatDate('2026-10-15T15:00:00Z', 'en')).toBe('10/15/2026')
    expect(formatDate('2026-10-15T15:00:00Z', 'zh-TW')).toBe('2026/10/15')
  })

  it('moeda em reais', () => {
    expect(norm(formatCurrency(1234.56, 'pt-BR'))).toBe('R$ 1.234,56')
    expect(formatCurrency(1234.56, 'en')).toBe('R$1,234.56')
  })

  it('número e porcentagem', () => {
    expect(formatNumber(1234.5, {}, 'pt-BR')).toBe('1.234,5')
    expect(formatPercent(0.125, 1, 'pt-BR')).toBe('12,5%')
  })

  it('data relativa', () => {
    const now = '2026-10-15T12:00:00Z'
    expect(formatRelative('2026-10-15T11:55:00Z', now, 'pt-BR')).toBe('há 5 minutos')
    expect(formatRelative('2026-10-17T12:00:00Z', now, 'pt-BR')).toBe('depois de amanhã')
  })

  it('vazio vira traço', () => {
    expect(formatDate(null)).toBe(EMPTY)
    expect(formatCurrency(undefined)).toBe(EMPTY)
    expect(formatDate('não é data')).toBe(EMPTY)
  })
})
