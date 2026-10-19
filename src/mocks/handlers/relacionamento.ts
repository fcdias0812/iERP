import { http, HttpResponse } from 'msw/http'
import { facetCounts, runQuery, type EngineColumn } from '@/components/data-table/engine'
import { searchToQuery, tableSearchSchema } from '@/components/data-table/url-state'
import { isValidCnpj, isValidCpf, isValidPhone } from '@/lib/validators/br'
import type {
  AcaoCadastro,
  EventoHistorico,
  Motorista,
  MotoristaInput,
  MotoristaResumo,
  Mudanca,
  StatusCadastro,
  Transportadora,
  TransportadoraInput,
  TransportadoraResumo,
  VeiculoDetalhe,
  VeiculoInput,
  Veiculo,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'
import { gerarCnpj, gerarCpf, seeded } from '../generators'

/*
 * API SIMULADA de Transportadoras, Motoristas e Veículos (mesmo contrato de
 * server/src/modules/{transportadoras,motoristas,veiculos}): usada nos testes e2e e na
 * demonstração sem backend (VITE_USE_MOCKS=true). Dados fictícios, em memória.
 */

const autor = () => useSessionStore.getState().user.name
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const soDigitos = (v: string) => v.replace(/\D/g, '')
const limparCnpj = (v: string) => v.replace(/[^0-9a-z]/gi, '').toUpperCase()
const codigo = (prefixo: string, n: number) => `${prefixo}-${String(n).padStart(5, '0')}`
const acoes = (s: StatusCadastro): AcaoCadastro[] => [s === 'ativo' ? 'inativar' : 'reativar']

/* ------------------------------------------------------------ dados */

interface TransportadoraDb {
  id: string
  codigo: string
  nome: string
  cnpj: string
  status: StatusCadastro
  contatos: Transportadora['contatos']
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
}
interface MotoristaDb extends Omit<MotoristaResumo, 'transportadoraNome'> {
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
  historico: EventoHistorico[]
}
interface VeiculoDb extends Veiculo {
  historico: EventoHistorico[]
}

interface Store {
  transportadoras: TransportadoraDb[]
  motoristas: MotoristaDb[]
  veiculos: VeiculoDb[]
  seq: { tra: number; mot: number; vei: number }
}

let store: Store | null = null

function gerar(): Store {
  const rand = seeded(20261019)
  const em = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const base = { criadoEm: em, criadoPor: 'Sistema', alteradoEm: em, alteradoPor: 'Sistema' }
  const criado = (id: string): EventoHistorico[] => [
    { id: `h-${id}`, autor: 'Sistema', em, acao: 'criado' },
  ]
  const transportadoras: TransportadoraDb[] = [
    {
      id: 'tra00001',
      codigo: codigo('TRA', 1),
      nome: 'Rápido Sul Transportes',
      cnpj: gerarCnpj(rand, false),
      status: 'ativo',
      contatos: [
        {
          id: 'tra00001-c1',
          nome: 'Paula Mendes',
          email: 'paula@rapidosul.example',
          telefone: '11987654321',
          principal: true,
        },
        {
          id: 'tra00001-c2',
          nome: null,
          email: 'operacao@rapidosul.example',
          telefone: '1132345678',
          principal: false,
        },
      ],
      ...base,
      historico: criado('tra00001'),
    },
    {
      id: 'tra00002',
      codigo: codigo('TRA', 2),
      nome: 'TransLog Cargas',
      cnpj: gerarCnpj(rand, false),
      status: 'ativo',
      contatos: [
        {
          id: 'tra00002-c1',
          nome: 'Rogério Lima',
          email: 'rogerio@translog.example',
          telefone: '21998765432',
          principal: true,
        },
      ],
      ...base,
      historico: criado('tra00002'),
    },
    {
      id: 'tra00003',
      codigo: codigo('TRA', 3),
      nome: 'Carga Certa Logística',
      cnpj: gerarCnpj(rand, false),
      status: 'ativo',
      contatos: [],
      ...base,
      historico: criado('tra00003'),
    },
  ]
  const mot = (n: number, nome: string, telefone: string, transportadoraId: string | null) => ({
    id: `mot0000${n}`,
    codigo: codigo('MOT', n),
    nome,
    cpf: gerarCpf(rand, false),
    telefone,
    transportadoraId,
    status: 'ativo' as const,
    ...base,
    historico: criado(`mot0000${n}`),
  })
  const motoristas: MotoristaDb[] = [
    mot(1, 'Antônio Ferreira', '11991112222', 'tra00001'),
    mot(2, 'Bruna Carvalho', '21992223333', 'tra00002'),
    mot(3, 'Cláudio Souza', '21993334444', 'tra00002'),
    mot(4, 'Daniela Rocha', '31994445555', null),
  ]
  const vei = (
    n: number,
    tipo: Veiculo['tipo'],
    medidas: Omit<VeiculoInput, 'tipo'>,
  ): VeiculoDb => ({
    id: `vei0000${n}`,
    codigo: codigo('VEI', n),
    tipo,
    ...medidas,
    status: 'ativo',
    ...base,
    historico: criado(`vei0000${n}`),
  })
  const veiculos = [
    vei(1, 'van', {
      volumeMinimo: 4,
      volumeMaximo: 8,
      comprimento: 3.5,
      largura: 1.8,
      capacidadePallets: 4,
      capacidadeToneladas: 1.5,
    }),
    vei(2, 'truck', {
      volumeMinimo: 12,
      volumeMaximo: 20,
      comprimento: 8.5,
      largura: 2.5,
      capacidadePallets: 14,
      capacidadeToneladas: 14,
    }),
    vei(3, 'carreta', {
      volumeMinimo: 25,
      volumeMaximo: 35,
      comprimento: 14,
      largura: 2.6,
      capacidadePallets: 28,
      capacidadeToneladas: 30,
    }),
  ]
  return { transportadoras, motoristas, veiculos, seq: { tra: 3, mot: 4, vei: 3 } }
}

export function getRelacionamento(): Store {
  store ??= gerar()
  return store
}

/* ------------------------------------------------------------ montagem das respostas */

const nomeTransportadora = (id: string | null) =>
  id ? (getRelacionamento().transportadoras.find((t) => t.id === id)?.nome ?? null) : null

function motoristaResumo(m: MotoristaDb): MotoristaResumo {
  return {
    id: m.id,
    codigo: m.codigo,
    nome: m.nome,
    cpf: m.cpf,
    telefone: m.telefone,
    transportadoraId: m.transportadoraId,
    transportadoraNome: nomeTransportadora(m.transportadoraId),
    status: m.status,
    criadoEm: m.criadoEm,
  }
}
const motoristaDetalhe = (m: MotoristaDb): Motorista => ({
  ...motoristaResumo(m),
  criadoPor: m.criadoPor,
  alteradoEm: m.alteradoEm,
  alteradoPor: m.alteradoPor,
  historico: m.historico,
  acoesPermitidas: acoes(m.status),
})

const motoristasDe = (id: string) =>
  getRelacionamento()
    .motoristas.filter((m) => m.transportadoraId === id)
    .sort((a, b) => a.nome.localeCompare(b.nome))

function transportadoraResumo(t: TransportadoraDb): TransportadoraResumo {
  const p = t.contatos.find((k) => k.principal)
  return {
    id: t.id,
    codigo: t.codigo,
    nome: t.nome,
    cnpj: t.cnpj,
    contatoNome: p?.nome ?? null,
    contatoEmail: p?.email ?? null,
    contatoTelefone: p?.telefone ?? null,
    contatos: t.contatos.length,
    motoristas: motoristasDe(t.id).length,
    status: t.status,
    criadoEm: t.criadoEm,
  }
}
const transportadoraDetalhe = (t: TransportadoraDb): Transportadora => ({
  ...t,
  motoristas: motoristasDe(t.id).map(motoristaResumo),
  acoesPermitidas: acoes(t.status),
})

const veiculoDetalhe = (v: VeiculoDb): VeiculoDetalhe => ({
  ...v,
  acoesPermitidas: acoes(v.status),
})

/* ------------------------------------------------------------ consulta da lista */

function lerConsulta<T>(url: URL, cols: EngineColumn<T>[], ordem: string) {
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
    Object.fromEntries(cols.map((c) => [c.id, c.type])),
  )
  if (!query.sort.length) query.sort = [{ id: ordem, desc: false }]
  if (typeof raw.ps === 'number' && raw.ps > 0) query.pageSize = Math.min(raw.ps, 100_000)
  return query
}

