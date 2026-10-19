import { describe, expect, it } from 'vitest'
import { ACESSO_TOTAL, can, type PermissoesDoPerfil } from './permissions'

/* Perfis de acesso: nível por página (sem acesso / visualizar / editar); Administrador pode tudo. */

const recebimento: PermissoesDoPerfil = {
  fixo: false,
  paginas: { 'operacao.recebimento': 'editar', 'operacao.lotes': 'ver', clientes: 'ver' },
}

describe('permissões por página', () => {
  it('Administrador (fixo) pode tudo', () => {
    expect(can(ACESSO_TOTAL, 'admin.perfis.editar')).toBe(true)
    expect(can(ACESSO_TOTAL, 'ordens.lotes.excluir')).toBe(true)
  })

  it('editar permite todas as ações da página', () => {
    for (const acao of ['ver', 'criar', 'editar', 'excluir', 'exportar'])
      expect(can(recebimento, `operacao.recebimento.${acao}`)).toBe(true)
  })

  it('visualizar permite ver e exportar, nada mais', () => {
    expect(can(recebimento, 'operacao.lotes.ver')).toBe(true)
    expect(can(recebimento, 'operacao.lotes.exportar')).toBe(true)
    expect(can(recebimento, 'operacao.lotes.editar')).toBe(false)
    expect(can(recebimento, 'clientes.criar')).toBe(false)
  })

  it('página fora do perfil = sem acesso; sem perfil = nada; sem permissão exigida = livre', () => {
    expect(can(recebimento, 'ordens.lotes.ver')).toBe(false)
    expect(can(null, 'clientes.ver')).toBe(false)
    expect(can(null, undefined)).toBe(true)
  })
})
