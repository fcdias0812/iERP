import type { Language } from '@/stores/ui-store'

/*
 * TEXTO EM VÁRIOS IDIOMAS — para o que o USUÁRIO digita e precisa aparecer nos 3 idiomas
 * (nome de categoria, motivo, comentário operacional…).
 *
 * Ao salvar, o sistema detecta o idioma em que a pessoa escreveu (não o idioma da tela:
 * dá para usar o sistema em inglês e escrever em português), traduz para os outros dois e
 * guarda os três junto do registro. Trocar de idioma passa a ser instantâneo.
 *
 * NUNCA use em dado sigiloso (pessoal, financeiro, contrato): a tradução automática envia o
 * texto para um serviço público (ver src/services/traducao.ts). Nomes de pessoas e empresas,
 * endereços, documentos e códigos ficam como foram escritos.
 */

export const IDIOMAS: Language[] = ['pt-BR', 'en', 'zh-TW']

export interface LocalizedText {
  /** Idioma em que a pessoa escreveu (o original). */
  origem: Language
  /** Texto em cada idioma. Pode faltar idioma (tradução pendente: serviço fora do ar ou cota). */
  textos: Partial<Record<Language, string>>
  /** Idiomas traduzidos pela máquina (os demais foram escritos/revisados por gente). */
  automaticos?: Language[]
}

/** Valor de campo traduzível: texto simples (legado) ou multilíngue. */
export type TextoTraduzivel = string | LocalizedText

export function isLocalizedText(v: unknown): v is LocalizedText {
  return (
    typeof v === 'object' &&
    v !== null &&
    'origem' in v &&
    'textos' in v &&
    typeof (v as LocalizedText).textos === 'object'
  )
}

export interface TextoExibido {
  texto: string
  /** Idioma do texto devolvido (pode ser o original, se faltar tradução). */
  idioma: Language
  /** O texto exibido é tradução automática. */
  automatico: boolean
  /** Falta a tradução para o idioma pedido (mostrando o original). */
  pendente: boolean
}

/** Texto para exibir no idioma pedido; sem tradução, volta para o original. */
export function textoNoIdioma(
  v: TextoTraduzivel | null | undefined,
  idioma: Language,
): TextoExibido {
  if (v === null || v === undefined)
    return { texto: '', idioma, automatico: false, pendente: false }
  if (typeof v === 'string') return { texto: v, idioma, automatico: false, pendente: false }
  const traduzido = v.textos[idioma]
  if (traduzido)
    return {
      texto: traduzido,
      idioma,
      automatico: idioma !== v.origem && (v.automaticos ?? []).includes(idioma),
      pendente: false,
    }
  return {
    texto: v.textos[v.origem] ?? Object.values(v.textos).find(Boolean) ?? '',
    idioma: v.origem,
    automatico: false,
    pendente: true,
  }
}

/** Atalho: só a string no idioma pedido. */
export const textoEm = (v: TextoTraduzivel | null | undefined, idioma: Language) =>
  textoNoIdioma(v, idioma).texto

/** Idiomas que ainda não têm texto. */
export const idiomasPendentes = (v: LocalizedText) => IDIOMAS.filter((l) => !v.textos[l]?.trim())

/** Texto original (como a pessoa escreveu). */
export const textoOriginal = (v: TextoTraduzivel) =>
  typeof v === 'string' ? v : (v.textos[v.origem] ?? '')

/** Correção manual de uma tradução: o idioma deixa de ser "automático". */
export function revisarTraducao(v: LocalizedText, idioma: Language, texto: string): LocalizedText {
  return {
    ...v,
    textos: { ...v.textos, [idioma]: texto },
    automaticos: (v.automaticos ?? []).filter((l) => l !== idioma),
  }
}

// ---------------------------------------------------------------- detecção de idioma

/*
 * Detecção local (sem internet e sem gastar cota):
 *  - ideogramas chineses (CJK) → zh-TW;
 *  - português × inglês: acentos e palavras muito comuns de cada língua.
 * Texto curto ou ambíguo ("Total", "OK", "Notebooks") não é confiável: quem chama usa o
 * idioma da tela como palpite e mostra o idioma detectado para a pessoa corrigir.
 */

const HAN = /[㐀-䶿一-鿿豈-﫿]/g
const LETRAS = /\p{L}/gu
const ACENTOS_PT = /[ãõçáéíóúâêôàü]/gi

// Palavras exclusivas de cada língua (ambíguas como "a", "no", "do", "as" ficam de fora).
const PT = new Set(
  'de da do das dos que não nao para com uma um os em por na nas nos é foi está esta são ser mais mas como seu sua pelo pela ao aos também tem ter já ou quando muito sem até este essa isso foi pedido cliente produto entrega troca estoque nota peça peças'.split(
    ' ',
  ),
)
const EN = new Set(
  'the and of to is are was were for with this that it be not have has had from by at an you your will would can could should please order customer product delivery stock item items which what there their they been'.split(
    ' ',
  ),
)

export interface Deteccao {
  idioma: Language
  /** `false` = palpite (texto curto/ambíguo): confirme com a pessoa. */
  confiavel: boolean
}

export function detectarIdioma(texto: string, palpite: Language): Deteccao {
  const limpo = texto.trim()
  if (!limpo) return { idioma: palpite, confiavel: false }

  const han = limpo.match(HAN)?.length ?? 0
  const letras = limpo.match(LETRAS)?.length ?? 0
  if (han > 0 && han / Math.max(letras, 1) >= 0.3) return { idioma: 'zh-TW', confiavel: true }

  const palavras = limpo
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
  let pt = (limpo.match(ACENTOS_PT)?.length ?? 0) * 1.5
  let en = 0
  for (const p of palavras) {
    if (PT.has(p)) pt += 1
    if (EN.has(p)) en += 1
  }
  // Terminações típicas do português.
  for (const p of palavras) if (/(ção|ções|ão|ões|mente|inho|inha)$/.test(p)) pt += 1

  if (pt === en) return { idioma: palpite, confiavel: false }
  const idioma: Language = pt > en ? 'pt-BR' : 'en'
  return { idioma, confiavel: Math.abs(pt - en) >= 1.5 }
}
