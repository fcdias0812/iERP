import { afterEach, describe, expect, it, vi } from 'vitest'
import { completarTraducoes, criarTextoTraduzido, quebrarTexto, traduzir } from './traducao'

/** Resposta falsa do MyMemory: devolve "[para] texto". */
function mockMyMemory(responder?: (q: string, langpair: string) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const q = url.searchParams.get('q') ?? ''
    const langpair = url.searchParams.get('langpair') ?? ''
    if (responder) return responder(q, langpair)
    return Response.json({
      responseData: { translatedText: `[${langpair.split('|')[1]}] ${q}` },
      responseStatus: 200,
      quotaFinished: false,
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('quebrarTexto', () => {
  const bytes = (s: string) => new TextEncoder().encode(s).length

  it('mantém textos curtos inteiros', () => {
    expect(quebrarTexto('Olá. Tudo bem?')).toEqual([{ parte: 'Olá. Tudo bem?', sep: '' }])
  })

  it('quebra textos longos em pedaços de até 450 bytes, por frase', () => {
    const frase = 'O cliente pediu a troca do produto com defeito na tela. '
    const partes = quebrarTexto(frase.repeat(20))
    expect(partes.length).toBeGreaterThan(1)
    for (const p of partes) expect(bytes(p.parte)).toBeLessThanOrEqual(450)
    expect(partes.map((p) => p.parte + p.sep).join('')).toBe(frase.repeat(20))
  })

  it('quebra chinês sem espaços (3 bytes por caractere)', () => {
    const texto = '客戶要求更換有缺陷的產品'.repeat(30)
    const partes = quebrarTexto(texto)
    for (const p of partes) expect(bytes(p.parte)).toBeLessThanOrEqual(450)
    expect(partes.map((p) => p.parte + p.sep).join('')).toBe(texto)
  })
})

describe('traduzir (MyMemory)', () => {
  it('chama o serviço com o par de idiomas e o e-mail da cota', async () => {
    const f = mockMyMemory()
    expect(await traduzir('Monitores', 'pt-BR', 'en')).toBe('[en-US] Monitores')
    const url = new URL(String(f.mock.calls[0]![0]))
    expect(url.searchParams.get('langpair')).toBe('pt-BR|en-US')
    expect(url.searchParams.get('de')).toBe('rtbrti03@re-teckbr.com')
  })

  it('reconhece cota esgotada', async () => {
    mockMyMemory(() =>
      Response.json({
        responseData: {
          translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS',
        },
        responseStatus: 429,
        quotaFinished: true,
      }),
    )
    await expect(traduzir('Teclados novos', 'pt-BR', 'en')).rejects.toMatchObject({
      motivo: 'cota',
    })
  })
})

describe('criarTextoTraduzido', () => {
  it('detecta o idioma escrito (não o da tela) e traduz para os outros dois', async () => {
    mockMyMemory()
    const r = await criarTextoTraduzido('The customer asked for priority.', 'pt-BR')
    expect(r.falhas).toEqual([])
    expect(r.valor.origem).toBe('en')
    expect(r.valor.textos).toEqual({
      en: 'The customer asked for priority.',
      'pt-BR': '[pt-BR] The customer asked for priority.',
      'zh-TW': '[zh-TW] The customer asked for priority.',
    })
    expect(r.valor.automaticos?.sort()).toEqual(['pt-BR', 'zh-TW'])
  })

  it('sem internet: salva só o original e deixa os outros pendentes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const r = await criarTextoTraduzido('Cliente pediu prioridade na separação.', 'en')
    expect(r.valor.textos).toEqual({ 'pt-BR': 'Cliente pediu prioridade na separação.' })
    expect(r.falhas.sort()).toEqual(['en', 'zh-TW'])
    expect(r.motivo).toBe('rede')

    mockMyMemory()
    const depois = await completarTraducoes(r.valor)
    expect(depois.falhas).toEqual([])
    expect(Object.keys(depois.valor.textos).sort()).toEqual(['en', 'pt-BR', 'zh-TW'])
  })
})
