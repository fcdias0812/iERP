import { describe, expect, it } from 'vitest'
import { NOVIDADES } from './novidades'

/* As Novidades: a mais nova primeiro, versões e datas válidas, os 3 idiomas com os mesmos itens. */

const numero = (v: string) => v.split('.').map(Number)

describe('novidades', () => {
  it('versão "N.N", sem repetir, da mais nova para a mais antiga', () => {
    for (const n of NOVIDADES) expect(n.versao).toMatch(/^\d+\.\d+$/)
    expect(new Set(NOVIDADES.map((n) => n.versao)).size).toBe(NOVIDADES.length)
    for (let i = 1; i < NOVIDADES.length; i++) {
      const [a1, a2] = numero(NOVIDADES[i - 1]!.versao)
      const [b1, b2] = numero(NOVIDADES[i]!.versao)
      expect(a1! > b1! || (a1 === b1 && a2! > b2!)).toBe(true)
    }
  })

  it('data AAAA-MM-DD, sem voltar no tempo', () => {
    for (const n of NOVIDADES) expect(n.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    for (let i = 1; i < NOVIDADES.length; i++)
      expect(NOVIDADES[i - 1]!.data >= NOVIDADES[i]!.data).toBe(true)
  })

  it('os 3 idiomas com a mesma quantidade de itens, nenhum vazio', () => {
    for (const n of NOVIDADES) {
      const pt = n.itens['pt-BR']
      expect(pt.length).toBeGreaterThan(0)
      expect(n.itens.en).toHaveLength(pt.length)
      expect(n.itens['zh-TW']).toHaveLength(pt.length)
      for (const item of [...pt, ...n.itens.en, ...n.itens['zh-TW']])
        expect(item.trim()).not.toBe('')
    }
  })
})
