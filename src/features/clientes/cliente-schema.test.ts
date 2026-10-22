import { describe, expect, it } from 'vitest'
import { getDb } from '@/mocks/db'
import { isValidCnpj, isValidPhone } from '@/lib/validators/br'
import type { Cliente } from '@/services/types'
import { CONFIGURACOES_PADRAO } from './configuracoes'
import { clienteParaForm, clienteSchema, formParaInput } from './cliente-schema'

const cliente: Cliente = {
  id: 'c1',
  codigo: 'CLI-00001',
  nome: 'Teste Ltda',
  cnpj: '12ABC34501DE35',
  slaDias: 15,
  status: 'ativo',
  configuracoes: CONFIGURACOES_PADRAO,
  rastreioToken: null,
  contatos: [
    { id: 'k2', nome: null, email: 'b@teste.com.br', telefone: '1132345678', principal: false },
    { id: 'k1', nome: 'Ana', email: 'a@teste.com.br', telefone: '11987654321', principal: true },
  ],
  criadoEm: '2026-10-18T12:00:00Z',
  criadoPor: 'Sistema',
  alteradoEm: '2026-10-18T12:00:00Z',
  alteradoPor: 'Sistema',
  historico: [],
  acoesPermitidas: ['inativar'],
}

describe('formulário do cliente', () => {
  it('o principal vai para o topo e volta como o único principal', () => {
    const form = clienteParaForm(cliente)
    expect(form.contatos[0]?.email).toBe('a@teste.com.br')
    const input = formParaInput(clienteSchema.parse(form))
    expect(input.contatos.map((c) => c.principal)).toEqual([true, false])
    expect(input.contatos[1]?.nome).toBeNull()
  })

  it('recusa CNPJ e telefone inválidos e lista sem contato', () => {
    const base = clienteParaForm(cliente)
    expect(clienteSchema.safeParse({ ...base, cnpj: '11444777000162' }).success).toBe(false)
    expect(
      clienteSchema.safeParse({
        ...base,
        contatos: [{ id: null, nome: '', email: 'a@b.com.br', telefone: '1234' }],
      }).success,
    ).toBe(false)
    expect(clienteSchema.safeParse({ ...base, contatos: [] }).success).toBe(false)
  })
})

describe('clientes da API simulada', () => {
  it('têm CNPJ e telefones válidos e exatamente um contato principal', () => {
    for (const c of getDb().clientes) {
      expect(isValidCnpj(c.cnpj), c.cnpj).toBe(true)
      expect(c.contatos.filter((k) => k.principal)).toHaveLength(1)
      for (const k of c.contatos) expect(isValidPhone(k.telefone), k.telefone).toBe(true)
    }
  })
})
