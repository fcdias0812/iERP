import { http, HttpResponse } from 'msw/http'
import { runQuery, type EngineColumn } from '@/components/data-table/engine'
import { searchToQuery, tableSearchSchema } from '@/components/data-table/url-state'
import type {
  EspelhoExterno,
  AvisoCalculo,
  CalculoOs,
  Doca,
  OcorrenciaInput,
  Ordem,
  RecebimentoInput,
  FotoRecebimento,
  TipoDocumentoLote,
  OrdemInput,
  OrdemResumo,
  QuantidadesOs,
  ServicosOs,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'
import { getDb } from '../db'
import { getRelacionamento } from './relacionamento'

/*
 * API SIMULADA de ordens (mesmo contrato de server/src/modules/ordens): usada nos testes e2e e
 * na demonstração sem backend. O pré-cálculo repete as regras do servidor (ordens.calculo.ts)
 * de forma resumida — a fonte da verdade é o servidor.
 */

const autor = () => useSessionStore.getState().user.name
let ordens: Ordem[] | null = null
/** Fotos das ocorrências enviadas na sessão (id → arquivo). */
const fotos = new Map<string, File>()
const TIPOS_DOC: TipoDocumentoLote[] = ['escopo', 'nota_fiscal', 'mtr', 'cdf', 'foto', 'outro']
let seq = 0
const novoId = (prefixo: string) => `${prefixo}${Date.now().toString(36)}${(seq++).toString(36)}`

/** Lotes criados na sessão (o dashboard simulado usa para a previsão de chegada). */
export const ordensMock = () => lotes()

/** Lote de demonstração (ord00001): em processo, com pallets recebidos e uma ocorrência. */
function semente(): Ordem {
  const cliente = getDb().clientes[0]!
  const site = getDb().sites[cliente.id]![0]!
  const doca = site.docas[0]!
  const dia = (d: number) => {
    const x = new Date()
    x.setUTCDate(x.getUTCDate() - d)
    return `${x.toISOString().slice(0, 10)}T03:00:00.000Z`
  }
  const quando = (d: number, h: number) => dia(d).replace('T03:', `T${String(h).padStart(2, '0')}:`)
  return {
    id: 'ord00001',
    codigo: 'LOT-00001',
    status: 'processo',
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    siteId: site.id,
    siteCodigo: site.codigo,
    docaId: doca.id,
    docaNumero: doca.numero,
    transportadoraId: null,
    transportadoraNome: null,
    referenciaCliente: 'PO-7781',
    dataColeta: dia(6),
    coletaPrevista: dia(6),
    dataChegada: dia(5),
    rastrear: false,
    motoristaId: null,
    motoristaNome: null,
    placa: null,
    servicos: {
      psm: false,
      onsiteShredding: false,
      recycleOnly: true,
      valueRecoveryRacks: true,
      valueRecoveryItad: false,
    },
    quantidades: {
      boxes: 4,
      pallets: 6,
      gaylords: 2,
      racks: 3,
      placasPolicarbonato: 8,
      requerPalletsVazios: false,
      palletsVazios: null,
      itensMais25kg: true,
      fatorLimitante: null,
    },
    totalVolumes: 11,
    escopo: 'Retirar 3 racks e 6 pallets de equipamentos do data center.',
    observacoes: null,
    anexos: [],
    calculo: null,
    recebidoEm: quando(5, 13),
    etapaDesde: quando(4, 12),
    codEmitidoEm: null,
    processamento: null,
    devolucao: null,
    externo: null,
    externoDados: null,
    criadoEm: quando(8, 12),
    criadoPor: 'Sistema',
    alteradoEm: quando(4, 12),
    alteradoPor: 'Sistema',
    historico: [
      {
        id: 'h-ord00001-oc1',
        autor: 'Sistema',
        em: quando(6, 15),
        acao: 'ocorrencia_registrada',
        nota: '#1',
        mudancas: [
          { campo: 'momento', antes: null, depois: 'coleta' },
          { campo: 'categoria', antes: null, depois: 'atraso' },
          { campo: 'texto', antes: null, depois: 'Caminhão chegou 2 horas depois do combinado.' },
        ],
      },
      {
        id: 'h-ord00001-rec',
        autor: 'Sistema',
        em: quando(5, 13),
        acao: 'recebido',
        mudancas: [
          { campo: 'status', antes: 'agendado', depois: 'inspecao' },
          { campo: 'inspecao', antes: null, depois: 'bom' },
          { campo: 'palletsRecebidos', antes: null, depois: 2 },
        ],
      },
      { id: 'h-ord00001', autor: 'Sistema', em: quando(8, 12), acao: 'criado' },
    ],
    etapas: [
      { etapa: 'agendado', em: quando(8, 12) },
      { etapa: 'inspecao', em: quando(5, 13) },
      { etapa: 'processo', em: quando(4, 12) },
    ],
    pallets: [
      {
        id: 'pal00001',
        numero: 1,
        pesoKg: 412.5,
        conteudo: 'Servidores rack 1U',
        pesadoPor: 'Ana Souza',
        pesadoEm: quando(5, 13),
        temFoto: false,
        origem: 'iERP',
        taraKg: null,
        pesoLiquidoKg: null,
        fotos: [],
      },
      {
        id: 'pal00002',
        numero: 2,
        pesoKg: 388,
        conteudo: 'Switches e cabos',
        pesadoPor: 'Ana Souza',
        pesadoEm: quando(5, 14),
        temFoto: false,
        origem: 'iERP',
        taraKg: null,
        pesoLiquidoKg: null,
        fotos: [],
      },
    ],
    recebimento: {
      dataRecebimento: dia(5),
      inspecao: 'bom',
      inspecaoDescricao: null,
      ocorrenciaId: null,
      lacres: [],
      notas: [],
      fotosGerais: [],
      criadoEm: quando(5, 13),
      criadoPor: 'Sistema',
      alteradoEm: quando(5, 13),
      alteradoPor: 'Sistema',
    },
    // Balanço parcial (lote ainda em processo): a embalagem já pesada, parte das peças lida.
    balanco: {
      sistema: 'MOONSHOT',
      recebidoEm: quando(1, 16),
      brutoKg: 1028,
      embalagemKg: 96.5,
      lidoKg: 702.4,
      scrapRecebidoKg: 180,
      scrapTriadoKg: 171.2,
      toleranciaPercent: 2,
      pecasLidas: 412,
      pecasSemPeso: 3,
      foraDaLista: 2,
      liquidoKg: 931.5,
      contabilizadoKg: 873.6,
      diferencaKg: 57.9,
      diferencaPercent: 6.2158,
      situacao: 'parcial',
      commodities: [
        { codigo: 'PCB', rotulo: 'Placas de circuito', pesoKg: 318.6 },
        { codigo: 'METAL', rotulo: 'Metais ferrosos', pesoKg: 402.3 },
        { codigo: 'PLASTIC', rotulo: 'Plásticos', pesoKg: 152.7 },
      ],
      containers: [
        {
          codigo: 'BB-0101',
          categoria: 'PCB',
          categoriaRotulo: 'Placas de circuito',
          situacao: 'fechado',
          brutoKg: 640,
          taraKg: 12,
          desteLoteKg: 318.6,
          destino: null,
          fechadoEm: quando(1, 15),
          embarcadoEm: null,
        },
        {
          codigo: 'BB-0102',
          categoria: 'METAL',
          categoriaRotulo: 'Metais ferrosos',
          situacao: 'aberto',
          brutoKg: null,
          taraKg: 12,
          desteLoteKg: 402.3,
          destino: null,
          fechadoEm: null,
          embarcadoEm: null,
        },
      ],
    },
    ocorrencias: [
      {
        id: 'oco00001',
        numero: 1,
        momento: 'coleta',
        categoria: 'atraso',
        texto: {
          origem: 'pt-BR',
          textos: {
            'pt-BR': 'Caminhão chegou 2 horas depois do combinado.',
            en: 'The truck arrived 2 hours later than agreed.',
            'zh-TW': '卡車比約定時間晚了 2 小時抵達。',
          },
          automaticos: ['en', 'zh-TW'],
        },
        status: 'registrada',
        fotos: [],
        criadoEm: quando(6, 15),
        criadoPor: 'Sistema',
        alteradoEm: quando(6, 15),
        alteradoPor: 'Sistema',
      },
    ],
  }
}

/** Lotes da sessão (o de demonstração é criado na primeira consulta). */
function lotes(): Ordem[] {
  ordens ??= [semente()]
  return ordens
}

/**
 * Lote de demonstração do Gerenciamento de Projetos (ordgp001): só para ver — abre pelo endereço
 * (fica fora da lista para não mudar a numeração dos lotes que os testes criam).
 */
function loteDoGerenciamento(): Ordem {
  const base = semente()
  const url = 'http://localhost:5005/coletas/1834'
  return {
    ...base,
    id: 'ordgp001',
    codigo: 'LOT-00090',
    status: 'processo',
    referenciaCliente: 'ECO_2608_5498157_BR',
    transportadoraId: null,
    transportadoraNome: null,
    rastrear: false,
    calculo: null,
    pallets: [],
    ocorrencias: [],
    recebimento: null,
    balanco: null,
    anexos: [],
    processamento: {
      sistema: 'GERENCIAMENTO',
      etapa: 'Processando',
      indice: 6,
      total: 8,
      desde: base.etapaDesde,
      url,
      atualizadoEm: base.alteradoEm,
    },
    externo: { sistema: 'GERENCIAMENTO', url },
    externoDados: {
      numero: 'ECO_2608_5498157_BR',
      lote: 'LT-5498157',
      cliente: 'Ericsson',
      site: base.siteCodigo,
      endereco: null,
      cidade: 'Indaiatuba',
      uf: 'SP',
      pais: 'Brazil',
      transportadora: 'Transportadora Alfa',
      observacoes: 'Coleta na doca 3',
      pedidoEm: base.criadoEm,
      coletaAgendadaEm: base.coletaPrevista,
      coletaPrevistaEm: base.coletaPrevista,
      chegadaEm: base.recebidoEm,
      previstoPesoKg: 4959.6,
      previstoPallets: 17,
      previstoUnidades: null,
      codNumero: null,
      codEm: null,
      semCod: false,
      etapas: [
        { nome: 'Solicitada', desde: base.criadoEm, estado: 'feita' },
        { nome: 'Recebida', desde: base.recebidoEm, estado: 'feita' },
        { nome: 'Processando', desde: base.etapaDesde, estado: 'atual' },
        { nome: 'Aguardando COD', desde: null, estado: 'pendente' },
      ],
    },
    historico: [
      { id: 'h-ordgp001', autor: 'Gerenciamento de Projetos', em: base.criadoEm, acao: 'criado' },
    ],
    criadoPor: 'Gerenciamento de Projetos',
    alteradoPor: 'Gerenciamento de Projetos',
  }
}

/** O espelho do lote do Gerenciamento (o que aconteceu lá: pesagens, documentos, materiais). */
const espelhoDoGerenciamento = (): EspelhoExterno => ({
  sistema: 'GERENCIAMENTO',
  url: 'http://localhost:5005/coletas/1834',
  declarado: { pesoKg: 4959.6, pallets: 17 },
  pesado: { pesoKg: 1212.5, pallets: 4, pesagens: 2, fotos: 0 },
  pesagens: [
    {
      id: '7',
      pesoKg: 612.5,
      pallets: 2,
      conteudo: 'Rádios',
      pesadoPor: 'Ana Souza',
      pesadoEm: '2026-10-18T13:00:00.000Z',
      fotoUrl: null,
    },
    {
      id: '8',
      pesoKg: 600,
      pallets: 2,
      conteudo: 'Antenas',
      pesadoPor: 'Ana Souza',
      pesadoEm: '2026-10-18T13:20:00.000Z',
      fotoUrl: null,
    },
  ],
  arquivos: [
    {
      id: '3',
      tipo: 'laudo',
      nome: 'Laudo de recebimento.pdf',
      enviadoPor: 'Bruno Lima',
      enviadoEm: '2026-10-18T15:00:00.000Z',
      url: 'http://localhost:5005/api/collections/1834/laudo/foto/laudo.pdf',
    },
  ],
  materiais: [{ tipo: 'Placas', descricao: 'Placas de rádio', embalagem: 'Gaylord', pesoKg: 320 }],
  notas: [{ autor: 'Bruno Lima', data: '2026-10-18', texto: 'Chegou com lacre.' }],
  seriais: 0,
})

const COLS: EngineColumn<OrdemResumo>[] = [
  { id: 'codigo', type: 'unique-text', accessor: (r) => r.codigo },
  { id: 'clienteNome', type: 'unique-text', accessor: (r) => r.clienteNome },
  { id: 'siteCodigo', type: 'unique-text', accessor: (r) => r.siteCodigo },
  { id: 'docaNumero', type: 'unique-text', accessor: (r) => r.docaNumero },
  { id: 'referenciaCliente', type: 'unique-text', accessor: (r) => r.referenciaCliente },
  { id: 'transportadoraNome', type: 'unique-text', accessor: (r) => r.transportadoraNome },
  { id: 'dataColeta', type: 'date', accessor: (r) => r.dataColeta },
  { id: 'coletaPrevista', type: 'date', accessor: (r) => r.coletaPrevista },
  { id: 'dataChegada', type: 'date', accessor: (r) => r.dataChegada },
  { id: 'rastrear', type: 'boolean', accessor: (r) => r.rastrear },
  { id: 'totalVolumes', type: 'number', accessor: (r) => r.totalVolumes },
  { id: 'status', type: 'status', accessor: (r) => r.status },
  { id: 'criadoEm', type: 'date', accessor: (r) => r.criadoEm },
  { id: 'origem', type: 'enum', accessor: (r) => r.externo?.sistema ?? 'IERP' },
]

function acharDoca(docaId: string): { doca: Doca; siteId: string; clienteId: string } | null {
  for (const [clienteId, sites] of Object.entries(getDb().sites))
    for (const s of sites) {
      const doca = s.docas.find((d) => d.id === docaId)
      if (doca) return { doca, siteId: s.id, clienteId }
    }
  return null
}

const n = (v: number | null) => (v && v > 0 ? Math.floor(v) : 0)

function calcular(servicos: ServicosOs, q: QuantidadesOs, doca: Doca): CalculoOs | null {
  const veiculos = getRelacionamento()
    .veiculos.filter((v) => v.status === 'ativo')
    .sort((a, b) => (a.comprimento ?? 0) - (b.comprimento ?? 0))
  if (!veiculos.length) return null
  const avisos: AvisoCalculo[] = []
  if (!Object.values(servicos).some(Boolean)) avisos.push({ codigo: 'sem_servico' })
  const racks = n(q.racks)
  let pessoas = 2
  if (servicos.onsiteShredding) pessoas += 2
  if (servicos.recycleOnly) pessoas += 1
  if (servicos.valueRecoveryRacks || servicos.valueRecoveryItad)
    pessoas += Math.ceil(racks / 10) * 2
  const total = n(q.pallets) + n(q.gaylords) + racks
  const vazios = q.requerPalletsVazios ? n(q.palletsVazios) : 0
  const maior = veiculos[veiculos.length - 1]!
  const desejado =
    veiculos.find((v) => total >= (v.volumeMinimo ?? 0) && total <= (v.volumeMaximo ?? Infinity)) ??
    maior
  const cabe = (v: (typeof veiculos)[number]) =>
    (!doca.comprimentoMaxCaminhao || (v.comprimento ?? 0) <= doca.comprimentoMaxCaminhao) &&
    (!doca.espaco || (v.comprimento ?? 0) * (v.largura ?? 0) <= doca.espaco)
  let final = desejado
  if (!cabe(desejado)) {
    const maiorQueCabe = [...veiculos].reverse().find(cabe)
    final = maiorQueCabe ?? veiculos[0]!
    if (!maiorQueCabe)
      avisos.push({
        codigo: 'nenhum_cabe',
        tipo: final.tipo,
        comprimentoMax: doca.comprimentoMaxCaminhao,
      })
    if (final.tipo !== desejado.tipo)
      avisos.push({ codigo: 'rebaixado', desejado: desejado.tipo, final: final.tipo })
  }
  const capacidade =
    final.capacidadePallets && final.capacidadePallets > 0 ? final.capacidadePallets : 1
  return {
    totalVolumes: total,
    volumesEfetivos: total,
    veiculo: { tipo: final.tipo, comprimento: final.comprimento, capacidade },
    caminhaoPlataforma: !doca.dockLeveler || doca.tailLift,
    viagens: Math.max(1, Math.ceil(total / capacidade) || 1),
    levarShredder: servicos.onsiteShredding,
    levarGaylordReteck: servicos.recycleOnly,
    levarPalletsVazios: vazios > 0,
    qtdPalletsVazios: vazios,
    totalPessoas: pessoas,
    avisos,
  }
}

/** Início do dia no fuso de São Paulo (UTC−3), como o servidor guarda. */
const inicioDoDia = (dia: string | null) => (dia ? `${dia}T03:00:00.000Z` : null)

export const ordensHandlers = [
  http.get('*/api/ordens', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const url = new URL(request.url)
    const raw: Record<string, unknown> = {}
    for (const [k, v] of url.searchParams) {
      if (k === 'q' || k === 's') raw[k] = v
      else if (k === 'p' || k === 'ps') raw[k] = Number(v)
      else if (k === 'f' || k === 'a') {
        try {
          raw[k] = JSON.parse(v)
        } catch {
          /* parâmetro inválido: ignora */
        }
      }
    }
    const query = searchToQuery(
      tableSearchSchema.parse(raw),
      Object.fromEntries(COLS.map((c) => [c.id, c.type])),
    )
    if (!query.sort.length) query.sort = [{ id: 'codigo', desc: true }]
    if (typeof raw.ps === 'number' && raw.ps > 0) query.pageSize = Math.min(raw.ps, 100_000)
    const page = runQuery(lotes() as OrdemResumo[], COLS, query, (r) => r.id)
    return HttpResponse.json({
      rows: page.rows,
      total: page.total,
      totals: page.totals,
      facets: {},
    })
  }),

  http.post('*/api/ordens/pre-calculo', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const b = (await request.json()) as {
      docaId: string
      servicos: ServicosOs
      quantidades: QuantidadesOs
    }
    const achou = b.docaId ? acharDoca(b.docaId) : null
    if (!achou) return apiError(422, 'validation', 'Escolha a doca.')
    const r = calcular(b.servicos, b.quantidades, achou.doca)
    return r
      ? HttpResponse.json(r)
      : apiError(422, 'no_vehicles', 'Nenhum veículo ativo para o cálculo.')
  }),

  http.get('*/api/ordens/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const o =
      lotes().find((x) => x.id === params.id) ??
      (params.id === 'ordgp001' ? loteDoGerenciamento() : undefined)
    return o ? HttpResponse.json(o) : apiError(404, 'not_found', 'Ordem não encontrada.')
  }),

  http.get('*/api/ordens/:id/externo', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    return params.id === 'ordgp001'
      ? HttpResponse.json(espelhoDoGerenciamento())
      : apiError(404, 'not_found', 'Este lote não veio de outro sistema.')
  }),

  http.post('*/api/ordens', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const form = await request.formData()
    const d = JSON.parse(String(form.get('dados') ?? '{}')) as OrdemInput
    const escopo = form.getAll('escopo') as File[]
    const observacoes = form.getAll('observacoes') as File[]
    const achou = acharDoca(d.docaId)
    if (!achou || achou.siteId !== d.siteId || achou.clienteId !== d.clienteId)
      return apiError(422, 'validation', 'A doca não é deste site.')
    if (!d.coletaPrevista) return apiError(422, 'validation', 'Informe a coleta prevista.')
    if (!d.escopo && !escopo.length)
      return apiError(422, 'scope_required', 'Escreva o escopo ou anexe um documento.')
    const cliente = getDb().clientes.find((c) => c.id === d.clienteId)!
    const site = getDb().sites[d.clienteId]!.find((s) => s.id === d.siteId)!
    const rel = getRelacionamento()
    const agora = new Date().toISOString()
    const numero = lotes().length + 1
    const id = `ord${String(numero).padStart(5, '0')}`
    const anexos = [
      ...escopo.map((f) => ({ f, secao: 'escopo' as const })),
      ...observacoes.map((f) => ({ f, secao: 'observacoes' as const })),
    ].map(({ f, secao }, i) => ({
      id: `${id}-a${i}`,
      secao,
      tipo: secao === 'escopo' ? ('escopo' as const) : ('outro' as const),
      nome: f.name,
      extensao: f.name.split('.').pop()?.toLowerCase() ?? '',
      tamanho: f.size,
      enviadoEm: agora,
      enviadoPor: autor(),
    }))
    const q = d.quantidades
    const ordem: Ordem = {
      id,
      codigo: `LOT-${String(numero).padStart(5, '0')}`,
      status: 'agendado',
      clienteId: d.clienteId,
      clienteNome: cliente.nome,
      siteId: d.siteId,
      siteCodigo: site.codigo,
      docaId: d.docaId,
      docaNumero: achou.doca.numero,
      transportadoraId: d.transportadoraId,
      transportadoraNome:
        rel.transportadoras.find((t) => t.id === d.transportadoraId)?.nome ?? null,
      referenciaCliente: d.referenciaCliente,
      dataColeta: inicioDoDia(d.dataColeta),
      coletaPrevista: inicioDoDia(d.coletaPrevista)!,
      dataChegada: inicioDoDia(d.dataChegada),
      rastrear: d.rastrear,
      motoristaId: d.rastrear ? d.motoristaId : null,
      motoristaNome: d.rastrear
        ? (rel.motoristas.find((m) => m.id === d.motoristaId)?.nome ?? null)
        : null,
      placa: d.rastrear ? d.placa : null,
      servicos: d.servicos,
      quantidades: q,
      totalVolumes: n(q.pallets) + n(q.gaylords) + n(q.racks),
      escopo: d.escopo,
      observacoes: d.observacoes,
      anexos,
      calculo: calcular(d.servicos, q, achou.doca),
      recebidoEm: null,
      etapaDesde: agora,
      codEmitidoEm: null,
      processamento: null,
      devolucao: null,
      externo: null,
      externoDados: null,
      criadoEm: agora,
      criadoPor: autor(),
      alteradoEm: agora,
      alteradoPor: autor(),
      historico: [{ id: `h${Date.now()}`, autor: autor(), em: agora, acao: 'criado' }],
      etapas: [{ etapa: 'agendado', em: agora }],
      pallets: [],
      ocorrencias: [],
      recebimento: null,
      balanco: null,
    }
    ordens = [ordem, ...lotes()]
    return HttpResponse.json(ordem, { status: 201 })
  }),

  /* ---------------- detalhe do lote: ocorrências, fotos e documentos */

  http.post('*/api/ordens/:id/ocorrencias', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const o = lotes().find((x) => x.id === params.id)
    if (!o) return apiError(404, 'not_found', 'Lote não encontrado.')
    const form = await request.formData()
    const d = JSON.parse(String(form.get('dados') ?? '{}')) as OcorrenciaInput
    if (!d.momento || !d.categoria || !d.texto?.textos[d.texto.origem]?.trim())
      return apiError(422, 'validation', 'Momento, categoria e texto são obrigatórios.')
    const agora = new Date().toISOString()
    const numero = Math.max(0, ...o.ocorrencias.map((x) => x.numero)) + 1
    const novas = (form.getAll('fotos') as File[]).map((f) => {
      const id = novoId('fot')
      fotos.set(id, f)
      return {
        id,
        nome: f.name,
        extensao: f.name.split('.').pop()?.toLowerCase() ?? '',
        tamanho: f.size,
        enviadoEm: agora,
        enviadoPor: autor(),
      }
    })
    o.ocorrencias = [
      {
        id: novoId('oco'),
        numero,
        momento: d.momento,
        categoria: d.categoria,
        texto: d.texto,
        status: 'registrada',
        fotos: novas,
        criadoEm: agora,
        criadoPor: autor(),
        alteradoEm: agora,
        alteradoPor: autor(),
      },
      ...o.ocorrencias,
    ]
    o.historico = [
      {
        id: novoId('h'),
        autor: autor(),
        em: agora,
        acao: 'ocorrencia_registrada',
        nota: `#${numero}`,
        mudancas: [
          { campo: 'momento', antes: null, depois: d.momento },
          { campo: 'categoria', antes: null, depois: d.categoria },
          { campo: 'texto', antes: null, depois: d.texto.textos[d.texto.origem] ?? '' },
        ],
      },
      ...o.historico,
    ]
    return HttpResponse.json(o, { status: 201 })
  }),

  http.patch('*/api/ordens/:id/ocorrencias/:oc', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const o = lotes().find((x) => x.id === params.id)
    const oc = o?.ocorrencias.find((x) => x.id === params.oc)
    if (!o || !oc) return apiError(404, 'not_found', 'Ocorrência não encontrada.')
    if (oc.status !== 'registrada')
      return apiError(409, 'invalid_transition', 'Ocorrência cancelada não pode ser alterada.')
    const form = await request.formData()
    const d = JSON.parse(String(form.get('dados') ?? '{}')) as OcorrenciaInput
    const agora = new Date().toISOString()
    const mudancas = (['momento', 'categoria'] as const)
      .filter((k) => oc[k] !== d[k])
      .map((k) => ({ campo: k, antes: oc[k], depois: d[k] }))
    const remover = d.removerFotos ?? []
    const novas = (form.getAll('fotos') as File[]).map((f) => {
      const id = novoId('fot')
      fotos.set(id, f)
      return {
        id,
        nome: f.name,
        extensao: f.name.split('.').pop()?.toLowerCase() ?? '',
        tamanho: f.size,
        enviadoEm: agora,
        enviadoPor: autor(),
      }
    })
    Object.assign(oc, {
      momento: d.momento,
      categoria: d.categoria,
      texto: d.texto,
      fotos: [...oc.fotos.filter((f) => !remover.includes(f.id)), ...novas],
      alteradoEm: agora,
      alteradoPor: autor(),
    })
    if (mudancas.length || remover.length || novas.length)
      o.historico = [
        {
          id: novoId('h'),
          autor: autor(),
          em: agora,
          acao: 'ocorrencia_editada',
          nota: `#${oc.numero}`,
          mudancas,
        },
        ...o.historico,
      ]
    return HttpResponse.json(o)
  }),

  http.post('*/api/ordens/:id/ocorrencias/:oc/cancelar', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const o = lotes().find((x) => x.id === params.id)
    const oc = o?.ocorrencias.find((x) => x.id === params.oc)
    if (!o || !oc) return apiError(404, 'not_found', 'Ocorrência não encontrada.')
    if (oc.status !== 'registrada')
      return apiError(409, 'invalid_transition', 'A ocorrência já está cancelada.')
    const agora = new Date().toISOString()
    Object.assign(oc, { status: 'cancelado', alteradoEm: agora, alteradoPor: autor() })
    o.historico = [
      {
        id: novoId('h'),
        autor: autor(),
        em: agora,
        acao: 'ocorrencia_cancelada',
        nota: `#${oc.numero}`,
        mudancas: [{ campo: 'status', antes: 'registrada', depois: 'cancelado' }],
      },
      ...o.historico,
    ]
    return HttpResponse.json(o)
  }),

  http.get('*/api/ordens/:id/ocorrencias/:oc/fotos/:foto', ({ params }) => {
    const f = fotos.get(String(params.foto))
    return f
      ? new HttpResponse(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } })
      : apiError(404, 'not_found', 'Foto não encontrada.')
  }),

  http.post('*/api/ordens/:id/anexos', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const o = lotes().find((x) => x.id === params.id)
    if (!o) return apiError(404, 'not_found', 'Lote não encontrado.')
    const form = await request.formData()
    const tipo = String(form.get('tipo') ?? '') as TipoDocumentoLote
    if (!TIPOS_DOC.includes(tipo))
      return apiError(422, 'validation', 'Escolha o tipo do documento.')
    const arquivos = form.getAll('arquivos') as File[]
    if (!arquivos.length) return apiError(422, 'validation', 'Envie pelo menos um arquivo.')
    const agora = new Date().toISOString()
    for (const f of arquivos) {
      o.anexos.push({
        id: novoId('anx'),
        secao: 'lote',
        tipo,
        nome: f.name,
        extensao: f.name.split('.').pop()?.toLowerCase() ?? '',
        tamanho: f.size,
        enviadoEm: agora,
        enviadoPor: autor(),
      })
      o.historico = [
        {
          id: novoId('h'),
          autor: autor(),
          em: agora,
          acao: 'documento_adicionado',
          nota: f.name,
          mudancas: [{ campo: 'tipoDocumento', antes: null, depois: tipo }],
        },
        ...o.historico,
      ]
    }
    return HttpResponse.json(o, { status: 201 })
  }),

  http.delete('*/api/ordens/:id/anexos/:anexoId', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const o = lotes().find((x) => x.id === params.id)
    const a = o?.anexos.find((x) => x.id === params.anexoId)
    if (!o || !a) return apiError(404, 'not_found', 'Documento não encontrado.')
    if (
      a.tipo === 'escopo' &&
      !o.escopo &&
      !o.anexos.some((x) => x.id !== a.id && x.tipo === 'escopo')
    )
      return apiError(422, 'scope_required', 'É o único escopo de trabalho do lote.')
    const agora = new Date().toISOString()
    o.anexos = o.anexos.filter((x) => x.id !== a.id)
    o.historico = [
      {
        id: novoId('h'),
        autor: autor(),
        em: agora,
        acao: 'documento_removido',
        nota: a.nome,
        mudancas: [{ campo: 'tipoDocumento', antes: a.tipo, depois: null }],
      },
      ...o.historico,
    ]
    return HttpResponse.json(o)
  }),

  http.put('*/api/ordens/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const o = lotes().find((x) => x.id === params.id)
    if (!o) return apiError(404, 'not_found', 'Lote não encontrado.')
    if (o.status !== 'agendado')
      return apiError(409, 'invalid_transition', 'Só o lote agendado pode ser editado.')
    const d = (await request.json()) as OrdemInput
    if (d.clienteId !== o.clienteId)
      return apiError(422, 'validation', 'O cliente do lote não muda.')
    const achou = acharDoca(d.docaId)
    if (!achou || achou.siteId !== d.siteId || achou.clienteId !== d.clienteId)
      return apiError(422, 'validation', 'A doca não é deste site.')
    if (!d.escopo && !o.anexos.some((a) => a.tipo === 'escopo'))
      return apiError(422, 'scope_required', 'Escreva o escopo ou anexe um documento.')
    const site = getDb().sites[d.clienteId]!.find((s) => s.id === d.siteId)!
    const rel = getRelacionamento()
    const q = d.quantidades
    const depois: Partial<Ordem> = {
      siteId: d.siteId,
      siteCodigo: site.codigo,
      docaId: d.docaId,
      docaNumero: achou.doca.numero,
      transportadoraId: d.transportadoraId,
      transportadoraNome:
        rel.transportadoras.find((t) => t.id === d.transportadoraId)?.nome ?? null,
      referenciaCliente: d.referenciaCliente,
      dataColeta: inicioDoDia(d.dataColeta),
      coletaPrevista: inicioDoDia(d.coletaPrevista)!,
      dataChegada: inicioDoDia(d.dataChegada),
      rastrear: d.rastrear,
      motoristaId: d.rastrear ? d.motoristaId : null,
      motoristaNome: d.rastrear
        ? (rel.motoristas.find((m) => m.id === d.motoristaId)?.nome ?? null)
        : null,
      placa: d.rastrear ? d.placa : null,
      servicos: d.servicos,
      quantidades: q,
      totalVolumes: n(q.pallets) + n(q.gaylords) + n(q.racks),
      escopo: d.escopo,
      observacoes: d.observacoes,
      calculo: calcular(d.servicos, q, achou.doca),
    }
    // Histórico resumido (o servidor registra todos os campos, com os nomes).
    const mudancas = (
      [
        ['site', o.siteCodigo, depois.siteCodigo],
        ['doca', o.docaNumero, depois.docaNumero],
        ['referenciaCliente', o.referenciaCliente, depois.referenciaCliente],
        ['coletaPrevista', o.coletaPrevista.slice(0, 10), depois.coletaPrevista!.slice(0, 10)],
        ['dataColeta', o.dataColeta?.slice(0, 10) ?? null, depois.dataColeta?.slice(0, 10) ?? null],
        ['pallets', o.quantidades.pallets, q.pallets],
        ['escopo', o.escopo, d.escopo],
      ] as [string, string | number | null, string | number | null][]
    )
      .filter(([, a, b]) => (a ?? null) !== (b ?? null))
      .map(([campo, antes, dep]) => ({ campo, antes, depois: dep }))
    const agora = new Date().toISOString()
    Object.assign(o, depois, { alteradoEm: agora, alteradoPor: autor() })
    if (mudancas.length)
      o.historico = [
        { id: novoId('h'), autor: autor(), em: agora, acao: 'editado', mudancas },
        ...o.historico,
      ]
    return HttpResponse.json(o)
  }),

  /* ---------------- recebimento (Operação › Recebimento) */

  http.post('*/api/ordens/:id/recebimento', ({ request, params }) =>
    salvarRecebimento(request, String(params.id), 'receber'),
  ),
  http.put('*/api/ordens/:id/recebimento', ({ request, params }) =>
    salvarRecebimento(request, String(params.id), 'corrigir'),
  ),
  http.get('*/api/ordens/:id/recebimento/fotos/:foto', ({ params }) => {
    const f = fotos.get(String(params.foto))
    return f
      ? new HttpResponse(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } })
      : apiError(404, 'not_found', 'Foto não encontrada.')
  }),

  /* ---------------- histórico do módulo (Ordens › Histórico, Operação › Histórico) */

  http.get('*/api/historico/:modulo', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const modulo = String(params.modulo)
    if (modulo !== 'ordens' && modulo !== 'operacao')
      return apiError(422, 'validation', 'Módulo de histórico desconhecido.')
    const desde = new URL(request.url).searchParams.get('desde')
    const acoes =
      modulo === 'ordens'
        ? ['criado', 'editado', 'documento_adicionado', 'documento_removido']
        : ['criado', 'recebido', 'recebimento_editado', 'status']
    const momentos = modulo === 'ordens' ? ['coleta', 'trajeto'] : ['recebimento']
    const eventos = lotes().flatMap((o) =>
      o.historico
        .filter((h) => {
          if (desde && h.em < desde) return false
          if (acoes.includes(h.acao)) return true
          if (!h.acao.startsWith('ocorrencia_')) return false
          const oc = o.ocorrencias.find((x) => `#${x.numero}` === h.nota)
          return Boolean(oc && momentos.includes(oc.momento))
        })
        .map((h) => ({
          ...h,
          registroId: o.id,
          registroCodigo: o.codigo,
          clienteNome: o.clienteNome,
        })),
    )
    eventos.sort((a, b) => b.em.localeCompare(a.em))
    return HttpResponse.json(eventos)
  }),
]

