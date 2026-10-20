import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import { normalizar } from '../../shared/texto.js'
import { fetchComCa } from '../integracao/rede.js'

/*
 * ESTOQUE (pedido do usuário, 20/10/2026): "Vamos agora integrar três sistemas … Eles vão ser
 * parte do estoque … igual todos os outros, sem afetar a integração já feita com a 1.0."
 *
 *   Materiais  ← ARMAZÉM (EC-Inventory-Management): os paletes do porta-palete;
 *   Assets     ← CONTROLE DE NOTEBOOKS (EC-ControleNotebooks): computadores (Notebook, Desktop,
 *                AIO e Servidor — "Servidor será um sistema separado": a tela Servidores espera o
 *                sistema próprio);
 *   Peças      ← CONTROLE DE NOTEBOOKS: o que lá é do tipo "Peça";
 *   E-commerce ← RTB WMS (EC-rtb-sistema-armazem): SKU × prateleira do Mercado Livre.
 *
 * O 2.0 LÊ pela MESMA porta que o iERP antigo usa (`GET /api/integracao/estoque`, cabeçalho
 * `X-Chave-Integracao`, `{ success, data }` paginado) — nada muda nos três sistemas nem no antigo.
 * Decisões dele: AO VIVO com 1 minuto guardado (igual ao antigo) e o botão Atualizar; a mesma
 * chave do antigo no Notebooks e no RTB WMS (eles aceitam uma só), uma chave própria no
 * armazém (lá se geram várias, em Sistema › Ajustes); "abrir no sistema" vai para a tela geral
 * (os sistemas não mandam o número interno do item). Endereço e chave ficam em Administração ›
 * Integração (tipo "estoque").
 *
 * NUNCA LANÇA: sistema fora do ar vira `indisponivel` + o motivo, e a tela escreve o aviso.
 *
 *   GET /api/estoque/:aba[?atualizar=1]   aba = materiais | assets | pecas | ecommerce
 */

type Fetch = typeof fetch

export type SistemaEstoque = 'ARMAZEM' | 'NOTEBOOKS' | 'RTB_WMS'
export const ABAS_ESTOQUE = ['materiais', 'assets', 'pecas', 'ecommerce'] as const
export type AbaEstoque = (typeof ABAS_ESTOQUE)[number]

/** Por que a lista não veio (a tela traduz). */
export type MotivoEstoque = 'nao_configurado' | 'chave_recusada' | 'sem_resposta' | 'erro'

/** Estado de lá com o rótulo de lá (o armazém manda nos 3 idiomas; o cadastro é editável). */
export interface StatusDeFora {
  codigo: string
  rotulo: string
  rotuloEn: string | null
  rotuloZh: string | null
}

export interface MaterialDeFora {
  id: string
  lote: string
  palete: string | null
  /** ECOMMERCE | ITAD | PROJETO | PECAS | EWASTE */
  categoriaNegocio: string | null
  origem: string | null
  cliente: string | null
  projeto: string | null
  tipoMercadoria: string | null
  categoriaProduto: string | null
  quantidade: number | null
  quantidadeEstimada: boolean
  pesoKg: number | null
  statusFisico: StatusDeFora | null
  statusVenda: StatusDeFora | null
  area: string | null
  posicao: string | null
  dataEntrada: string | null
  itens: number | null
  fotos: number | null
}

export interface MaquinaDeFora {
  id: string
  serial: string
  semSerial: boolean
  /** Notebook | Desktop | AIO | Servidor | Peça */
  tipo: string | null
  marca: string | null
  modelo: string | null
  grade: string | null
  cor: string | null
  cpu: string | null
  memoria: string | null
  disco: string | null
  tela: string | null
  gpu: string | null
  so: string | null
  acessorios: string | null
  resumo: string | null
  /** 1 Recebido … 10 Reserva interna (código de lá; a tela traduz). */
  status: { codigo: number; nome: string } | null
  /** 1 Preparando, 2 Pronto para e-commerce, 3 Para B2B, 4 Reserva interna. */
  preparo: { codigo: number; nome: string } | null
  lote: string | null
  /** Dias (`AAAA-MM-DD`). */
  dataEntrada: string | null
  dataTriagem: string | null
  /** A lista de lá filtrada pelo serial (o sistema não manda o número interno). */
  link: string | null
}