function pagina<T extends { id: string }>(
  request: Request,
  linhas: T[],
  cols: EngineColumn<T>[],
  ordem: string,
  facetas: string[],
) {
  const query = lerConsulta(new URL(request.url), cols, ordem)
  const page = runQuery(linhas, cols, query, (r) => r.id)
  const facets = Object.fromEntries(
    facetas.map((f) => [f, Object.fromEntries(facetCounts(linhas, cols, query, f))]),
  )
  return HttpResponse.json({ rows: page.rows, total: page.total, totals: page.totals, facets })
}

const resumo = (l: { status: StatusCadastro }[]) => {
  const ativos = l.filter((x) => x.status === 'ativo').length
  return { total: l.length, ativos, inativos: l.length - ativos }
}

/* ------------------------------------------------------------ validação (mesmas regras do servidor) */

function validarBasicoMotorista(m: { nome?: string; cpf?: string; telefone?: string }) {
  const nome = m.nome?.trim() ?? ''
  const cpf = soDigitos(m.cpf ?? '')
  const telefone = soDigitos(m.telefone ?? '')
  if (nome.length < 3) return 'Informe o nome completo do motorista.'
  if (!isValidCpf(cpf)) return 'CPF inválido.'
  if (!isValidPhone(telefone)) return 'Telefone do motorista inválido (DDD + número).'
  return { nome, cpf, telefone }
}
function validarBasicoTransportadora(t: { nome?: string; cnpj?: string }) {
  const nome = t.nome?.trim() ?? ''
  const cnpj = limparCnpj(t.cnpj ?? '')
  if (nome.length < 2) return 'Informe o nome da transportadora.'
  if (!isValidCnpj(cnpj)) return 'CNPJ inválido.'
  return { nome, cnpj }
}

