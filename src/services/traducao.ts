import { TRADUCAO } from '@/config/traducao'
import { IDIOMAS, detectarIdioma, idiomasPendentes, type LocalizedText } from '@/lib/localized-text'
import type { Language } from '@/stores/ui-store'

/*
 * Tradução automática de textos digitados pelo usuário (MyMemory — ver src/config/traducao.ts).
 *
 * Fluxo ao salvar: detecta o idioma do texto → traduz para os outros dois → guarda os três
 * (LocalizedText). Se o serviço falhar (sem internet, cota esgotada), o texto é salvo só no
 * original e os idiomas faltantes ficam pendentes (a tela oferece "Traduzir de novo").
 *
 * Com a API real, esta lógica pode ir para o backend (cota e novas tentativas centralizadas);
 * as telas continuam recebendo/enviando LocalizedText.
 */

export type MotivoFalha = 'desligada' | 'cota' | 'rede' | 'servico'

export class TraducaoError extends Error {
  readonly motivo: MotivoFalha
  constructor(motivo: MotivoFalha, message: string) {
    super(message)
    this.name = 'TraducaoError'
    this.motivo = motivo
  }
}

/** Códigos aceitos pelo MyMemory (RFC 3066). */
const CODIGO: Record<Language, string> = { 'pt-BR': 'pt-BR', en: 'en-US', 'zh-TW': 'zh-TW' }

const bytes = (s: string) => new TextEncoder().encode(s).length

/**
 * Quebra o texto em pedaços de até `max` bytes, preferindo fim de frase, depois espaço.
 * Cada pedaço guarda o separador que vinha depois dele, para remontar o texto.
 */
export function quebrarTexto(
  texto: string,
  max = TRADUCAO.maxBytes,
): { parte: string; sep: string }[] {
  const frases = texto.match(/[^.!?。！？\n]+[.!?。！？]*\s*|\n+/g) ?? [texto]
  const saida: { parte: string; sep: string }[] = []
  let atual = ''
  const fechar = () => {
    if (!atual) return
    const m = /\s*$/.exec(atual)!
    saida.push({ parte: atual.slice(0, m.index), sep: m[0] })
    atual = ''
  }
  for (const frase of frases) {
    if (bytes(atual + frase) <= max) {
      atual += frase
      continue
    }
    fechar()
    if (bytes(frase) <= max) {
      atual = frase
      continue
    }
    // Frase grande demais: corta por palavras (ou por caracteres, em chinês).
    const tokens = frase.match(/\S+\s*|\s+/g) ?? [...frase]
    for (const tk of tokens) {
      if (bytes(atual + tk) <= max) atual += tk
      else {
        fechar()
        if (bytes(tk) <= max) atual = tk
        else
          for (const ch of tk) {
            if (bytes(atual + ch) > max) fechar()
            atual += ch
          }
      }
    }
  }
  fechar()
  return saida.filter((p) => p.parte.trim() || p.sep)
}

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}
const decodificar = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTIDADES[e] ?? e)

interface RespostaMyMemory {
  responseData?: { translatedText?: string }
  responseStatus?: number | string
  responseDetails?: string
  quotaFinished?: boolean
}

const cache = new Map<string, string>()

async function traduzirParte(texto: string, de: Language, para: Language, signal?: AbortSignal) {
  const chave = `${de}|${para}|${texto}`
  const emCache = cache.get(chave)
  if (emCache !== undefined) return emCache

  const url = new URL(TRADUCAO.url)
  url.searchParams.set('q', texto)
  url.searchParams.set('langpair', `${CODIGO[de]}|${CODIGO[para]}`)
  if (TRADUCAO.email) url.searchParams.set('de', TRADUCAO.email)

  const timeout = AbortSignal.timeout(TRADUCAO.timeoutMs)
  let resposta: Response
  try {
    resposta = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  } catch (e) {
    if ((e as Error).name === 'AbortError' && signal?.aborted) throw e
    throw new TraducaoError('rede', 'Sem conexão com o serviço de tradução.')
  }
  const dados = (await resposta.json().catch(() => ({}))) as RespostaMyMemory
  const status = Number(dados.responseStatus ?? resposta.status)
  const traduzido = dados.responseData?.translatedText ?? ''
  if (dados.quotaFinished || status === 429 || /MYMEMORY WARNING/i.test(traduzido))
    throw new TraducaoError('cota', 'Cota diária de tradução esgotada.')
  if (!resposta.ok || status !== 200 || !traduzido)
    throw new TraducaoError('servico', dados.responseDetails || 'Falha no serviço de tradução.')

  const limpo = decodificar(traduzido)
  cache.set(chave, limpo)
  return limpo
}

/** Traduz um texto de `de` para `para` (quebra em pedaços quando passa do limite). */
export async function traduzir(texto: string, de: Language, para: Language, signal?: AbortSignal) {
  if (!TRADUCAO.ativa) throw new TraducaoError('desligada', 'Tradução automática desligada.')
  if (de === para || !texto.trim()) return texto
  let saida = ''
  for (const { parte, sep } of quebrarTexto(texto)) {
    saida += (parte.trim() ? await traduzirParte(parte, de, para, signal) : parte) + sep
  }
  return saida.trimEnd()
}

export interface ResultadoTraducao {
  valor: LocalizedText
  /** Idiomas que não puderam ser traduzidos agora (ficam pendentes). */
  falhas: Language[]
  motivo?: MotivoFalha
}

async function preencher(base: LocalizedText, alvos: Language[], signal?: AbortSignal) {
  const original = base.textos[base.origem] ?? ''
  const resultados = await Promise.allSettled(
    alvos.map((l) => traduzir(original, base.origem, l, signal)),
  )
  const valor: LocalizedText = {
    ...base,
    textos: { ...base.textos },
    automaticos: [...(base.automaticos ?? [])],
  }
  const falhas: Language[] = []
  let motivo: MotivoFalha | undefined
  resultados.forEach((r, i) => {
    const l = alvos[i]!
    if (r.status === 'fulfilled') {
      valor.textos[l] = r.value
      if (!valor.automaticos!.includes(l)) valor.automaticos!.push(l)
    } else {
      falhas.push(l)
      motivo ??= r.reason instanceof TraducaoError ? r.reason.motivo : 'servico'
    }
  })
  return { valor, falhas, motivo }
}

/**
 * Cria o texto multilíngue a partir do que a pessoa digitou.
 * `origem`: idioma escolhido pela pessoa; sem ele, detecta (palpite = idioma da tela).
 */
export async function criarTextoTraduzido(
  texto: string,
  idiomaTela: Language,
  origem?: Language,
  signal?: AbortSignal,
): Promise<ResultadoTraducao> {
  const limpo = texto.trim()
  const idioma = origem ?? detectarIdioma(limpo, idiomaTela).idioma
  const base: LocalizedText = { origem: idioma, textos: { [idioma]: limpo }, automaticos: [] }
  return preencher(
    base,
    IDIOMAS.filter((l) => l !== idioma),
    signal,
  )
}

/** Tenta de novo os idiomas que ficaram pendentes. */
export async function completarTraducoes(v: LocalizedText, signal?: AbortSignal) {
  return preencher(v, idiomasPendentes(v), signal)
}
