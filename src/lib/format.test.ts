import { describe, expect, it } from 'vitest'
import {
  EMPTY,
  formatCnpj,
  formatCpf,
  formatDayMonth,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatPhone,
  formatRelative,
  formatTime,
  formatWeekday,
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

  it('hora, dia/mês e dia da semana no fuso de São Paulo', () => {
    expect(formatTime('2026-10-19T09:25:06Z', 'pt-BR')).toBe('06:25:06')
    expect(formatDayMonth('2026-10-21', 'pt-BR')).toBe('21/10')
    expect(formatWeekday('2026-10-21', 'pt-BR')).toBe('qua.')
    expect(formatWeekday('2026-10-21', 'en')).toBe('Wed')
    expect(formatTime(null)).toBe(EMPTY)
  })

  it('CNPJ, CPF e telefone guardados sem pontuação', () => {
    expect(formatCnpj('11444777000161')).toBe('11.444.777/0001-61')
    expect(formatCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35')
    expect(formatCnpj('123')).toBe('123')
    expect(formatCnpj(null)).toBe(EMPTY)
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
    expect(formatPhone('1132345678')).toBe('(11) 3234-5678')
    expect(formatPhone('')).toBe(EMPTY)
    expect(formatCpf('12345678909')).toBe('123.456.789-09')
    expect(formatCpf(null)).toBe(EMPTY)
  })
})