const cpfEmUso = (cpf: string, idAtual?: string) =>
  getRelacionamento().motoristas.some((m) => m.id !== idAtual && m.cpf === cpf)
const cnpjEmUso = (cnpj: string, idAtual?: string) =>
  getRelacionamento().transportadoras.some((t) => t.id !== idAtual && t.cnpj === cnpj)
const erroCpf = () => apiError(409, 'cpf_in_use', 'Já existe um motorista com este CPF.')
const erroCnpj = () => apiError(409, 'cnpj_in_use', 'Já existe uma transportadora com este CNPJ.')

function novaTransportadora(dados: { nome: string; cnpj: string }): TransportadoraDb {
  const s = getRelacionamento()
  s.seq.tra += 1
  const agora = new Date().toISOString()
  const t: TransportadoraDb = {
    id: `tra${String(s.seq.tra).padStart(5, '0')}`,
    codigo: codigo('TRA', s.seq.tra),
    ...dados,
    status: 'ativo',
    contatos: [],
    criadoEm: agora,
    criadoPor: autor(),
    alteradoEm: agora,
    alteradoPor: autor(),
    historico: [{ id: `h${Date.now()}t`, autor: autor(), em: agora, acao: 'criado' }],
  }
  s.transportadoras.unshift(t)
  return t
}

function novoMotorista(
  dados: { nome: string; cpf: string; telefone: string },
  transportadoraId: string | null,
): MotoristaDb {
  const s = getRelacionamento()
  s.seq.mot += 1
  const agora = new Date().toISOString()
  const m: MotoristaDb = {
    id: `mot${String(s.seq.mot).padStart(5, '0')}`,
    codigo: codigo('MOT', s.seq.mot),
    ...dados,
    transportadoraId,
    status: 'ativo',
    criadoEm: agora,
    criadoPor: autor(),
    alteradoEm: agora,
    alteradoPor: autor(),
    historico: [{ id: `h${Date.now()}m${s.seq.mot}`, autor: autor(), em: agora, acao: 'criado' }],
  }
  s.motoristas.unshift(m)
  return m
}

/** Registra uma edição (se houver mudanças) no registro. */
function editado<
  T extends { historico: EventoHistorico[]; alteradoEm: string; alteradoPor: string },
>(r: T, mudancas: Mudanca[]) {
  if (!mudancas.length) return
  const agora = new Date().toISOString()
  r.alteradoEm = agora
  r.alteradoPor = autor()
  r.historico = [
    { id: `h${Date.now()}${Math.random()}`, autor: autor(), em: agora, acao: 'editado', mudancas },
    ...r.historico,
  ]
}

