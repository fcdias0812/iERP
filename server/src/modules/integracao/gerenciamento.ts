import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Transaction } from 'kysely'
import type { Db } from '../../db/database.js'
import type { Database, IntegracoesTable } from '../../db/schema.js'
import { codigoCom, proximoNumero } from '../../shared/cadastro.js'
import { diaNoFuso, ehDia, inicioDoDia, somarDias } from '../../shared/datas.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { Mudanca } from '../../shared/historico.js'
import { registrarHistorico } from '../../shared/historico.repositorio.js'
import { regiaoDaUf } from '../../shared/regioes.js'
import { normalizar } from '../../shared/texto.js'
import { criarRepositorioSites } from '../clientes/clientes-sites.repositorio.js'
import { criarServicoSites } from '../clientes/clientes-sites.servico.js'
import { criarRepositorioClientes } from '../clientes/clientes.repositorio.js'
import { fetchComCa } from './rede.js'

/*
 * GERENCIAMENTO DE PROJETOS (sistema `VDAS-Gerenciamento-Ericsson` — pedido do usuário,
 * 20/10/2026). Ele cria a ordem, recebe o lote e emite o COD; o iERP 2.0 SÓ MOSTRA.
 *
 * O iERP antigo e o 2.0 funcionam juntos, e nada muda no Gerenciamento nem na ligação dele com o
 * antigo: o 2.0 apenas LÊ, com o mesmo token, rotas que o Gerenciamento já tem para o antigo
 * (`INTEGRACAO.md` do Gerenciamento):
 *  - `GET /api/integracao/painel` (a cada 30 s): todas as coletas do BRASIL, com a etapa, as
 *    datas e o COD;
 *  - `GET /api/integracao/ordens?desde=<ontem>` e `/ordens/:id`: os dados da ordem (site,
 *    endereço, transportadora, observação) das coletas novas ou que mudaram;
 *  - `GET /api/integracao/ordens/:id/completa` (ao abrir o lote): o ESPELHO — pesagens com a
 *    foto da balança, documentos e materiais. Nada disso é copiado para cá.
 *
 * Regras combinadas com o usuário:
 *  - todos os clientes do Gerenciamento (Ericsson, AWS, Google, Nokia), só Brasil — e TODAS as
 *    coletas, inclusive as já concluídas e as canceladas, como o iERP antigo tem;
 *  - o cliente é o CADASTRADO no iERP (com CNPJ), achado pelo nome; sem cliente, a coleta espera
 *    e a tela de Integração avisa;
 *  - site e doca que não existem no iERP são criados sozinhos nesse cliente (a doca com a altura
 *    máxima legal do caminhão no Brasil, 4,40 m — Resolução CONTRAN 210/2006 —, para ajustar
 *    depois no cadastro);
 *  - as etapas espelham as de lá: antes → agendado, inspecao → inspeção, processo, aguardando
 *    COD, encerrado → concluído (no COD), cancelado → cancelado.
 */

export const SISTEMA_GERENCIAMENTO = 'GERENCIAMENTO'
/** Re-Teck MSDC (equip-rack-2, Microsoft) — o mesmo esquema (20/10/2026). */
export const SISTEMA_MSDC = 'MSDC'

type Fetch = typeof fetch
type Trx = Transaction<Database>
type StatusLote =
  'agendado' | 'inspecao' | 'processo' | 'aguardando_cod' | 'concluido' | 'cancelado'

/** Uma coleta no painel do Gerenciamento (formato dele). */
export interface PedidoPainel {
  id: string | number
  numero?: string | null
  lote?: string | null
  cliente?: string | null
  pedidoEm?: string | null
  coletaAgendadaEm?: string | null
  coletaPrevistaEm?: string | null
  primeiraPrevisaoEm?: string | null
  chegadaEm?: string | null
  codNumero?: string | null
  codEm?: string | null
  encerradoEm?: string | null
  semCod?: boolean
  grupo?: string
  etapa?: { nome?: string; desde?: string | null; indice?: number; total?: number } | null
  etapas?: { nome?: string; grupo?: string; desde?: string | null; estado?: string }[]
  previstoPallets?: number | null
  previstoPesoKg?: number | null
  previstoUnidades?: number | null
}

/** A ordem no contrato do Gerenciamento (formato dele, snake_case). */
export interface OrdemGerenciamento {
  id: string | number
  numero?: string | null
  lote?: string | null
  cliente?: string | null
  cliente_id?: string | null
  site?: string | null
  endereco?: string | null
  cidade?: string | null
  uf?: string | null
  pais?: string | null
  transportadora?: string | null
  data_coleta?: string | null
  data_chegada?: string | null
  escopo_trabalho?: string | null
  observacoes?: string | null
  data_pedido?: string | null
  data_coleta_prevista?: string | null
  previsto_peso_kg?: number | null
  previsto_pallets?: number | null
  cod_numero?: string | null
  cod_data?: string | null
  /** A doca (o MSDC manda a do agendamento; o Gerenciamento não tem). */
  doca?: string | null
  /** A tela do lote lá (o MSDC manda). */
  url?: string | null
}

/** O que fica guardado no lote (`ordens.externo_dados`): o que veio de lá, cru. */
export interface Guardado {
  ordem: OrdemGerenciamento | null
  painel: PedidoPainel
}

/** O que o Gerenciamento disse da ordem — o que a tela do lote mostra (contrato da API). */
export interface DadosExternos {
  numero: string | null
  lote: string | null
  cliente: string | null
  site: string | null
  doca: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  pais: string | null
  transportadora: string | null
  observacoes: string | null
  /** Datas (início do dia em São Paulo, ISO — lá elas são só o dia). */
  pedidoEm: string | null
  coletaAgendadaEm: string | null
  coletaPrevistaEm: string | null
  chegadaEm: string | null
  previstoPesoKg: number | null
  previstoPallets: number | null
  previstoUnidades: number | null
  codNumero: string | null
  codEm: string | null
  /** Encerrada lá sem COD registrado (fica fora do cumprimento de SLA). */
  semCod: boolean
  /** A escada de etapas de lá. */
  etapas: { nome: string; desde: string | null; estado: string | null }[]
}

/** Resumo da última sincronização (Administração › Integração). */
export interface ResumoSincronizacao {
  em: string
  /** Coletas do Brasil no painel de lá. */
  coletas: number
  /** Coletas com lote no iERP. */
  ligadas: number
  /** Lotes criados nesta leitura. */
  criados: number
  /** Coletas esperando, por cliente (sem cliente cadastrado aqui, ou mais de um com o nome). */
  pendencias: {
    cliente: string
    coletas: number
    motivo: 'sem_cliente' | 'varios_clientes' | 'cliente_inativo'
  }[]
  /**
   * Lotes ligados a coletas que NÃO vêm mais no painel de lá (excluídas, ou com o país trocado
   * para fora do Brasil). O lote fica como estava — o aviso é para alguém conferir lá.
   */
  sumidos: { codigo: string; referencia: string | null }[]
  /** Última vez que a lista INTEIRA de ordens foi lida (refresca site, transportadora…). */
  cargaCompletaEm: string | null
  /**
   * Coletas que deram erro nesta leitura (as primeiras 10). Um erro num lote NUNCA trava os
   * outros: a coleta fica para a próxima leitura e o resto segue.
   */
  falhas: { coleta: string; erro: string }[]
}