/** Recebimento simulado (regras resumidas — a fonte da verdade é o servidor). */
async function salvarRecebimento(request: Request, id: string, modo: 'receber' | 'corrigir') {
  const fail = await simulateNetwork(request)
  if (fail) return fail
  const o = lotes().find((x) => x.id === id)
  if (!o) return apiError(404, 'not_found', 'Lote não encontrado.')
  if (modo === 'receber' && o.status !== 'agendado')
    return apiError(409, 'invalid_transition', 'Só lote agendado pode ser recebido.')
  if (modo === 'corrigir' && (o.status !== 'inspecao' || !o.recebimento))
    return apiError(409, 'invalid_transition', 'Só enquanto o lote está em Inspeção.')
  const form = await request.formData()
  const d = JSON.parse(String(form.get('dados') ?? '{}')) as RecebimentoInput
  if (!d.pallets?.length) return apiError(422, 'validation', 'Informe pelo menos um pallet.')
  if (d.inspecao !== 'bom' && !d.inspecaoDescricao)
    return apiError(422, 'validation', 'Descreva o que foi encontrado na inspeção.')
  const agora = new Date().toISOString()
  const todas = [
    ...(o.recebimento?.lacres.flatMap((l) => l.fotos) ?? []),
    ...(o.recebimento?.notas.flatMap((n) => n.fotos) ?? []),
    ...(o.recebimento?.fotosGerais ?? []),
    ...o.pallets.flatMap((p) => p.fotos),
  ]
  const fotosDe = (campo: string, manter: string[]): FotoRecebimento[] => [
    ...todas.filter((f) => manter.includes(f.id)),
    ...(form.getAll(campo) as File[]).map((f) => {
      const fid = novoId('frc')
      fotos.set(fid, f)
      return { id: fid, nome: f.name, extensao: f.name.split('.').pop() ?? '', tamanho: f.size }
    }),
  ]
  const itens = (nome: 'lacres' | 'notas') =>
    d[nome].map((x, i) => ({
      id: x.id ?? novoId('itm'),
      numero: x.numero,
      fotos: fotosDe(`${nome}.${i}`, x.fotosManter),
    }))
  const inicio = inicioDoDia(d.dataRecebimento)!
  o.pallets = d.pallets.map((p, i) => ({
    id: p.id ?? novoId('pal'),
    numero: i + 1,
    pesoKg: p.pesoBruto,
    taraKg: p.tara,
    pesoLiquidoKg: p.pesoBruto - (p.tara ?? 0),
    conteudo: p.conteudo,
    pesadoPor: autor(),
    pesadoEm: agora,
    temFoto: false,
    origem: 'iERP',
    fotos: fotosDe(`pallets.${i}`, p.fotosManter),
  }))
  // Avaria/Outro: ocorrência de Recebimento no lote.
  let ocorrenciaId = o.recebimento?.ocorrenciaId ?? null
  const existente = o.ocorrencias.find((x) => x.id === ocorrenciaId && x.status === 'registrada')
  if (d.inspecao === 'bom') {
    if (existente) existente.status = 'cancelado'
    ocorrenciaId = null
  } else if (existente) {
    existente.categoria = d.inspecao === 'avaria' ? 'avaria_carga' : 'outro'
    existente.texto = d.inspecaoDescricao!
  } else {
    const numero = Math.max(0, ...o.ocorrencias.map((x) => x.numero)) + 1
    ocorrenciaId = novoId('oco')
    o.ocorrencias = [
      {
        id: ocorrenciaId,
        numero,
        momento: 'recebimento',
        categoria: d.inspecao === 'avaria' ? 'avaria_carga' : 'outro',
        texto: d.inspecaoDescricao!,
        status: 'registrada',
        fotos: [],
        criadoEm: agora,
        criadoPor: autor(),
        alteradoEm: agora,
        alteradoPor: autor(),
      },
      ...o.ocorrencias,
    ]
  }
  o.recebimento = {
    dataRecebimento: inicio,
    inspecao: d.inspecao,
    inspecaoDescricao: d.inspecao === 'bom' ? null : d.inspecaoDescricao,
    ocorrenciaId,
    lacres: itens('lacres'),
    notas: itens('notas'),
    fotosGerais: fotosDe('gerais', d.fotosGeraisManter),
    criadoEm: o.recebimento?.criadoEm ?? agora,
    criadoPor: o.recebimento?.criadoPor ?? autor(),
    alteradoEm: agora,
    alteradoPor: autor(),
  }
  if (modo === 'receber') {
    o.status = 'inspecao'
    o.recebidoEm = agora
    o.etapaDesde = agora
    o.etapas = [...o.etapas, { etapa: 'inspecao', em: agora }]
  }
  o.historico = [
    {
      id: novoId('h'),
      autor: autor(),
      em: agora,
      acao: modo === 'receber' ? 'recebido' : 'recebimento_editado',
      mudancas: [
        ...(modo === 'receber' ? [{ campo: 'status', antes: 'agendado', depois: 'inspecao' }] : []),
        { campo: 'inspecao', antes: null, depois: d.inspecao },
        { campo: 'palletsRecebidos', antes: null, depois: o.pallets.length },
      ],
    },
    ...o.historico,
  ]
  return HttpResponse.json(o, { status: modo === 'receber' ? 201 : 200 })
}