function transicionar<
  T extends {
    status: StatusCadastro
    historico: EventoHistorico[]
    alteradoEm: string
    alteradoPor: string
  },
>(r: T, acao: AcaoCadastro) {
  const destino = r.status === 'ativo' && acao === 'inativar' ? 'inativo' : null
  const volta = r.status === 'inativo' && acao === 'reativar' ? 'ativo' : null
  const novo = destino ?? volta
  if (!novo) return false
  const agora = new Date().toISOString()
  r.historico = [
    {
      id: `h${Date.now()}`,
      autor: autor(),
      em: agora,
      acao: 'status',
      mudancas: [{ campo: 'status', antes: r.status, depois: novo }],
    },
    ...r.historico,
  ]
  r.status = novo
  r.alteradoEm = agora
  r.alteradoPor = autor()
  return true
}

const naoPermitida = (acao: string) =>
  apiError(409, 'invalid_transition', `Ação "${acao}" não é permitida no status atual.`)

/* ------------------------------------------------------------ colunas */

const COLS_TRANSPORTADORA: EngineColumn<TransportadoraResumo>[] = [
  { id: 'codigo', type: 'unique-text', accessor: (r) => r.codigo },
  { id: 'nome', type: 'unique-text', accessor: (r) => r.nome },
  { id: 'cnpj', type: 'unique-text', accessor: (r) => r.cnpj },
  { id: 'contatoEmail', type: 'unique-text', accessor: (r) => r.contatoEmail },
  { id: 'contatoTelefone', type: 'unique-text', accessor: (r) => r.contatoTelefone },
  { id: 'motoristas', type: 'number', accessor: (r) => r.motoristas },
  { id: 'status', type: 'status', accessor: (r) => r.status },
  { id: 'criadoEm', type: 'date', accessor: (r) => r.criadoEm },
]
const COLS_MOTORISTA: EngineColumn<MotoristaResumo>[] = [
  { id: 'codigo', type: 'unique-text', accessor: (r) => r.codigo },
  { id: 'nome', type: 'unique-text', accessor: (r) => r.nome },
  { id: 'cpf', type: 'unique-text', accessor: (r) => r.cpf },
  { id: 'telefone', type: 'unique-text', accessor: (r) => r.telefone },
  { id: 'transportadoraNome', type: 'unique-text', accessor: (r) => r.transportadoraNome },
  { id: 'status', type: 'status', accessor: (r) => r.status },
  { id: 'criadoEm', type: 'date', accessor: (r) => r.criadoEm },
]
const COLS_VEICULO: EngineColumn<Veiculo>[] = [
  { id: 'codigo', type: 'unique-text', accessor: (r) => r.codigo },
  { id: 'tipo', type: 'enum', accessor: (r) => r.tipo },
  { id: 'volumeMinimo', type: 'number', accessor: (r) => r.volumeMinimo },
  { id: 'volumeMaximo', type: 'number', accessor: (r) => r.volumeMaximo },
  { id: 'comprimento', type: 'number', accessor: (r) => r.comprimento },
  { id: 'largura', type: 'number', accessor: (r) => r.largura },
  { id: 'capacidadePallets', type: 'number', accessor: (r) => r.capacidadePallets },
  { id: 'capacidadeToneladas', type: 'number', accessor: (r) => r.capacidadeToneladas },
  { id: 'status', type: 'status', accessor: (r) => r.status },
  { id: 'criadoEm', type: 'date', accessor: (r) => r.criadoEm },
]

const resumoContatos = (l: { email: string; principal: boolean }[]) =>
  l.map((c) => (c.principal ? `${c.email} (principal)` : c.email)).join(', ')

/* ------------------------------------------------------------ handlers */

type Info = { request: Request; params: Record<string, string | readonly string[] | undefined> }

/** Simula a rede (atraso/falha configurável) antes de responder. */
const comRede = (fn: (a: Info) => Promise<Response> | Response) => async (a: Info) =>
  (await simulateNetwork(a.request)) ?? fn(a)