/** Esperas: uma ordem ou o espelho (15 s); o painel e as recentes (30 s); a lista inteira da
 * 1ª carga (2 min — são centenas de ordens montadas lá na hora). */
const TIMEOUT_MS = 15_000
const TIMEOUT_PAINEL_MS = 30_000
const TIMEOUT_LISTA_MS = 120_000
/** Ordens buscadas uma a uma por leitura (o resto fica para as próximas, a cada 30 s). */
const MAX_UMA_A_UMA = 30
/**
 * De quanto em quanto tempo a lista INTEIRA de ordens é lida de novo. Entre uma e outra valem as
 * "mudadas desde ontem" — mas há mudança lá que não muda a data da coleta (o nome da
 * transportadora, o cadastro do site da AWS), e o iERP pode ficar fora do ar mais de um dia.
 */
const CARGA_COMPLETA_MS = 6 * 3_600_000
const agoraIso = () => new Date().toISOString()
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const dia = (v: unknown) => {
  const d = typeof v === 'string' ? v.slice(0, 10) : null
  return ehDia(d) ? d : null
}
/**
 * A data de lá como o iERP guarda: o dia (AAAA-MM-DD) vira o início do dia em São Paulo; o
 * instante com fuso (o MSDC manda ISO com Z) vale como veio.
 */
const instante = (v: unknown) => {
  if (typeof v === 'string' && /T\d{2}:\d{2}.*([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) {
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : new Date(t).toISOString()
  }
  const d = dia(v)
  return d ? inicioDoDia(d) : null
}

const DATA_HORA = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/

/**
 * Data e hora de lá → instante (ISO). Lá elas vêm SEM fuso: a hora da pesagem é a de São Paulo
 * (`fuso: 'sp'`); a do envio de arquivo é a do SQLite, em UTC (`fuso: 'utc'`). Com fuso
 * (Z/+hh:mm) vale o que veio; só o dia → início do dia em São Paulo.
 */
function dataHora(v: unknown, fuso: 'sp' | 'utc') {
  const s = texto(v)
  if (!s) return null
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s)
    return Number.isNaN(t) ? null : new Date(t).toISOString()
  }
  const m = s.match(DATA_HORA)
  if (!m) return instante(s)
  const [, d, h, min, seg] = m
  if (!ehDia(d)) return null
  const desde = fuso === 'utc' ? Date.parse(`${d}T00:00:00Z`) : Date.parse(inicioDoDia(d!))
  return new Date(
    desde + (Number(h) * 60 + Number(min)) * 60_000 + Number(seg ?? 0) * 1000,
  ).toISOString()
}

const STATUS_DO_GRUPO: Record<string, StatusLote> = {
  antes: 'agendado',
  inspecao: 'inspecao',
  processo: 'processo',
  aguardandoCod: 'aguardando_cod',
  encerrado: 'concluido',
  cancelado: 'cancelado',
}
/**
 * O status daqui para o grupo de lá. Grupo fora da lista fechada (vocabulário novo lá, ou erro)
 * NÃO vira "agendado" — isso voltaria um lote em processo e apagaria as datas do SLA: a coleta
 * dá erro (fica na lista de falhas da Integração) e o lote fica como estava.
 */
function statusDoPedido(p: PedidoPainel): StatusLote {
  const s = STATUS_DO_GRUPO[p.grupo ?? '']
  if (!s) throw new Error(`Fase desconhecida no Gerenciamento: "${p.grupo ?? ''}".`)
  return s
}

/** O código do site do lote (o site de lá; sem ele, a cidade). */
const codigoDoSite = (d: Pick<DadosExternos, 'site' | 'cidade'>) =>
  (d.site ?? d.cidade ?? 'Sem site').slice(0, 30).trim()

/** O endereço do sistema, a partir do endereço do painel cadastrado (sem parâmetros). */
export function baseDoGerenciamento(urlPainel: string) {
  return urlPainel
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .replace(/\/api\/integracao\/painel$/i, '')
}

/** O nome do cliente no Gerenciamento → o padrão do nome no cadastro do iERP. */
const PADROES: Record<string, RegExp> = {
  ericsson: /\bericsson\b/,
  aws: /\baws\b|\bamazon\b/,
  google: /\bgoogle\b/,
  nokia: /\bnokia\b/,
  microsoft: /\bmicrosoft\b/,
}
function padraoDoCliente(rotulo: string) {
  const n = normalizar(rotulo).trim()
  return PADROES[n] ?? new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
}

/** Doca criada sozinha: só o número e a altura legal (o resto, quem conhece a doca preenche). */
const DOCA_PADRAO = {
  numero: 'Principal',
  alturaMaxCaminhao: 4.4,
  comprimentoMaxCaminhao: null,
  dockLeveler: false,
  tailLift: false,
  areaLift: null,
  espaco: null,
  altura: null,
  voltagemShredder: null,
  pisoProtecaoObrigatorio: false,
}

/** Os dados para a tela, a partir do que veio de lá. */
export function dadosExternos(g: Guardado): DadosExternos {
  const o = g.ordem
  const p = g.painel
  return {
    numero: texto(o?.numero) ?? texto(p.numero),
    lote: texto(o?.lote) ?? texto(p.lote),
    cliente: texto(o?.cliente) ?? texto(p.cliente),
    site: texto(o?.site),
    doca: texto(o?.doca),
    endereco: texto(o?.endereco),
    cidade: texto(o?.cidade),
    uf: texto(o?.uf),
    pais: texto(o?.pais),
    transportadora: texto(o?.transportadora),
    observacoes: texto(o?.observacoes),
    pedidoEm: instante(p.pedidoEm) ?? instante(o?.data_pedido),
    coletaAgendadaEm: instante(p.coletaAgendadaEm) ?? instante(o?.data_coleta),
    coletaPrevistaEm: instante(p.coletaPrevistaEm) ?? instante(o?.data_coleta_prevista),
    chegadaEm: instante(p.chegadaEm) ?? instante(o?.data_chegada),
    previstoPesoKg: numero(p.previstoPesoKg) ?? numero(o?.previsto_peso_kg),
    previstoPallets: numero(p.previstoPallets) ?? numero(o?.previsto_pallets),
    previstoUnidades: numero(p.previstoUnidades),
    codNumero: texto(p.codNumero) ?? texto(o?.cod_numero),
    codEm: instante(p.codEm) ?? instante(o?.cod_data),
    semCod: p.semCod === true,
    etapas: (Array.isArray(p.etapas) ? p.etapas : [])
      .filter((e) => texto(e.nome))
      .map((e) => ({ nome: texto(e.nome)!, desde: instante(e.desde), estado: texto(e.estado) })),
  }
}

