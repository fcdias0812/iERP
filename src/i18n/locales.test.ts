import { describe, expect, it } from 'vitest'
import ptBR from './locales/pt-BR.json'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'

/** Lista as chaves "folha" de um objeto de tradução (a.b.c). */
function keys(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`]
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
  }
  return [prefix]
}

describe('arquivos de idioma', () => {
  const base = keys(ptBR).sort()

  it.each([
    ['en', en],
    ['zh-TW', zhTW],
  ])('%s tem exatamente as mesmas chaves do pt-BR', (_, locale) => {
    expect(keys(locale).sort()).toEqual(base)
  })
})
