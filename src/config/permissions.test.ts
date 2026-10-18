import { describe, expect, it } from 'vitest'
import { can } from './permissions'

describe('permissões', () => {
  it('admin pode tudo', () => {
    expect(can('admin', 'admin.ver')).toBe(true)
    expect(can('admin', 'comercial.excluir')).toBe(true)
  })

  it('operação vê, cria e edita, mas não exclui nem entra na administração', () => {
    expect(can('operacao', 'comercial.ver')).toBe(true)
    expect(can('operacao', 'comercial.criar')).toBe(true)
    expect(can('operacao', 'comercial.excluir')).toBe(false)
    expect(can('operacao', 'compras.aprovar')).toBe(true)
    expect(can('operacao', 'admin.ver')).toBe(false)
  })

  it('leitura só vê', () => {
    expect(can('leitura', 'estoque.ver')).toBe(true)
    expect(can('leitura', 'estoque.criar')).toBe(false)
    expect(can('leitura', 'compras.aprovar')).toBe(false)
    expect(can('leitura', 'admin.ver')).toBe(false)
  })

  it('item sem permissão declarada é livre', () => {
    expect(can('leitura', undefined)).toBe(true)
  })
})