/** Os campos do lote a partir do que veio de lá. */
function camposDoLote(
  g: Guardado,
  base: string,
  agora: string,
  sistema: string = SISTEMA_GERENCIAMENTO,
) {
  const d = dadosExternos(g)
  const p = g.painel
  const status = statusDoPedido(p)
  const prevista =
    d.coletaPrevistaEm ??
    d.coletaAgendadaEm ??
    instante(p.primeiraPrevisaoEm) ??
    d.pedidoEm ??
    inicioDoDia(diaNoFuso(new Date(agora)))
  const chegou = status !== 'agendado' && status !== 'cancelado'
  const fim = status === 'concluido' ? (d.semCod ? instante(p.encerradoEm) : d.codEm) : null
  const desde = instante(p.etapa?.desde)
  const pallets = d.previstoPallets === null ? null : Math.round(d.previstoPallets)
  return {
    status,
    referenciaCliente: d.numero,
    coletaPrevista: prevista,
    dataColeta: d.coletaAgendadaEm,
    dataChegada: d.chegadaEm,
    // Chegada na Re-Teck = início do SLA; o COD é o fim (encerrada sem COD fica fora do SLA).
    // NUNCA inventadas: sem o dia lá, ficam vazias (ou o que já estava) — uma data de reserva
    // (o dia do COD, o da importação) faria um SLA de 0 dias e inflaria o cumprimento.
    recebidoEm: d.chegadaEm,
    chegou,
    codEmitidoEm: status === 'concluido' && !d.semCod ? (d.codEm ?? instante(p.encerradoEm)) : null,
    // Concluído = o dia do COD. O painel de lá, no COD, ainda traz a fase "Processando" com o
    // dia em que o PROCESSAMENTO começou (o COD encerra mesmo com a coleta processando) — usar
    // esse dia punha o Concluído antes do Aguardando COD na linha do tempo (achado no teste real).
    etapaDesdeReal: status === 'concluido' ? (fim ?? desde) : desde,
    etapaDesde: (status === 'concluido' ? (fim ?? desde) : desde) ?? agora,
    qtdPallets: pallets,
    observacoes: d.observacoes,
    escopo: texto(g.ordem?.escopo_trabalho) ?? 'Recycle Only',
    processamentoSistema: sistema,
    processamentoEtapa: texto(p.etapa?.nome),
    processamentoIndice: numero(p.etapa?.indice),
    processamentoTotal: numero(p.etapa?.total),
    processamentoDesde: desde,
    processamentoUrl: adaptadorDe(sistema).urlDaColeta(base, String(p.id), g.ordem),
    dados: d,
  }
}

const rotuloFase = (c: {
  processamentoEtapa: string | null
  processamentoIndice: number | null
  processamentoTotal: number | null
}) =>
  c.processamentoEtapa === null && c.processamentoIndice === null
    ? null
    : `${c.processamentoIndice ?? '?'}/${c.processamentoTotal ?? '?'}${c.processamentoEtapa ? ` · ${c.processamentoEtapa}` : ''}`

/* ------------------------------------------------------------------ adaptadores */

type Bruto = Record<string, unknown>
const lista = (v: unknown) => (Array.isArray(v) ? (v as Bruto[]) : [])

/**
 * O que muda de um sistema de origem para outro. O resto (cliente, site, doca, etapas, SLA,
 * histórico, falhas) é o mesmo motor — o formato interno é o do Gerenciamento.
 */
interface Adaptador {
  /**
   * Lote que some do painel e cuja ordem lá responde 404 foi EXCLUÍDO lá. No MSDC excluir é o
   * cancelamento (não há "cancelado" lá): o lote vira Cancelado aqui. No Gerenciamento (que tem
   * cancelado), só o aviso de "sumidos".
   */
  excluidoLaCancela: boolean
  /** O painel inteiro (com parâmetros, se o sistema os tiver). */
  urlDoPainel(urlPainel: string): string
  /** As coletas/lotes do painel, no formato interno. */
  pedidos(painel: unknown): PedidoPainel[]
  /** A ordem de lá (de `/api/integracao/ordens`), no formato interno. */
  ordem(bruta: OrdemGerenciamento): OrdemGerenciamento
  /** A tela da coleta/lote lá. */
  urlDaColeta(base: string, id: string, ordem: OrdemGerenciamento | null): string
  /** O espelho de lá (de `/ordens/:id/completa`) já desembrulhado. */
  espelho(bruto: unknown): Omit<EspelhoExterno, 'sistema' | 'url'>
}

const ADAPTADOR_GERENCIAMENTO: Adaptador = {
  excluidoLaCancela: false,
  urlDoPainel: (u) => u,
  pedidos: (painel) => {
    const p = (painel ?? {}) as { pedidos?: unknown }
    return (Array.isArray(p.pedidos) ? (p.pedidos as PedidoPainel[]) : []).filter(
      (x) => x && (typeof x.id === 'string' || typeof x.id === 'number'),
    )
  },
  ordem: (o) => o,
  urlDaColeta: (base, id) => `${base}/coletas/${encodeURIComponent(id)}`,
  espelho: (bruto) => espelhoDoGerenciamento((bruto ?? {}) as Bruto),
}

/**
 * Re-Teck MSDC (equip-rack-2, Microsoft): o painel traz `lotes` (no topo), com a carga que o
 * iERP antigo entregou e ainda não virou lote (`aguardandoLote`, id "chegada:…") — essa fica
 * de fora (vira lote lá quando os racks são contados). O fim do SLA da Microsoft é o
 * ENCERRAMENTO lá (não há COD). A ordem (rota nova lá, 20/10/2026) é o corpo da fila do iERP
 * antigo; os pallets previstos vêm das quantidades do agendamento. O espelho vem em
 * `{ success, data }`, sem pesagens nem arquivos (o anexo de lá exige sessão de lá).
 */
