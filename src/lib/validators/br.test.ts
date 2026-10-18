import { describe, expect, it } from 'vitest'
import { isValidCep, isValidCnpj, isValidCpf, isValidPhone, isValidPlate } from './br'

describe('validadores BR', () => {
  it('CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })

  it('CNPJ numérico', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000181')).toBe(true)
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false)
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false)
  })

  it('CNPJ alfanumérico (exemplo da Receita Federal)', () => {
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true)
    expect(isValidCnpj('12abc34501de35')).toBe(true)
    expect(isValidCnpj('12.ABC.345/01DE-34')).toBe(false)
    expect(isValidCnpj('12.ABC.345/01DE-3A')).toBe(false)
  })

  it('CEP, telefone e placa', () => {
    expect(isValidCep('01310-100')).toBe(true)
    expect(isValidCep('0131010')).toBe(false)
    expect(isValidPhone('(11) 98765-4321')).toBe(true)
    expect(isValidPhone('(11) 3456-7890')).toBe(true)
    expect(isValidPhone('(11) 8765-432')).toBe(false)
    expect(isValidPlate('ABC1D23')).toBe(true)
    expect(isValidPlate('abc-1234')).toBe(true)
    expect(isValidPlate('AB12345')).toBe(false)
  })
})
