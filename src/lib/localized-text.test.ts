import { describe, expect, it } from 'vitest'
import {
  detectarIdioma,
  idiomasPendentes,
  revisarTraducao,
  textoNoIdioma,
  type LocalizedText,
} from './localized-text'

describe('detectarIdioma', () => {
  it.each([
    ['O cliente pediu a troca do produto com defeito.', 'pt-BR'],
    ['Separação liberada, aguardando conferência do estoque', 'pt-BR'],
    ['The customer asked to replace the defective product.', 'en'],
    ['Please check the stock before shipping the order', 'en'],
    ['客戶要求更換有缺陷的產品', 'zh-TW'],
    ['订单已发货', 'zh-TW'],
    ['Pedido PV-2026-000184: 客戶要求優先揀貨', 'zh-TW'],
  ] as const)('"%s" → %s (independe do idioma da tela)', (texto, esperado) => {
    for (const tela of ['pt-BR', 'en', 'zh-TW'] as const) {
      const d = detectarIdioma(texto, tela)
      expect(d.idioma).toBe(esperado)
      expect(d.confiavel).toBe(true)
    }
  })

  it('texto curto ou ambíguo usa o idioma da tela como palpite', () => {
    expect(detectarIdioma('Total', 'en')).toEqual({ idioma: 'en', confiavel: false })
    expect(detectarIdioma('Notebooks', 'pt-BR')).toEqual({ idioma: 'pt-BR', confiavel: false })
    expect(detectarIdioma('   ', 'zh-TW')).toEqual({ idioma: 'zh-TW', confiavel: false })
  })
})

describe('textoNoIdioma', () => {
  const v: LocalizedText = {
    origem: 'pt-BR',
    textos: { 'pt-BR': 'Monitores', en: 'Monitors' },
    automaticos: ['en'],
  }

  it('devolve a tradução e marca se é automática', () => {
    expect(textoNoIdioma(v, 'en')).toMatchObject({ texto: 'Monitors', automatico: true })
    expect(textoNoIdioma(v, 'pt-BR')).toMatchObject({ texto: 'Monitores', automatico: false })
  })

  it('sem tradução, volta para o original e marca pendente', () => {
    expect(textoNoIdioma(v, 'zh-TW')).toMatchObject({
      texto: 'Monitores',
      idioma: 'pt-BR',
      pendente: true,
    })
    expect(idiomasPendentes(v)).toEqual(['zh-TW'])
  })

  it('aceita texto simples (legado)', () => {
    expect(textoNoIdioma('Só português', 'en').texto).toBe('Só português')
  })

  it('correção manual deixa de ser automática', () => {
    const r = revisarTraducao(v, 'en', 'Displays')
    expect(r.textos.en).toBe('Displays')
    expect(r.automaticos).toEqual([])
  })
})