const ADAPTADOR_MSDC: Adaptador = {
  excluidoLaCancela: true,
  // Só 1 dia de peças do Harvesting: o iERP 2.0 não usa a produção, e os 35 dias são ~28 mil linhas.
  // (Troca o parâmetro se o endereço cadastrado já o tiver — repetido, lá vira lista e dá 400.)
  urlDoPainel: (u) => {
    const url = new URL(u)
    url.searchParams.set('diasDePecas', '1')
    return url.toString()
  },
  pedidos: (painel) =>
    lista((painel as { lotes?: unknown } | null)?.lotes)
      .filter(
        (l) =>
          (typeof l.id === 'string' || typeof l.id === 'number') &&
          l.aguardandoLote !== true &&
          !String(l.id).startsWith('chegada:'),
      )
      .map((l) => ({
        id: String(l.id),
        numero: texto(l.numero),
        lote: texto(l.lote),
        cliente: texto(l.cliente) ?? 'Microsoft',
        pedidoEm: texto(l.criadoEm),
        chegadaEm: texto(l.chegadaEm),
        codEm: texto(l.encerradoEm),
        encerradoEm: texto(l.encerradoEm),
        semCod: false,
        grupo: texto(l.grupo) ?? undefined,
        etapa: (l.etapa ?? null) as PedidoPainel['etapa'],
        etapas: lista(l.etapas) as PedidoPainel['etapas'],
        previstoPallets: null,
      })),
  ordem: (o) => {
    const q = ((o as unknown as Bruto).agendamento as Bruto | undefined)?.quantidades as
      Bruto | undefined
    return { ...o, previsto_pallets: numero(q?.pallets) ?? numero(o.previsto_pallets) }
  },
  urlDaColeta: (base, id, ordem) =>
    urlSegura(ordem?.url) ?? `${base}/lotes/${encodeURIComponent(id)}`,
  espelho: (bruto) => {
    const b = (bruto ?? {}) as Bruto
    const d = (b.data && typeof b.data === 'object' ? b.data : b) as Bruto
    return {
      declarado: { pesoKg: null, pallets: null },
      pesado: null,
      temPesagens: false,
      pesagens: [],
      arquivos: null,
      materiais: lista(d.materiais).map((m) => ({
        tipo: texto(m.tipo),
        descricao: texto(m.descricao),
        embalagem: texto(m.embalagem),
        pesoKg: numero(m.peso_kg),
      })),
      notas: [],
      seriais: numero(d.seriais) ?? 0,
      resumo: lista(d.resumo).map((r) => ({
        rotulo: texto(r.rotulo) ?? '—',
        valor: r.valor == null ? '—' : String(r.valor),
        detalhe: texto(r.detalhe),
      })),
    }
  },
}

const ADAPTADORES: Record<string, Adaptador> = {
  [SISTEMA_GERENCIAMENTO]: ADAPTADOR_GERENCIAMENTO,
  [SISTEMA_MSDC]: ADAPTADOR_MSDC,
}
const adaptadorDe = (sistema: string) => ADAPTADORES[sistema] ?? ADAPTADOR_GERENCIAMENTO

/* ------------------------------------------------------------------ sincronização */