export interface PosicaoEcommerce {
  id: string
  sku: string
  descricao: string | null
  cor: string | null
  produtoAtivo: boolean | null
  posicao: string
  apelido: string | null
  /** shelf | special */
  tipoPosicao: string | null
  zona: string | null
  categoria: string | null
  quantidade: number | null
  ultimaEntrada: string | null
}

export interface EstoqueDeFora<T> {
  sistema: SistemaEstoque
  /** Nome cadastrado em Administração › Integração. */
  nome: string
  configurado: boolean
  indisponivel: boolean
  motivo: MotivoEstoque | null
  /** Detalhe técnico do motivo (status HTTP), para quem configura. */
  detalhe: string | null
  linhas: T[]
  /** Total que o sistema diz ter (pode passar das linhas, se `incompleto`); null = não se sabe
   * (Assets/Peças com a lista incompleta: o total de lá é de todas as máquinas). */
  total: number | null
  incompleto: boolean
  /** Endereço da tela do sistema (o botão "Abrir no …"). */
  urlSistema: string | null
  lidoEm: string
}

/* ------------------------------------------------------------ tradução (pura) */

const texto = (v: unknown) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}
const numero = (v: unknown) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null)

function statusDeFora(v: unknown): StatusDeFora | null {
  const o = obj(v)
  const codigo = texto(o?.codigo)
  if (!codigo) return null
  return {
    codigo,
    rotulo: texto(o?.rotulo) ?? codigo,
    rotuloEn: texto(o?.rotuloEn),
    rotuloZh: texto(o?.rotuloZh),
  }
}

/** Palete do armazém → linha de Materiais. Sem código de lote, não entra. */
export function paleteParaMaterial(v: unknown): MaterialDeFora | null {
  const p = obj(v)
  const lote = texto(p?.lote)
  if (!p || !lote) return null
  const lugar = obj(p.lugar)
  const area = obj(p.area)
  return {
    id: `armazem:${lote}`,
    lote,
    palete: texto(p.palete),
    categoriaNegocio: texto(p.categoriaNegocio),
    origem: texto(p.origem),
    cliente: texto(p.cliente),
    projeto: texto(p.projeto),
    tipoMercadoria: texto(p.tipoMercadoria) ?? texto(p.descricao),
    categoriaProduto: texto(p.categoriaProduto),
    quantidade: numero(p.quantidade),
    quantidadeEstimada: p.quantidadeEstimada === true,
    pesoKg: numero(p.pesoKg),
    statusFisico: statusDeFora(p.statusFisico),
    statusVenda: statusDeFora(p.statusVenda),
    area: texto(lugar?.area) ?? texto(area?.nome) ?? texto(area?.codigo),
    posicao: texto(lugar?.posicao) ?? texto(p.posicao),
    dataEntrada: texto(p.dataEntrada),
    itens: numero(p.itens),
    fotos: numero(p.fotos),
  }
}

function codigoNome(v: unknown) {
  const o = obj(v)
  const codigo = numero(o?.codigo)
  if (codigo === null) return null
  return { codigo, nome: texto(o?.nome) ?? String(codigo) }
}

/** Máquina do Controle de Notebooks → linha de Assets/Peças. Sem serial, não entra. */
export function maquinaDeFora(v: unknown, base: string): MaquinaDeFora | null {
  const m = obj(v)
  const serial = texto(m?.serial)
  if (!m || !serial) return null
  const memoria =
    texto(m.memoriaTexto) ?? ((numero(m.memoriaGB) ?? 0) > 0 ? `${numero(m.memoriaGB)}GB` : null)
  const disco = texto(m.disco) ?? ((numero(m.discoGB) ?? 0) > 0 ? `${numero(m.discoGB)}GB` : null)
  return {
    id: `notebooks:${serial}`,
    serial,
    semSerial: m.semSerial === true,
    tipo: texto(m.tipo),
    marca: texto(m.marca),
    modelo: texto(m.modelo),
    grade: texto(m.grade),
    cor: texto(m.cor),
    cpu: texto(m.cpu),
    memoria,
    disco,
    tela: texto(m.tela),
    gpu: texto(m.gpu),
    so: texto(m.so),
    acessorios: texto(m.acessorios),
    resumo: texto(m.especResumo),
    status: codigoNome(m.status),
    preparo: codigoNome(m.preparo),
    lote: texto(m.lote),
    dataEntrada: texto(m.dataEntrada),
    dataTriagem: texto(m.dataTriagem),
    link: base ? `${base}/Computadores?Busca=${encodeURIComponent(serial)}` : null,
  }
}

