import { ErroApi } from '../../shared/erros.js'
import { regiaoDaUf, regiaoDoTexto, type RegiaoBrasil } from '../../shared/regioes.js'

/*
 * Geolocalização para o cadastro de sites:
 *  - CEP → endereço: ViaCEP (https://viacep.com.br/ws/{cep}/json/).
 *  - Endereço → latitude/longitude: Nominatim (OpenStreetMap).
 *
 * Política de uso do Nominatim (operations.osmfoundation.org/policies/nominatim): no máximo
 * 1 consulta por segundo no TOTAL da aplicação, User-Agent identificando o sistema, resultados
 * em cache e NADA de autocompletar. Por isso a consulta passa por aqui (fila + cache) e a tela
 * só chama no botão "Localizar".
 */

export interface EnderecoCep {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
  /** Código da região (pelo nome que o ViaCEP devolve ou pela UF). */
  regiao: RegiaoBrasil | null
  /** "Rua, bairro, cidade – UF". */
  endereco: string
}

export interface Coordenadas {
  latitude: number
  longitude: number
  /** Endereço como o mapa entendeu (para conferir). */
  descricao: string
  /**
   * `endereco`: achou a rua. `cidade`: só achou a cidade — ponto APROXIMADO (centro da cidade);
   * a tela pede para arrastar o pino até o portão.
   */
  precisao: 'endereco' | 'cidade'
}

/**
 * Consultas a tentar, em ordem, a partir do endereço digitado ("Rua, bairro, cidade – UF").
 * O mapa costuma não conhecer o nome do bairro (ex.: "Alphaville Centro Industrial…") nem
 * endereços por quadra: então tenta sem o bairro e, por fim, só a cidade (aproximado).
 */
export function variantesEndereco(
  texto: string,
): { q: string; precisao: Coordenadas['precisao'] }[] {
  const partes = texto
    .replace(/\s+[–—-]\s+(?=[A-Za-z]{2}\s*$)/, ', ') // "Cidade – UF" → "Cidade, UF"
    .split(',')
    .map((p) => p.trim().replace(/[./]+$/, ''))
    .filter(Boolean)
  const lista: { q: string; precisao: Coordenadas['precisao'] }[] = [
    { q: partes.join(', '), precisao: 'endereco' },
  ]
  if (partes.length >= 4)
    lista.push({ q: [partes[0], ...partes.slice(-2)].join(', '), precisao: 'endereco' })
  if (partes.length >= 3) lista.push({ q: partes.slice(-2).join(', '), precisao: 'cidade' })
  const vistos = new Set<string>()
  return lista.filter((v) => {
    const k = v.q.toLowerCase()
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

const TEMPO_LIMITE_MS = 8000
const indisponivel = () =>
  new ErroApi(502, 'geo_unavailable', 'Serviço de localização indisponível. Tente de novo.')

export function criarServicoGeo(opcoes: { contato: string; fetch?: typeof fetch }) {
  const buscar = opcoes.fetch ?? fetch
  const userAgent = `Re-Teck-iERP/0.1 (${opcoes.contato})`
  const cacheCep = new Map<string, EnderecoCep | null>()
  const cacheEndereco = new Map<string, Omit<Coordenadas, 'precisao'> | null>()
  // Fila: garante 1 consulta por segundo ao Nominatim, somando todos os usuários.
  let proximaLiberacao = 0
  async function aguardarVez() {
    const agora = Date.now()
    const espera = Math.max(0, proximaLiberacao - agora)
    proximaLiberacao = Math.max(agora, proximaLiberacao) + 1000
    if (espera) await new Promise((r) => setTimeout(r, espera))
  }

  /** Uma consulta ao Nominatim (com cache e a fila de 1/s). */
  async function consultar(q: string): Promise<Omit<Coordenadas, 'precisao'> | null> {
    const chave = q.toLowerCase()
    if (!cacheEndereco.has(chave)) {
      await aguardarVez()
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.search = new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'br',
        q,
      }).toString()
      let r: Response
      try {
        r = await buscar(url, {
          headers: { 'User-Agent': userAgent, 'Accept-Language': 'pt-BR' },
          signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        })
      } catch {
        throw indisponivel()
      }
      if (!r.ok) throw indisponivel()
      const lista = (await r.json()) as { lat: string; lon: string; display_name: string }[]
      const primeiro = lista[0]
      cacheEndereco.set(
        chave,
        primeiro
          ? {
              latitude: Number(primeiro.lat),
              longitude: Number(primeiro.lon),
              descricao: primeiro.display_name,
            }
          : null,
      )
    }
    return cacheEndereco.get(chave) ?? null
  }

  return {
    async porCep(cepBruto: string): Promise<EnderecoCep> {
      const cep = cepBruto.replace(/\D/g, '')
      if (cep.length !== 8) throw new ErroApi(422, 'validation', 'CEP deve ter 8 dígitos.')
      if (!cacheCep.has(cep)) {
        let r: Response
        try {
          r = await buscar(`https://viacep.com.br/ws/${cep}/json/`, {
            signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
          })
        } catch {
          throw indisponivel()
        }
        if (!r.ok) throw indisponivel()
        const j = (await r.json()) as Record<string, string>
        if (j.erro) cacheCep.set(cep, null)
        else {
          const partes = [j.logradouro, j.bairro, j.localidade].filter(Boolean).join(', ')
          cacheCep.set(cep, {
            cep,
            logradouro: j.logradouro ?? '',
            bairro: j.bairro ?? '',
            cidade: j.localidade ?? '',
            uf: j.uf ?? '',
            regiao: regiaoDoTexto(j.regiao) ?? regiaoDaUf(j.uf),
            endereco: j.uf ? `${partes} – ${j.uf}` : partes,
          })
        }
      }
      const achou = cacheCep.get(cep)
      if (!achou) throw new ErroApi(404, 'cep_not_found', 'CEP não encontrado.')
      return achou
    },

    async porEndereco(enderecoBruto: string): Promise<Coordenadas> {
      const endereco = enderecoBruto.trim().replace(/\s+/g, ' ')
      if (endereco.length < 5) throw new ErroApi(422, 'validation', 'Informe o endereço.')
      for (const { q, precisao } of variantesEndereco(endereco)) {
        const achou = await consultar(q)
        if (achou) return { ...achou, precisao }
      }
      throw new ErroApi(404, 'address_not_found', 'Endereço não encontrado no mapa.')
    },
  }
}

export type ServicoGeo = ReturnType<typeof criarServicoGeo>
