import { describe, expect, it } from 'vitest'
import { GRUPOS_DE_PAGINAS, PAGINAS } from './paginas'

/* As páginas dos Perfis de acesso saem do menu; o servidor tem a mesma lista (espelho). */

const servidor = Object.values(
  import.meta.glob<string>('../../server/src/shared/paginas.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0]!

describe('páginas dos perfis de acesso', () => {
  it('são as mesmas do servidor (server/src/shared/paginas.ts), na mesma ordem', () => {
    const lista = servidor.slice(servidor.indexOf('PAGINAS = ['), servidor.indexOf('] as const'))
    const doServidor = [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(PAGINAS).toEqual(doServidor)
  })

  it('agrupa os módulos sem submenu pela seção do menu; Início fica de fora', () => {
    expect(GRUPOS_DE_PAGINAS[0]).toMatchObject({
      id: 'relacionamento',
      paginas: [
        { chave: 'clientes' },
        { chave: 'transportadoras' },
        { chave: 'veiculos' },
        { chave: 'motoristas' },
      ],
    })
    expect(PAGINAS).not.toContain('inicio')
    expect(new Set(PAGINAS).size).toBe(PAGINAS.length)
  })
})