/** O tipo de lá é "Peça"? (com ou sem acento, singular ou plural) */
export const ehPeca = (tipo: string | null) =>
  ['peca', 'pecas'].includes(normalizar(tipo ?? '').trim())

/** SKU × posição do RTB WMS → linha de E-commerce. */
export function posicaoParaEcommerce(v: unknown): PosicaoEcommerce | null {
  const p = obj(v)
  const sku = texto(p?.sku)
  const posicao = texto(p?.posicao)
  if (!p || !sku || !posicao) return null
  return {
    id: `wms:${sku}@${posicao}`,
    sku,
    descricao: texto(p.descricao),
    cor: texto(p.cor),
    produtoAtivo: typeof p.produtoAtivo === 'boolean' ? p.produtoAtivo : null,
    posicao,
    apelido: texto(p.apelido),
    tipoPosicao: texto(p.tipoPosicao),
    zona: texto(p.zona),
    categoria: texto(p.categoria),
    quantidade: numero(p.quantidade),
    ultimaEntrada: texto(p.ultimaEntrada),
  }
}

/* ------------------------------------------------------------ as fontes */

interface Fonte<T extends { id: string }> {
  sistema: SistemaEstoque
  /** Onde ficam as linhas no `data`. */
  linhas: (d: Record<string, unknown>) => unknown[]
  traduzir: (v: unknown, base: string) => T | null
  /** A tela do sistema ("Abrir no …"). */
  tela: (base: string) => string
}

const FONTES = {
  ARMAZEM: {
    sistema: 'ARMAZEM',
    linhas: (d) => (Array.isArray(d.lotes) ? d.lotes : []),
    traduzir: (v) => paleteParaMaterial(v),
    tela: (b) => `${b}/`,
  } satisfies Fonte<MaterialDeFora>,
  NOTEBOOKS: {
    sistema: 'NOTEBOOKS',
    linhas: (d) => (Array.isArray(d.maquinas) ? d.maquinas : []),
    traduzir: maquinaDeFora,
    tela: (b) => `${b}/Computadores`,
  } satisfies Fonte<MaquinaDeFora>,
  RTB_WMS: {
    sistema: 'RTB_WMS',
    linhas: (d) => (Array.isArray(d.posicoes) ? d.posicoes : []),
    traduzir: (v) => posicaoParaEcommerce(v),
    tela: (b) => `${b}/admin/`,
  } satisfies Fonte<PosicaoEcommerce>,
}

/** Teto da LEITURA INTEIRA (todas as páginas): a lista é a tela, e uma tela que nunca responde é
 * pior que uma que diz "não consegui". O antigo esperava 8 s; aqui as páginas são até 8. */
const TIMEOUT_MS = 15_000
/** O estoque não muda a cada segundo; a tela é reaberta toda hora (filtrar, voltar). */
const VALIDADE_MS = 60_000
/** "Atualizar" só vai lá de novo se a leitura guardada tiver pelo menos isto (cada página custa
 * ao armazém uma conferência de chave bcrypt — o botão apertado várias vezes não pode virar
 * uma fila de leituras lá). */
const ATUALIZAR_DEPOIS_MS = 15_000
/** As APIs paginam com teto de 500; 8 páginas = 4.000 linhas (hoje ~800 paletes). */
export const MAXIMO_DE_PAGINAS = 8
const POR_PAGINA = 500

/** A raiz do sistema (aceita também o endereço colado com o caminho da porta ou do painel). */
export const base = (url: string) =>
  url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/integracao(\/estoque)?$/i, '')
    .replace(/\/(admin|Computadores)$/i, '')
    .replace(/\/+$/, '')