export function criarSincronizacaoGerenciamento(db: Db, fazerFetch: Fetch = fetch) {
  const repoClientes = criarRepositorioClientes(db)
  const sites = criarServicoSites(criarRepositorioSites(db), repoClientes)

  /** O site do lote no cliente (pelo código), criado com a doca padrão se não existir. */
  async function garantirSiteEDoca(clienteId: string, d: DadosExternos, autor: string) {
    const codigo = codigoDoSite(d)
    const existentes = await db
      .selectFrom('clientesSites')
      .select(['id', 'codigo'])
      .where('clienteId', '=', clienteId)
      .execute()
    const site = existentes.find((s) => s.codigo.toLowerCase() === codigo.toLowerCase())
    // A doca: a do agendamento lá (pelo número), se veio; senão a primeira do site.
    const numeroDoca = d.doca?.slice(0, 20).trim() || null
    if (site) {
      const docas = await db
        .selectFrom('clientesDocas')
        .select(['id', 'numero', 'ordem'])
        .where('siteId', '=', site.id)
        .orderBy('ordem')
        .execute()
      const doca = numeroDoca
        ? docas.find((x) => x.numero.toLowerCase() === numeroDoca.toLowerCase())
        : docas[0]
      if (doca) return { siteId: site.id, docaId: doca.id }
      // A doca não existe no site: acrescenta (e o histórico do cliente diz).
      const docaId = randomUUID()
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('clientesDocas')
          .values({
            id: docaId,
            siteId: site.id,
            numero: numeroDoca ?? DOCA_PADRAO.numero,
            alturaMaxCaminhao: DOCA_PADRAO.alturaMaxCaminhao,
            comprimentoMaxCaminhao: null,
            dockLeveler: 0,
            tailLift: 0,
            areaLift: null,
            espaco: null,
            altura: null,
            voltagemShredder: null,
            pisoProtecaoObrigatorio: 0,
            ordem: docas.length ? Math.max(...docas.map((x) => x.ordem)) + 1 : 0,
          })
          .execute()
        await repoClientes.registrarHistorico(trx, clienteId, {
          autor,
          em: agoraIso(),
          acao: 'site_editado',
          nota: site.codigo,
          mudancas: [{ campo: 'docas', antes: null, depois: numeroDoca ?? DOCA_PADRAO.numero }],
        })
      })
      return { siteId: site.id, docaId }
    }
    const cidadeUf = [d.cidade, d.uf].filter(Boolean).join('/')
    const endereco = [d.endereco, cidadeUf].filter(Boolean).join(' – ').slice(0, 300) || null
    const novo = await sites.criar(
      clienteId,
      {
        codigo,
        regiao: regiaoDaUf(d.uf),
        horario: null,
        totalGaylords: null,
        cep: null,
        endereco,
        latitude: null,
        longitude: null,
        shredderProprio: false,
        edgeSite: false,
        contatoId: null,
        novoContato: null,
        docas: [{ ...DOCA_PADRAO, numero: numeroDoca ?? DOCA_PADRAO.numero }],
      },
      autor,
    )
    return { siteId: novo.id, docaId: novo.docas[0]!.id }
  }

  /**
   * Etapas da linha do tempo a partir da escada de lá (o dia mais antigo de cada etapa daqui).
   * Também ao mudar de status: se lá a coleta pulou etapas entre duas leituras (o iERP estava
   * fora), as do meio entram com o dia de lá.
   */
  function etapasDaEscada(g: Guardado, c: ReturnType<typeof camposDoLote>, criadoEm: string) {
    const quando = new Map<StatusLote, string>()
    quando.set('agendado', c.dados.pedidoEm ?? criadoEm)
    for (const e of g.painel.etapas ?? []) {
      const s = STATUS_DO_GRUPO[e.grupo ?? '']
      const em = instante(e.desde)
      if (!s || s === 'agendado' || !em || (e.estado !== 'feita' && e.estado !== 'atual')) continue
      if (!quando.has(s) || em < quando.get(s)!) quando.set(s, em)
    }
    if (!quando.has(c.status)) quando.set(c.status, c.etapaDesde)
    return [...quando.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }

  async function criarLote(
    integracao: IntegracoesTable,
    g: Guardado,
    clienteId: string,
    base: string,
  ) {
    const agora = agoraIso()
    const autor = integracao.nome
    const c = camposDoLote(g, base, agora, integracao.sistema)
    const { siteId, docaId } = await garantirSiteEDoca(clienteId, c.dados, autor)
    const cliente = await db
      .selectFrom('clientes')
      .select('nome')
      .where('id', '=', clienteId)
      .executeTakeFirstOrThrow()
    const site = await db
      .selectFrom('clientesSites')
      .select('codigo')
      .where('id', '=', siteId)
      .executeTakeFirstOrThrow()
    await db.transaction().execute(async (trx) => {
      const numeroLote = await proximoNumero(trx, 'ordens')
      const codigo = codigoCom('LOT', numeroLote)
      const id = randomUUID()
      await trx
        .insertInto('ordens')
        .values({
          id,
          numero: numeroLote,
          codigo,
          status: c.status,
          clienteId,
          siteId,
          docaId,
          transportadoraId: null,
          referenciaCliente: c.referenciaCliente,
          dataColeta: c.dataColeta,
          coletaPrevista: c.coletaPrevista,
          dataChegada: c.dataChegada,
          rastrear: 0,
          motoristaId: null,
          placa: null,
          psm: 0,
          onsiteShredding: 0,
          recycleOnly: 1,
          valueRecoveryRacks: 0,
          valueRecoveryItad: 0,
          qtdBoxes: null,
          qtdPallets: c.qtdPallets,
          qtdGaylords: null,
          qtdRacks: null,
          placasPolicarbonato: null,
          requerPalletsVazios: 0,
          qtdPalletsVazios: null,
          itensMais25kg: 0,
          fatorLimitante: null,
          escopo: c.escopo,
          observacoes: c.observacoes,
          calculo: null,
          busca: buscaDoLote(codigo, cliente.nome, site.codigo, c.dados),
          etapaDesde: c.etapaDesde,
          recebidoEm: c.recebidoEm,
          codEmitidoEm: c.codEmitidoEm,
          processamentoSistema: c.processamentoSistema,
          processamentoEtapa: c.processamentoEtapa,
          processamentoIndice: c.processamentoIndice,
          processamentoTotal: c.processamentoTotal,
          processamentoDesde: c.processamentoDesde,
          processamentoUrl: c.processamentoUrl,
          processamentoAtualizadoEm: agora,
          externoSistema: integracao.sistema,
          externoId: String(g.painel.id),
          externoDados: JSON.stringify(g),
          criadoEm: agora,
          criadoPor: autor,
          alteradoEm: agora,
          alteradoPor: autor,
        })
        .execute()
      await trx
        .insertInto('ordensEtapas')
        .values(
          etapasDaEscada(g, c, agora).map(([etapa, em]) => ({
            id: randomUUID(),
            ordemId: id,
            etapa,
            em,
            autor,
          })),
        )
        .execute()
      await registrarHistorico(trx, 'ordem', id, {
        autor,
        em: agora,
        acao: 'criado',
        nota: c.referenciaCliente ?? undefined,
      })
    })
  }

  type Ligado = Awaited<ReturnType<typeof lotesLigados>>[number]
  const lotesLigados = (sistema: string) =>
    db
      .selectFrom('ordensLista')
      .select([
        'id',
        'codigo',
        'externoId',
        'externoDados',
        'status',
        'clienteId',
        'clienteNome',
        'siteCodigo',
        'referenciaCliente',
        'coletaPrevista',
        'dataColeta',
        'dataChegada',
        'qtdPallets',
        'observacoes',
        'recebidoEm',
        'codEmitidoEm',
        'processamentoEtapa',
        'processamentoIndice',
        'processamentoTotal',
      ])
      .where('externoSistema', '=', sistema)
      .execute()

  async function atualizarLote(
    integracao: IntegracoesTable,
    l: Ligado,
    g: Guardado,
    antes: Guardado | null,
    base: string,
  ) {
    const agora = agoraIso()
    const autor = integracao.nome
    const c = camposDoLote(g, base, agora, integracao.sistema)
    // O site mudou LÁ? (Compara com o site de lá da leitura anterior — não com o cadastro daqui:
    // quem renomear aqui o site criado sozinho não ganha um site duplicado.)
    const codigoSite = codigoDoSite(c.dados)
    const dadosAntes = antes ? dadosExternos(antes) : null
    const siteAntes = dadosAntes ? codigoDoSite(dadosAntes) : l.siteCodigo
    // A doca também (reagendada lá para outra doca do mesmo site, ou preenchida depois).
    const docaMudou = (c.dados.doca ?? '').toLowerCase() !== (dadosAntes?.doca ?? '').toLowerCase()
    const novoSite =
      codigoSite.toLowerCase() !== siteAntes.toLowerCase() || (dadosAntes && docaMudou)
        ? await garantirSiteEDoca(l.clienteId, c.dados, autor)
        : null

    const mudancas: Mudanca[] = []
    const comparar = (campo: string, antes: Mudanca['antes'], depois: Mudanca['depois']) => {
      if ((antes ?? null) !== (depois ?? null)) mudancas.push({ campo, antes, depois })
    }
    comparar('referenciaCliente', l.referenciaCliente, c.referenciaCliente)
    comparar('coletaPrevista', l.coletaPrevista, c.coletaPrevista)
    comparar('dataColeta', l.dataColeta, c.dataColeta)
    comparar('dataChegada', l.dataChegada, c.dataChegada)
    comparar('pallets', l.qtdPallets, c.qtdPallets)
    comparar('observacoes', l.observacoes, c.observacoes)
    if (novoSite && codigoSite.toLowerCase() !== l.siteCodigo.toLowerCase())
      comparar('site', l.siteCodigo, codigoSite)
    if (novoSite && docaMudou) comparar('doca', dadosAntes?.doca ?? null, c.dados.doca)
    const etapasAntes = new Set(
      (
        await db.selectFrom('ordensEtapas').select('etapa').where('ordemId', '=', l.id).execute()
      ).map((e) => e.etapa),
    )
    const mudouStatus = l.status !== c.status
    const faseAntes = rotuloFase(l)
    const faseDepois = rotuloFase(c)

    await db.transaction().execute(async (trx: Trx) => {
      await trx
        .updateTable('ordens')
        .set({
          status: c.status,
          referenciaCliente: c.referenciaCliente,
          coletaPrevista: c.coletaPrevista,
          dataColeta: c.dataColeta,
          dataChegada: c.dataChegada,
          // Sem o dia de lá, mantém o que já estava (o SLA não anda sozinho a cada leitura).
          recebidoEm: c.recebidoEm ?? (c.chegou ? l.recebidoEm : null),
          codEmitidoEm:
            c.codEmitidoEm ?? (c.status === 'concluido' && !c.dados.semCod ? l.codEmitidoEm : null),
          qtdPallets: c.qtdPallets,
          observacoes: c.observacoes,
          escopo: c.escopo,
          ...(novoSite ? { siteId: novoSite.siteId, docaId: novoSite.docaId } : {}),
          // Entrou na etapa: o dia de lá (corrigido lá, corrige aqui); sem ele, só ao mudar.
          ...(c.etapaDesdeReal
            ? { etapaDesde: c.etapaDesdeReal }
            : mudouStatus
              ? { etapaDesde: c.etapaDesde }
              : {}),
          busca: buscaDoLote(
            l.codigo,
            l.clienteNome,
            novoSite ? codigoSite : l.siteCodigo,
            c.dados,
          ),
          processamentoEtapa: c.processamentoEtapa,
          processamentoIndice: c.processamentoIndice,
          processamentoTotal: c.processamentoTotal,
          processamentoDesde: c.processamentoDesde,
          processamentoUrl: c.processamentoUrl,
          processamentoAtualizadoEm: agora,
          externoDados: JSON.stringify(g),
          ...(mudancas.length || mudouStatus || faseAntes !== faseDepois
            ? { alteradoEm: agora, alteradoPor: autor }
            : {}),
        })
        .where('id', '=', l.id)
        .execute()
      if (mudouStatus) {
        // As etapas do meio que lá passaram entre duas leituras (com o dia de lá) e a nova.
        const meio = etapasDaEscada(g, c, agora).filter(
          ([etapa]) => etapa !== c.status && etapa !== 'agendado' && !etapasAntes.has(etapa),
        )
        await trx
          .insertInto('ordensEtapas')
          .values([
            ...meio.map(([etapa, em]) => ({ id: randomUUID(), ordemId: l.id, etapa, em, autor })),
            { id: randomUUID(), ordemId: l.id, etapa: c.status, em: c.etapaDesde, autor },
          ])
          .execute()
        await registrarHistorico(trx, 'ordem', l.id, {
          autor,
          em: agora,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: l.status, depois: c.status }],
        })
      }
      if (faseAntes !== faseDepois)
        await registrarHistorico(trx, 'ordem', l.id, {
          autor,
          em: agora,
          acao: 'processamento',
          mudancas: [{ campo: 'processamento', antes: faseAntes, depois: faseDepois }],
        })
      if (mudancas.length)
        await registrarHistorico(trx, 'ordem', l.id, {
          autor,
          em: agora,
          acao: 'editado',
          mudancas,
        })
    })
  }

  /** Lê o Gerenciamento e cria/atualiza os lotes. */
  async function sincronizar(integracao: IntegracoesTable) {
    const quando = agoraIso()
    const falhar = async (erro: string) => {
      await db
        .updateTable('integracoes')
        .set({ ultimoErro: `Painel: ${erro}`, ultimoErroEm: quando })
        .where('id', '=', integracao.id)
        .execute()
      return { ok: false as const, erro }
    }
    if (!integracao.urlPainel || !integracao.tokenPainel)
      return falhar('Sem endereço ou token do painel cadastrado.')
    const base = baseDoGerenciamento(integracao.urlPainel)
    const token = integracao.tokenPainel
    const adaptador = adaptadorDe(integracao.sistema)
    // HTTPS com a CA do sistema (cadastrada na Integração): a confiança vale só aqui.
    const rede = fetchComCa(integracao.caPainel, fazerFetch)
    const pedir = async <T>(url: string, espera = TIMEOUT_MS): Promise<T> => {
      const r = await rede(url, {
        headers: { 'X-Reteck-Token': token, 'X-Api-Key': token },
        signal: AbortSignal.timeout(espera),
      })
      if (!r.ok) throw new Error(`O sistema respondeu ${r.status}.`)
      return (await r.json()) as T
    }

    const anterior = lerResumoGuardado(integracao.sincronizacao)
    let pedidos: PedidoPainel[]
    try {
      pedidos = adaptador.pedidos(
        await pedir(adaptador.urlDoPainel(integracao.urlPainel), TIMEOUT_PAINEL_MS),
      )
    } catch (e) {
      // Sem o painel não há o que fazer nesta leitura (os lotes ficam como estão).
      return falhar(`Não consegui ler o ${integracao.nome}: ${(e as Error).message}`)
    }

    const falhas: ResumoSincronizacao['falhas'] = []
    const anotar = (coleta: string, e: unknown) => {
      const erro = e instanceof Error ? e.message : String(e)
      console.error(`[gerenciamento] ${coleta}: ${erro}`)
      if (falhas.length < 10) falhas.push({ coleta, erro })
    }
    const falhou = (p: PedidoPainel, e: unknown) => anotar(p.numero ?? String(p.id), e)

    // Os dados das ordens (site, transportadora…). Falhar aqui NÃO para a leitura: o painel já
    // veio, e os lotes que existem mudam de etapa do mesmo jeito.
    const ordens = new Map<string, OrdemGerenciamento>()
    const guardarOrdens = (lista: unknown) => {
      for (const o of Array.isArray(lista) ? (lista as OrdemGerenciamento[]) : [])
        if (o && (typeof o.id === 'string' || typeof o.id === 'number'))
          ordens.set(String(o.id), adaptador.ordem(o))
    }
    try {
      // As que mudaram desde ontem (o "desde" de lá é por dia).
      const ontem = somarDias(diaNoFuso(), -1)
      guardarOrdens(
        await pedir(`${base}/api/integracao/ordens?desde=${ontem}&limite=2000`, TIMEOUT_PAINEL_MS),
      )
    } catch (e) {
      anotar('Ordens mudadas desde ontem', e)
    }

    const ligadosLista = await lotesLigados(integracao.sistema)
    const ligados = new Map(ligadosLista.map((l) => [l.externoId!, l]))
    const guardado = (l: Ligado): Guardado | null => {
      try {
        return l.externoDados ? (JSON.parse(l.externoDados) as Guardado) : null
      } catch {
        return null
      }
    }

    // LIXEIRA de lá: restaurar uma coleta a recria com OUTRO id. Coleta nova com o número de um
    // lote cujo id sumiu do painel = a mesma coleta → religa o lote (nada de lote duplicado).
    const noPainel = new Set(pedidos.map((p) => String(p.id)))
    const sumidosPorNumero = new Map<string, Ligado>()
    for (const l of ligadosLista)
      if (!noPainel.has(l.externoId!) && l.referenciaCliente)
        sumidosPorNumero.set(`${l.clienteNome}|${l.referenciaCliente}`, l)
    for (const p of pedidos) {
      const id = String(p.id)
      if (ligados.has(id) || !texto(p.numero)) continue
      for (const [chave, l] of sumidosPorNumero) {
        if (
          !chave.endsWith(`|${texto(p.numero)}`) ||
          !padraoDoCliente(texto(p.cliente) ?? '—').test(normalizar(l.clienteNome))
        )
          continue
        try {
          await db.transaction().execute(async (trx) => {
            await trx.updateTable('ordens').set({ externoId: id }).where('id', '=', l.id).execute()
            await registrarHistorico(trx, 'ordem', l.id, {
              autor: integracao.nome,
              em: agoraIso(),
              acao: 'editado',
              nota: `Religado à coleta ${id} do ${integracao.nome} (restaurada da Lixeira de lá).`,
            })
          })
          ligados.set(id, { ...l, externoId: id })
          sumidosPorNumero.delete(chave)
        } catch (e) {
          falhou(p, e)
        }
        break
      }
    }

    // O CLIENTE de cada coleta nova (pelo nome que vem no painel). Só as que têm cliente aqui
    // buscam os dados da ordem: a coleta que espera o cadastro do cliente não custa nada lá.
    const clientes = await db.selectFrom('clientes').select(['id', 'nome', 'status']).execute()
    const pendencias = new Map<string, ResumoSincronizacao['pendencias'][number]>()
    const novas: { p: PedidoPainel; clienteId: string }[] = []
    for (const p of pedidos) {
      if (ligados.has(String(p.id))) continue
      // TODAS as coletas do Brasil viram lote, inclusive as concluídas e as canceladas — como no
      // iERP antigo (decisão do usuário, 20/10/2026: "importar todas na primeira leitura").
      const rotulo = texto(p.cliente) ?? '—'
      const padrao = padraoDoCliente(rotulo)
      const comNome = clientes.filter((c) => padrao.test(normalizar(c.nome)))
      const ativos = comNome.filter((c) => c.status === 'ativo')
      if (ativos.length !== 1) {
        const motivo =
          ativos.length > 1 ? 'varios_clientes' : comNome.length ? 'cliente_inativo' : 'sem_cliente'
        const pend = pendencias.get(rotulo) ?? { cliente: rotulo, coletas: 0, motivo }
        pend.coletas++
        pendencias.set(rotulo, pend)
        continue
      }
      novas.push({ p, clienteId: ativos[0]!.id })
    }

    // A lista INTEIRA de ordens: na 1ª carga (muitas novas de uma vez) e de 6 em 6 horas (o que
    // muda lá sem mudar a data da coleta). Falhar aqui também não para a leitura.
    let faltam = novas.filter((n) => !ordens.has(String(n.p.id)))
    let cargaCompletaEm = anterior?.cargaCompletaEm ?? null
    const cargaVencida =
      !cargaCompletaEm || Date.parse(quando) - Date.parse(cargaCompletaEm) > CARGA_COMPLETA_MS
    if (faltam.length > 20 || (cargaVencida && ligados.size > 0))
      try {
        guardarOrdens(await pedir(`${base}/api/integracao/ordens?limite=2000`, TIMEOUT_LISTA_MS))
        cargaCompletaEm = quando
        faltam = faltam.filter((n) => !ordens.has(String(n.p.id)))
      } catch (e) {
        anotar('Lista inteira de ordens', e)
      }
    // As que ainda faltarem (a lista de lá tem limite e pode filtrar clientes): uma a uma.
    for (const n of faltam.slice(0, MAX_UMA_A_UMA))
      try {
        ordens.set(
          String(n.p.id),
          adaptador.ordem(
            await pedir<OrdemGerenciamento>(
              `${base}/api/integracao/ordens/${encodeURIComponent(String(n.p.id))}`,
            ),
          ),
        )
      } catch (e) {
        falhou(n.p, e)
      }

    let criados = 0
    // Um erro num lote não trava os outros (nem a próxima leitura).
    for (const p of pedidos) {
      const l = ligados.get(String(p.id))
      if (!l) continue
      try {
        const antes = guardado(l)
        const g: Guardado = { ordem: ordens.get(String(p.id)) ?? antes?.ordem ?? null, painel: p }
        if (JSON.stringify(g) !== l.externoDados) await atualizarLote(integracao, l, g, antes, base)
      } catch (e) {
        falhou(p, e)
      }
    }
    for (const { p, clienteId } of novas) {
      const ordem = ordens.get(String(p.id))
      // Sem os dados da ordem (site, endereço…), o lote espera a próxima leitura — criar sem
      // eles faria um lote "Sem site".
      if (!ordem) continue
      try {
        await criarLote(integracao, { ordem, painel: p }, clienteId, base)
        criados++
      } catch (e) {
        falhou(p, e)
      }
    }

    // Lotes cuja coleta não vem mais no painel (excluída lá, ou fora do Brasil). No sistema em
    // que excluir é cancelar (MSDC), confirma lá (a ordem responde 404) e o lote vira Cancelado —
    // sem a confirmação (ou já concluído), fica como está e a Integração avisa.
    const foraDoPainel = [...ligados.values()].filter((l) => !noPainel.has(l.externoId!))
    const cancelados = new Set<string>()
    if (adaptador.excluidoLaCancela)
      for (const l of foraDoPainel
        .filter((x) => x.status !== 'cancelado' && x.status !== 'concluido')
        .slice(0, MAX_UMA_A_UMA)) {
        try {
          const r = await rede(
            `${base}/api/integracao/ordens/${encodeURIComponent(l.externoId!)}`,
            {
              headers: { 'X-Reteck-Token': token, 'X-Api-Key': token },
              signal: AbortSignal.timeout(TIMEOUT_MS),
            },
          )
          if (r.status !== 404) continue
          const agora = agoraIso()
          await db.transaction().execute(async (trx) => {
            await trx
              .updateTable('ordens')
              .set({
                status: 'cancelado',
                etapaDesde: agora,
                alteradoEm: agora,
                alteradoPor: integracao.nome,
              })
              .where('id', '=', l.id)
              .execute()
            await trx
              .insertInto('ordensEtapas')
              .values({
                id: randomUUID(),
                ordemId: l.id,
                etapa: 'cancelado',
                em: agora,
                autor: integracao.nome,
              })
              .execute()
            await registrarHistorico(trx, 'ordem', l.id, {
              autor: integracao.nome,
              em: agora,
              acao: 'status',
              nota: `Excluído no ${integracao.nome}.`,
              mudancas: [{ campo: 'status', antes: l.status, depois: 'cancelado' }],
            })
          })
          cancelados.add(l.id)
        } catch (e) {
          anotar(l.referenciaCliente ?? l.codigo, e)
        }
      }
    const sumidos = foraDoPainel
      .filter((l) => !cancelados.has(l.id) && l.status !== 'cancelado')
      .map((l) => ({ codigo: l.codigo, referencia: l.referenciaCliente }))

    const resumo: ResumoSincronizacao = {
      em: quando,
      coletas: pedidos.length,
      ligadas: pedidos.filter((p) => ligados.has(String(p.id))).length + criados,
      criados,
      pendencias: [...pendencias.values()].sort((a, b) => a.cliente.localeCompare(b.cliente)),
      falhas,
      sumidos: sumidos.slice(0, 50),
      cargaCompletaEm,
    }
    await db
      .updateTable('integracoes')
      .set({
        ultimoPainelEm: quando,
        sincronizacao: JSON.stringify(resumo),
        ultimoErro: null,
        ultimoErroEm: null,
      })
      .where('id', '=', integracao.id)
      .execute()
    return { ok: true as const, ...resumo }
  }

  return { sincronizar }
}