/** Linha da lista (sem o histórico). */
const veiculoLinha = (v: VeiculoDb): Veiculo => ({
  id: v.id,
  codigo: v.codigo,
  tipo: v.tipo,
  volumeMinimo: v.volumeMinimo,
  volumeMaximo: v.volumeMaximo,
  comprimento: v.comprimento,
  largura: v.largura,
  capacidadePallets: v.capacidadePallets,
  capacidadeToneladas: v.capacidadeToneladas,
  status: v.status,
  criadoEm: v.criadoEm,
  criadoPor: v.criadoPor,
  alteradoEm: v.alteradoEm,
  alteradoPor: v.alteradoPor,
})

export const relacionamentoHandlers = [
  /* ---------------- transportadoras */
  http.get(
    '*/api/transportadoras/resumo',
    comRede(() => HttpResponse.json(resumo(getRelacionamento().transportadoras))),
  ),
  http.get(
    '*/api/transportadoras/opcoes',
    comRede(() =>
      HttpResponse.json(
        getRelacionamento()
          .transportadoras.map(({ id, nome, cnpj, status }) => ({ id, nome, cnpj, status }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      ),
    ),
  ),
  http.get(
    '*/api/transportadoras',
    comRede(({ request }) =>
      pagina(
        request,
        getRelacionamento().transportadoras.map(transportadoraResumo),
        COLS_TRANSPORTADORA,
        'nome',
        ['status'],
      ),
    ),
  ),
  http.get(
    '*/api/transportadoras/:id',
    comRede(({ params }) => {
      const t = getRelacionamento().transportadoras.find((x) => x.id === params.id)
      return t
        ? HttpResponse.json(transportadoraDetalhe(t))
        : apiError(404, 'not_found', 'Transportadora não encontrada.')
    }),
  ),
  ...(['post', 'put'] as const).map((metodo) =>
    http[metodo](
      metodo === 'post' ? '*/api/transportadoras' : '*/api/transportadoras/:id',
      comRede(async ({ request, params }) => {
        const s = getRelacionamento()
        const atual = params.id ? s.transportadoras.find((x) => x.id === params.id) : undefined
        if (params.id && !atual) return apiError(404, 'not_found', 'Transportadora não encontrada.')
        const input = (await request.json()) as Partial<TransportadoraInput>
        const basico = validarBasicoTransportadora(input)
        if (typeof basico === 'string') return apiError(422, 'validation', basico)
        if (cnpjEmUso(basico.cnpj, atual?.id)) return erroCnpj()
        const contatos = (input.contatos ?? []).map((c, i) => ({
          id: c.id ?? `k${Date.now()}${i}`,
          nome: c.nome?.trim() || null,
          email: (c.email ?? '').trim().toLowerCase(),
          telefone: soDigitos(c.telefone ?? ''),
          principal: Boolean(c.principal),
        }))
        if (contatos.some((c) => !EMAIL.test(c.email)))
          return apiError(422, 'validation', 'E-mail do contato inválido.')
        if (contatos.some((c) => !isValidPhone(c.telefone)))
          return apiError(422, 'validation', 'Telefone do contato inválido.')
        if (contatos.length && contatos.filter((c) => c.principal).length !== 1)
          return apiError(422, 'validation', 'Marque exatamente um contato como principal.')
        contatos.sort((a, b) => Number(b.principal) - Number(a.principal))
        const novos: { nome: string; cpf: string; telefone: string }[] = []
        for (const m of input.motoristas ?? []) {
          if (!('novo' in m)) continue
          const d = validarBasicoMotorista(m.novo)
          if (typeof d === 'string') return apiError(422, 'validation', d)
          if (cpfEmUso(d.cpf) || novos.some((x) => x.cpf === d.cpf)) return erroCpf()
          novos.push(d)
        }
        const t = atual ?? novaTransportadora({ nome: basico.nome, cnpj: basico.cnpj })
        const antes = transportadoraResumo(t)
        const nomesAntes = motoristasDe(t.id)
          .map((m) => m.nome)
          .join(', ')
        // Motoristas: vincula os escolhidos, cria os novos, desvincula quem saiu.
        const escolhidos = new Set(
          (input.motoristas ?? []).flatMap((m) => ('id' in m ? [m.id] : [])),
        )
        for (const m of s.motoristas) {
          if (escolhidos.has(m.id) && m.transportadoraId !== t.id) {
            editado(m, [
              {
                campo: 'transportadora',
                antes: nomeTransportadora(m.transportadoraId),
                depois: t.nome,
              },
            ])
            m.transportadoraId = t.id
          } else if (!escolhidos.has(m.id) && m.transportadoraId === t.id) {
            editado(m, [{ campo: 'transportadora', antes: t.nome, depois: null }])
            m.transportadoraId = null
          }
        }
        for (const d of novos) novoMotorista(d, t.id)
        if (!atual) {
          t.contatos = contatos
          return HttpResponse.json(transportadoraDetalhe(t), { status: 201 })
        }
        const mudancas: Mudanca[] = (['nome', 'cnpj'] as const)
          .filter((k) => antes[k] !== basico[k])
          .map((k) => ({ campo: k, antes: antes[k], depois: basico[k] }))
        const cAntes = resumoContatos(t.contatos)
        const cDepois = resumoContatos(contatos)
        if (cAntes !== cDepois) mudancas.push({ campo: 'contatos', antes: cAntes, depois: cDepois })
        const nomesDepois = motoristasDe(t.id)
          .map((m) => m.nome)
          .join(', ')
        if (nomesAntes !== nomesDepois)
          mudancas.push({
            campo: 'motoristas',
            antes: nomesAntes || null,
            depois: nomesDepois || null,
          })
        Object.assign(t, basico, { contatos })
        editado(t, mudancas)
        return HttpResponse.json(transportadoraDetalhe(t))
      }),
    ),
  ),
  http.post(
    '*/api/transportadoras/:id/transicao',
    comRede(async ({ request, params }) => {
      const t = getRelacionamento().transportadoras.find((x) => x.id === params.id)
      if (!t) return apiError(404, 'not_found', 'Transportadora não encontrada.')
      const { acao } = (await request.json()) as { acao: AcaoCadastro }
      return transicionar(t, acao)
        ? HttpResponse.json(transportadoraDetalhe(t))
        : naoPermitida(acao)
    }),
  ),

  /* ---------------- motoristas */
  http.get(
    '*/api/motoristas/resumo',
    comRede(() => {
      const l = getRelacionamento().motoristas
      return HttpResponse.json({
        ...resumo(l),
        semTransportadora: l.filter((m) => !m.transportadoraId).length,
      })
    }),
  ),
  http.get(
    '*/api/motoristas',
    comRede(({ request }) =>
      pagina(request, getRelacionamento().motoristas.map(motoristaResumo), COLS_MOTORISTA, 'nome', [
        'status',
      ]),
    ),
  ),
  http.get(
    '*/api/motoristas/:id',
    comRede(({ params }) => {
      const m = getRelacionamento().motoristas.find((x) => x.id === params.id)
      return m
        ? HttpResponse.json(motoristaDetalhe(m))
        : apiError(404, 'not_found', 'Motorista não encontrado.')
    }),
  ),
  ...(['post', 'put'] as const).map((metodo) =>
    http[metodo](
      metodo === 'post' ? '*/api/motoristas' : '*/api/motoristas/:id',
      comRede(async ({ request, params }) => {
        const s = getRelacionamento()
        const atual = params.id ? s.motoristas.find((x) => x.id === params.id) : undefined
        if (params.id && !atual) return apiError(404, 'not_found', 'Motorista não encontrado.')
        const input = (await request.json()) as Partial<MotoristaInput>
        const d = validarBasicoMotorista(input)
        if (typeof d === 'string') return apiError(422, 'validation', d)
        if (cpfEmUso(d.cpf, atual?.id)) return erroCpf()
        let transportadoraId = input.transportadoraId ?? null
        if (transportadoraId && !s.transportadoras.some((t) => t.id === transportadoraId))
          return apiError(422, 'validation', 'Transportadora não encontrada.')
        if (input.novaTransportadora) {
          const nt = validarBasicoTransportadora(input.novaTransportadora)
          if (typeof nt === 'string') return apiError(422, 'validation', nt)
          if (cnpjEmUso(nt.cnpj)) return erroCnpj()
          transportadoraId = novaTransportadora(nt).id
        }
        if (!atual)
          return HttpResponse.json(motoristaDetalhe(novoMotorista(d, transportadoraId)), {
            status: 201,
          })
        const mudancas: Mudanca[] = (['nome', 'cpf', 'telefone'] as const)
          .filter((k) => atual[k] !== d[k])
          .map((k) => ({ campo: k, antes: atual[k], depois: d[k] }))
        if (atual.transportadoraId !== transportadoraId)
          mudancas.push({
            campo: 'transportadora',
            antes: nomeTransportadora(atual.transportadoraId),
            depois: nomeTransportadora(transportadoraId),
          })
        Object.assign(atual, d, { transportadoraId })
        editado(atual, mudancas)
        return HttpResponse.json(motoristaDetalhe(atual))
      }),
    ),
  ),
  http.post(
    '*/api/motoristas/:id/transicao',
    comRede(async ({ request, params }) => {
      const m = getRelacionamento().motoristas.find((x) => x.id === params.id)
      if (!m) return apiError(404, 'not_found', 'Motorista não encontrado.')
      const { acao } = (await request.json()) as { acao: AcaoCadastro }
      return transicionar(m, acao) ? HttpResponse.json(motoristaDetalhe(m)) : naoPermitida(acao)
    }),
  ),

  /* ---------------- veículos */
  http.get(
    '*/api/veiculos/resumo',
    comRede(() => HttpResponse.json(resumo(getRelacionamento().veiculos))),
  ),
  http.get(
    '*/api/veiculos',
    comRede(({ request }) =>
      pagina(request, getRelacionamento().veiculos.map(veiculoLinha), COLS_VEICULO, 'codigo', [
        'tipo',
        'status',
      ]),
    ),
  ),
  http.get(
    '*/api/veiculos/:id',
    comRede(({ params }) => {
      const v = getRelacionamento().veiculos.find((x) => x.id === params.id)
      return v
        ? HttpResponse.json(veiculoDetalhe(v))
        : apiError(404, 'not_found', 'Veículo não encontrado.')
    }),
  ),
  ...(['post', 'put'] as const).map((metodo) =>
    http[metodo](
      metodo === 'post' ? '*/api/veiculos' : '*/api/veiculos/:id',
      comRede(async ({ request, params }) => {
        const s = getRelacionamento()
        const atual = params.id ? s.veiculos.find((x) => x.id === params.id) : undefined
        if (params.id && !atual) return apiError(404, 'not_found', 'Veículo não encontrado.')
        const d = (await request.json()) as VeiculoInput
        if (!['truck', 'carreta', 'van'].includes(d.tipo))
          return apiError(422, 'validation', 'Tipo de veículo inválido.')
        if (d.volumeMinimo !== null && d.volumeMaximo !== null && d.volumeMinimo > d.volumeMaximo)
          return apiError(422, 'validation', 'O volume mínimo não pode ser maior que o máximo.')
        if (!atual) {
          s.seq.vei += 1
          const agora = new Date().toISOString()
          const v: VeiculoDb = {
            id: `vei${String(s.seq.vei).padStart(5, '0')}`,
            codigo: codigo('VEI', s.seq.vei),
            ...d,
            status: 'ativo',
            criadoEm: agora,
            criadoPor: autor(),
            alteradoEm: agora,
            alteradoPor: autor(),
            historico: [{ id: `h${Date.now()}`, autor: autor(), em: agora, acao: 'criado' }],
          }
          s.veiculos.unshift(v)
          return HttpResponse.json(veiculoDetalhe(v), { status: 201 })
        }
        const campos = [
          'tipo',
          'volumeMinimo',
          'volumeMaximo',
          'comprimento',
          'largura',
          'capacidadePallets',
          'capacidadeToneladas',
        ] as const
        const mudancas: Mudanca[] = campos
          .filter((k) => atual[k] !== d[k])
          .map((k) => ({ campo: k, antes: atual[k], depois: d[k] }))
        Object.assign(atual, d)
        editado(atual, mudancas)
        return HttpResponse.json(veiculoDetalhe(atual))
      }),
    ),
  ),
  http.post(
    '*/api/veiculos/:id/transicao',
    comRede(async ({ request, params }) => {
      const v = getRelacionamento().veiculos.find((x) => x.id === params.id)
      if (!v) return apiError(404, 'not_found', 'Veículo não encontrado.')
      const { acao } = (await request.json()) as { acao: AcaoCadastro }
      return transicionar(v, acao) ? HttpResponse.json(veiculoDetalhe(v)) : naoPermitida(acao)
    }),
  ),
]