export function criarServicoEstoque(
  db: Db,
  opcoes: { fetch?: Fetch; atualizarDepoisMs?: number } = {},
) {
  const fazerFetch = opcoes.fetch ?? fetch
  const atualizarDepois = opcoes.atualizarDepoisMs ?? ATUALIZAR_DEPOIS_MS
  const guardado = new Map<
    SistemaEstoque,
    { em: number; assinatura: string; dados: Promise<EstoqueDeFora<unknown>>; andando: boolean }
  >()

  async function config(sistema: SistemaEstoque) {
    return db
      .selectFrom('integracoes')
      .select(['id', 'nome', 'urlPainel', 'tokenPainel', 'caPainel', 'status'])
      .where('sistema', '=', sistema)
      .executeTakeFirst()
  }

  type Config = Awaited<ReturnType<typeof config>>

  async function ler<T extends { id: string }>(
    fonte: Fonte<T>,
    cfg: Config,
  ): Promise<EstoqueDeFora<T>> {
    const lidoEm = new Date().toISOString()
    const vazio = {
      sistema: fonte.sistema,
      nome: cfg?.nome ?? fonte.sistema,
      linhas: [] as T[],
      total: 0,
      incompleto: false,
      lidoEm,
    }
    if (!cfg || cfg.status !== 'ativo' || !cfg.urlPainel || !cfg.tokenPainel)
      return {
        ...vazio,
        configurado: false,
        indisponivel: true,
        motivo: 'nao_configurado',
        detalhe: null,
        urlSistema: null,
      }
    const raiz = base(cfg.urlPainel)
    const urlSistema = fonte.tela(raiz)
    const f = fetchComCa(cfg.caPainel, fazerFetch)
    const falhou = (motivo: MotivoEstoque, detalhe: string | null): EstoqueDeFora<T> => ({
      ...vazio,
      configurado: true,
      indisponivel: true,
      motivo,
      detalhe,
      urlSistema,
    })

    const linhas: T[] = []
    // Linha cujo id já veio numa página ANTERIOR é descartada: a paginação de lá é por posição
    // e uma entrada entre duas páginas empurra a última de uma para a próxima (herança do
    // antigo). Repetição DENTRO de uma página é dado de lá e fica.
    const vistos = new Set<string>()
    let total: number
    let incompleto = false
    let pagina = 1
    const sinal = AbortSignal.timeout(TIMEOUT_MS)
    for (let lidas = 1; ; lidas++) {
      let r: Response
      try {
        r = await f(`${raiz}/api/integracao/estoque?pagina=${pagina}&porPagina=${POR_PAGINA}`, {
          headers: { 'X-Chave-Integracao': cfg.tokenPainel, Accept: 'application/json' },
          signal: sinal,
          // A chave nunca segue um redirecionamento para outro endereço.
          redirect: 'manual',
        })
      } catch (e) {
        const tempo = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
        return falhou('sem_resposta', tempo ? 'timeout' : 'rede')
      }
      if (r.status === 401 || r.status === 403) return falhou('chave_recusada', String(r.status))
      if (!r.ok) return falhou('erro', String(r.status))
      let corpo: { success?: boolean; data?: Record<string, unknown> }
      try {
        corpo = (await r.json()) as typeof corpo
      } catch {
        return falhou('erro', 'formato')
      }
      if (!corpo?.success || !corpo.data) return falhou('erro', 'formato')
      total = numero(corpo.data.total) ?? 0
      const desta: T[] = []
      for (const bruta of fonte.linhas(corpo.data)) {
        const linha = fonte.traduzir(bruta, raiz)
        if (!linha || vistos.has(linha.id)) continue
        desta.push(linha)
      }
      for (const l of desta) {
        vistos.add(l.id)
        linhas.push(l)
      }
      const proxima = numero(corpo.data.proximaPagina)
      // Sem próxima (ou uma "próxima" que não anda): acabou.
      if (!proxima || proxima <= pagina) break
      if (lidas >= MAXIMO_DE_PAGINAS) {
        incompleto = true
        break
      }
      pagina = proxima
    }
    return {
      ...vazio,
      configurado: true,
      indisponivel: false,
      motivo: null,
      detalhe: null,
      linhas,
      total,
      incompleto,
      urlSistema,
    }
  }

  /** O resultado da leitura fica visível em Administração › Integração (última leitura/erro). */
  async function anotar(cfg: Config, d: EstoqueDeFora<unknown>) {
    if (!cfg?.id || !d.configurado) return
    const agora = new Date().toISOString()
    await db
      .updateTable('integracoes')
      .set(
        d.indisponivel
          ? {
              ultimoErro: `Estoque: ${d.motivo}${d.detalhe ? ` (${d.detalhe})` : ''}`,
              ultimoErroEm: agora,
            }
          : { ultimoPainelEm: agora, ultimoErro: null, ultimoErroEm: null },
      )
      .where('id', '=', cfg.id)
      .execute()
  }

  /**
   * A lista de uma fonte, guardada 1 minuto (falha não fica guardada). Uma leitura por vez por
   * sistema: quem chega enquanto ela anda recebe a mesma. Mudou o cadastro em Administração ›
   * Integração (endereço, chave, ativo), a próxima leitura vai lá na hora. NUNCA lança.
   */
  async function lerGuardado<T extends { id: string }>(
    fonte: Fonte<T>,
    atualizar: boolean,
  ): Promise<EstoqueDeFora<T>> {
    const cfg = await config(fonte.sistema)
    const assinatura = JSON.stringify([
      cfg?.urlPainel,
      cfg?.tokenPainel,
      cfg?.caPainel,
      cfg?.status,
    ])
    const g = guardado.get(fonte.sistema)
    if (g && g.assinatura === assinatura) {
      const idade = Date.now() - g.em
      // Lendo agora: quem chega recebe a mesma leitura (nunca duas idas lá ao mesmo tempo).
      if (g.andando || idade < (atualizar ? atualizarDepois : VALIDADE_MS))
        return g.dados as Promise<EstoqueDeFora<T>>
    }
    const dados = ler(fonte, cfg)
    const entrada = {
      em: Date.now(),
      assinatura,
      dados: dados as Promise<EstoqueDeFora<unknown>>,
      andando: true,
    }
    guardado.set(fonte.sistema, entrada)
    void dados.then(
      (d) => {
        entrada.andando = false
        if (d.indisponivel && guardado.get(fonte.sistema)?.dados === dados)
          guardado.delete(fonte.sistema)
        void anotar(cfg, d).catch(() => undefined)
      },
      () => {
        entrada.andando = false
        if (guardado.get(fonte.sistema)?.dados === dados) guardado.delete(fonte.sistema)
      },
    )
    return dados
  }

  const consultaSchema = z.object({
    aba: z.enum(ABAS_ESTOQUE, { error: 'Tela do estoque desconhecida.' }),
    atualizar: z
      .string()
      .optional()
      .transform((v) => v === '1' || v === 'true'),
  })

  async function listar(entrada: unknown) {
    const { aba, atualizar } = consultaSchema.parse(entrada)
    if (aba === 'materiais') return lerGuardado(FONTES.ARMAZEM, atualizar)
    if (aba === 'ecommerce') return lerGuardado(FONTES.RTB_WMS, atualizar)
    // Assets e Peças dividem a MESMA leitura (uma busca só): quem separa é o tipo.
    const maquinas = await lerGuardado(FONTES.NOTEBOOKS, atualizar)
    const pecas = aba === 'pecas'
    const linhas = maquinas.linhas.filter((m) => ehPeca(m.tipo) === pecas)
    // O total de lá é de TODAS as máquinas: com a lista inteira, o total da tela é o que ficou;
    // incompleta, não se sabe quantas são deste tipo (a tela diz "pelo menos").
    return { ...maquinas, linhas, total: maquinas.incompleto ? null : linhas.length }
  }

  return { listar }
}

export type ServicoEstoque = ReturnType<typeof criarServicoEstoque>

export function rotasEstoque(servico: ServicoEstoque) {
  const r = Router()
  r.get('/:aba', async (req, res) => {
    res.json(await servico.listar({ aba: req.params.aba, atualizar: req.query.atualizar }))
  })
  return r
}