/** O resumo guardado da leitura anterior (null se não houver ou estiver ilegível). */
export function lerResumoGuardado(texto: string | null): ResumoSincronizacao | null {
  if (!texto) return null
  try {
    const r = JSON.parse(texto) as Partial<ResumoSincronizacao>
    return {
      ...(r as ResumoSincronizacao),
      falhas: r.falhas ?? [],
      sumidos: r.sumidos ?? [],
      cargaCompletaEm: r.cargaCompletaEm ?? null,
    }
  } catch {
    return null
  }
}

/** Texto da busca geral do lote. */
const buscaDoLote = (codigo: string, cliente: string, site: string, d: DadosExternos) =>
  normalizar(
    [
      codigo,
      cliente,
      site,
      d.numero ?? '',
      d.lote ?? '',
      d.transportadora ?? '',
      d.cidade ?? '',
    ].join(' '),
  )

/* ------------------------------------------------------------------ espelho (ao abrir o lote) */

/** O que aconteceu lá: pesagens com foto, documentos e materiais (contrato da API). */
export interface EspelhoExterno {
  sistema: string
  /** Tela da ordem lá. */
  url: string | null
  declarado: { pesoKg: number | null; pallets: number | null }
  pesado: { pesoKg: number; pallets: number; pesagens: number; fotos: number } | null
  pesagens: {
    id: string
    pesoKg: number | null
    pallets: number | null
    conteudo: string | null
    pesadoPor: string | null
    pesadoEm: string | null
    fotoUrl: string | null
  }[]
  /** null = o sistema não compartilha os arquivos (o anexo de lá exige o login de lá). */
  arquivos:
    | {
        id: string
        tipo: string | null
        nome: string
        enviadoPor: string | null
        enviadoEm: string | null
        url: string | null
      }[]
    | null
  materiais: {
    tipo: string | null
    descricao: string | null
    embalagem: string | null
    pesoKg: number | null
  }[]
  notas: { autor: string | null; data: string | null; texto: string }[]
  seriais: number
  /** O sistema registra pesagens? (o Gerenciamento sim; o MSDC não). */
  temPesagens: boolean
  /** Resumo do que aconteceu lá, como ele escreve (MSDC: etapa, racks, máquinas, peças). */
  resumo: { rotulo: string; valor: string; detalhe: string | null }[]
}

