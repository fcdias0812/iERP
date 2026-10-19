import { http, HttpResponse } from 'msw/http'
import { runQuery, type EngineColumn } from '@/components/data-table/engine'
import { searchToQuery, tableSearchSchema } from '@/components/data-table/url-state'
import type {
  AvisoCalculo,
  CalculoOs,
  Doca,
  Ordem,
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
let ordens: Ordem[] = []

/** Lotes criados na sessão (o dashboard simulado usa para a previsão de chegada). */
export const ordensMock = () => ordens

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
    const page = runQuery(ordens as OrdemResumo[], COLS, query, (r) => r.id)
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
    const o = ordens.find((x) => x.id === params.id)
    return o ? HttpResponse.json(o) : apiError(404, 'not_found', 'Ordem não encontrada.')
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
    if (!d.dataColeta) return apiError(422, 'validation', 'Informe a data de coleta.')
    if (!d.escopo && !escopo.length)
      return apiError(422, 'scope_required', 'Escreva o escopo ou anexe um documento.')
    const cliente = getDb().clientes.find((c) => c.id === d.clienteId)!
    const site = getDb().sites[d.clienteId]!.find((s) => s.id === d.siteId)!
    const rel = getRelacionamento()
    const agora = new Date().toISOString()
    const numero = ordens.length + 1
    const id = `ord${String(numero).padStart(5, '0')}`
    const anexos = [
      ...escopo.map((f) => ({ f, secao: 'escopo' as const })),
      ...observacoes.map((f) => ({ f, secao: 'observacoes' as const })),
    ].map(({ f, secao }, i) => ({
      id: `${id}-a${i}`,
      secao,
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
      dataColeta: inicioDoDia(d.dataColeta)!,
      coletaPrevista: inicioDoDia(d.coletaPrevista),
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
      criadoEm: agora,
      criadoPor: autor(),
      alteradoEm: agora,
      alteradoPor: autor(),
      historico: [{ id: `h${Date.now()}`, autor: autor(), em: agora, acao: 'criado' }],
    }
    ordens = [ordem, ...ordens]
    return HttpResponse.json(ordem, { status: 201 })
  }),
]