/** O conteúdo da pesagem: lá é uma lista em JSON (`["Rádios","Antenas"]`) → "Rádios, Antenas". */
function conteudoDaPesagem(v: unknown) {
  const s = texto(v)
  if (!s) return null
  try {
    const lista: unknown = JSON.parse(s)
    if (Array.isArray(lista)) return lista.map(String).filter(Boolean).join(', ') || null
  } catch {
    // texto solto: vai como está
  }
  return s
}

/** Só endereço http(s) vai para a tela (o link e a foto abrem no navegador). */
const urlSegura = (v: unknown) => {
  const s = texto(v)
  return s && /^https?:\/\//i.test(s) ? s : null
}

/** Busca o espelho no sistema de onde o lote veio (ao vivo; nada fica guardado aqui). */
export async function espelhoDoLote(
  db: Db,
  ordemId: string,
  fazerFetch: Fetch = fetch,
): Promise<EspelhoExterno> {
  const o = await db
    .selectFrom('ordens')
    .select(['externoSistema', 'externoId', 'processamentoUrl'])
    .where('id', '=', ordemId)
    .executeTakeFirst()
  if (!o) throw naoEncontrado('Lote não encontrado.')
  if (!o.externoSistema || !o.externoId)
    throw new ErroApi(404, 'not_found', 'Este lote não veio de outro sistema.')
  const integracao = await db
    .selectFrom('integracoes')
    .selectAll()
    .where('sistema', '=', o.externoSistema)
    .executeTakeFirst()
  if (!integracao?.urlPainel || !integracao.tokenPainel)
    throw new ErroApi(
      503,
      'external_unavailable',
      'A integração com o sistema de onde o lote veio não está configurada.',
    )
  const base = baseDoGerenciamento(integracao.urlPainel)
  let e: unknown
  try {
    const r = await fetchComCa(integracao.caPainel, fazerFetch)(
      `${base}/api/integracao/ordens/${encodeURIComponent(o.externoId)}/completa`,
      {
        headers: { 'X-Reteck-Token': integracao.tokenPainel, 'X-Api-Key': integracao.tokenPainel },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )
    if (!r.ok) throw new Error(`respondeu ${r.status}`)
    e = await r.json()
  } catch {
    throw new ErroApi(
      502,
      'external_unavailable',
      `Não consegui falar com o ${integracao.nome} agora.`,
    )
  }
  return {
    sistema: o.externoSistema,
    url: o.processamentoUrl,
    ...adaptadorDe(o.externoSistema).espelho(e),
  }
}

/** O espelho do Gerenciamento (pesagens com foto, documentos, materiais, notas). */
function espelhoDoGerenciamento(e: Bruto): Omit<EspelhoExterno, 'sistema' | 'url'> {
  const declarado = (e.declarado ?? {}) as Bruto
  const pesado = e.pesado as Bruto | null
  return {
    temPesagens: true,
    resumo: [],
    // Lá, o declarado vazio chega como 0 (e 0 kg declarado não existe): vira "não informado".
    declarado: {
      pesoKg: numero(declarado.peso_kg) || null,
      pallets: numero(declarado.qtd_pallets) || null,
    },
    pesado: pesado
      ? {
          pesoKg: numero(pesado.peso_kg) ?? 0,
          pallets: numero(pesado.qtd_pallets) ?? 0,
          pesagens: numero(pesado.pesagens) ?? 0,
          fotos: numero(pesado.fotos) ?? 0,
        }
      : null,
    pesagens: lista(e.pesagens).map((p, i) => ({
      id: String(p.id ?? i),
      pesoKg: numero(p.peso_kg),
      pallets: numero(p.qtd_pallets),
      conteudo: conteudoDaPesagem(p.conteudo),
      pesadoPor: texto(p.pesado_por),
      pesadoEm: dataHora(p.pesado_em, 'sp'),
      fotoUrl: urlSegura(p.foto_url),
    })),
    arquivos: lista(e.arquivos).map((a, i) => ({
      id: String(a.id ?? i),
      tipo: texto(a.tipo),
      nome: texto(a.nome) ?? '—',
      enviadoPor: texto(a.enviado_por),
      enviadoEm: dataHora(a.enviado_em, 'utc'),
      url: urlSegura(a.url),
    })),
    materiais: lista(e.materiais).map((m) => ({
      tipo: texto(m.tipo),
      descricao: texto(m.descricao),
      embalagem: texto(m.embalagem),
      pesoKg: numero(m.peso_kg),
    })),
    notas: lista(e.notas)
      .filter((n) => texto(n.texto))
      .map((n) => ({
        autor: texto(n.autor),
        data: dataHora(n.data, 'sp'),
        texto: texto(n.texto)!,
      })),
    seriais: numero(e.seriais) ?? 0,
  }
}

/** `GET /api/ordens/:id/externo` — o espelho do lote que veio de outro sistema. */
export function rotasLotesDeFora(db: Db, fazerFetch: Fetch = fetch) {
  const r = Router()
  r.get('/:id/externo', async (req, res) => {
    res.json(await espelhoDoLote(db, String(req.params.id), fazerFetch))
  })
  return r
}
