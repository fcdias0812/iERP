import { http, HttpResponse } from 'msw/http'
import { facetCounts, runQuery, type EngineColumn } from '@/components/data-table/engine'
import { searchToQuery, tableSearchSchema } from '@/components/data-table/url-state'
import { isValidCnpj, isValidPhone } from '@/lib/validators/br'
import type {
  AcaoCliente,
  Cliente,
  ClienteInput,
  ClienteResumo,
  ClientesResumo,
  ConfiguracoesClienteInput,
  Mudanca,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'
import { CONFIGURACOES_PADRAO } from '@/features/clientes/configuracoes'
import { TRANSICOES_CLIENTE, acoesCliente, codigoCliente, getDb, resumoCliente } from '../db'
import { getRelacionamento } from './relacionamento'

/** Valor de configuração no histórico (serviços e instruções em texto). */
const comoValor = (v: unknown): Mudanca['depois'] => {
  if (v === null || v === undefined) return null
  if (typeof v === 'object')
    return 'textos' in (v as object)
      ? (Object.values((v as { textos: Record<string, string> }).textos)[0] ?? null)
      : Object.entries(v as Record<string, boolean>)
          .filter(([, sim]) => sim)
          .map(([k]) => k)
          .join(', ')
  return v as Mudanca['depois']
}

/*
 * API SIMULADA de clientes (mesmo contrato de server/src/modules/clientes): usada nos testes
 * e2e e na demonstração sem backend (VITE_USE_MOCKS=true).
 */

const autor = () => useSessionStore.getState().user.name
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const limparCnpj = (v: string) => v.replace(/[^0-9a-z]/gi, '').toUpperCase()

function colunas(): EngineColumn<ClienteResumo>[] {
  return [
    { id: 'codigo', type: 'unique-text', accessor: (r) => r.codigo },
    { id: 'nome', type: 'unique-text', accessor: (r) => r.nome },
    { id: 'cnpj', type: 'unique-text', accessor: (r) => r.cnpj },
    { id: 'slaDias', type: 'number', accessor: (r) => r.slaDias },
    { id: 'contatoEmail', type: 'unique-text', accessor: (r) => r.contatoEmail },
    { id: 'contatoTelefone', type: 'unique-text', accessor: (r) => r.contatoTelefone },
    { id: 'contatos', type: 'number', accessor: (r) => r.contatos },
    { id: 'status', type: 'status', accessor: (r) => r.status },
    { id: 'criadoEm', type: 'date', accessor: (r) => r.criadoEm },
  ]
}

function lerConsulta(url: URL) {
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
  const cols = colunas()
  const query = searchToQuery(
    tableSearchSchema.parse(raw),
    Object.fromEntries(cols.map((c) => [c.id, c.type])),
  )
  if (!query.sort.length) query.sort = [{ id: 'nome', desc: false }]
  if (typeof raw.ps === 'number' && raw.ps > 0) query.pageSize = Math.min(raw.ps, 100_000)
  return { query, cols }
}

/** Mesmas regras do servidor. Devolve a mensagem de erro ou os dados limpos. */
function validar(input: Partial<ClienteInput>): string | ClienteInput {
  const nome = input.nome?.trim() ?? ''
  const cnpj = limparCnpj(input.cnpj ?? '')
  if (nome.length < 2) return 'Informe o nome do cliente.'
  if (!isValidCnpj(cnpj)) return 'CNPJ inválido.'
  const contatos = (input.contatos ?? []).map((c) => ({
    id: c.id ?? null,
    nome: c.nome?.trim() || null,
    email: (c.email ?? '').trim().toLowerCase(),
    telefone: (c.telefone ?? '').replace(/\D/g, ''),
    principal: Boolean(c.principal),
  }))
  if (!contatos.length) return 'Informe pelo menos um contato.'
  if (contatos.some((c) => !EMAIL.test(c.email))) return 'E-mail do contato inválido.'
  if (contatos.some((c) => !isValidPhone(c.telefone))) return 'Telefone do contato inválido.'
  if (contatos.filter((c) => c.principal).length !== 1)
    return 'Marque exatamente um contato como principal.'
  const slaDias = input.slaDias ?? null
  if (slaDias !== null && (!Number.isInteger(slaDias) || slaDias < 1)) return 'SLA inválido.'
  return { nome, cnpj, slaDias, contatos }
}

const cnpjEmUso = (cnpj: string, idAtual?: string) =>
  getDb().clientes.some((c) => c.id !== idAtual && c.cnpj === cnpj)

const comIds = (id: string, l: ClienteInput['contatos']) =>
  [...l]
    .sort((a, b) => Number(b.principal) - Number(a.principal))
    // Contato existente mantém o id (vínculo com sites); novo ganha um id.
    .map((c, i) => ({ ...c, id: c.id ?? `${id}-c${Date.now()}${i}` }))

const resumoContatos = (l: { email: string; principal: boolean }[]) =>
  l.map((c) => (c.principal ? `${c.email} (principal)` : c.email)).join(', ')

export const clientesHandlers = [
  http.get('*/api/clientes/resumo', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const { clientes } = getDb()
    const ativos = clientes.filter((c) => c.status === 'ativo').length
    const body: ClientesResumo = {
      total: clientes.length,
      ativos,
      inativos: clientes.length - ativos,
    }
    return HttpResponse.json(body)
  }),

  http.get('*/api/clientes', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const { query, cols } = lerConsulta(new URL(request.url))
    const resumos = getDb().clientes.map(resumoCliente)
    const page = runQuery(resumos, cols, query, (r) => r.id)
    const facets = { status: Object.fromEntries(facetCounts(resumos, cols, query, 'status')) }
    return HttpResponse.json({ rows: page.rows, total: page.total, totals: page.totals, facets })
  }),

  http.get('*/api/clientes/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const c = getDb().clientes.find((x) => x.id === params.id)
    return c ? HttpResponse.json(c) : apiError(404, 'not_found', 'Cliente não encontrado.')
  }),

  http.post('*/api/clientes', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const dados = validar((await request.json()) as Partial<ClienteInput>)
    if (typeof dados === 'string') return apiError(422, 'validation', dados)
    if (cnpjEmUso(dados.cnpj))
      return apiError(409, 'cnpj_in_use', 'Já existe um cliente com este CNPJ.')
    const db = getDb()
    db.seqClientes += 1
    const id = `cli${String(db.seqClientes).padStart(5, '0')}`
    const agora = new Date().toISOString()
    const cliente: Cliente = {
      id,
      codigo: codigoCliente(db.seqClientes),
      nome: dados.nome,
      cnpj: dados.cnpj,
      slaDias: dados.slaDias ?? null,
      status: 'ativo',
      configuracoes: {
        ...CONFIGURACOES_PADRAO,
        slaDias: dados.slaDias ?? null,
        sistemaProcessamento: /\bdell\b/i.test(dados.nome) ? 'MOONSHOT' : null,
      },
      contatos: comIds(id, dados.contatos),
      criadoEm: agora,
      criadoPor: autor(),
      alteradoEm: agora,
      alteradoPor: autor(),
      historico: [{ id: `h${Date.now()}`, autor: autor(), em: agora, acao: 'criado' }],
      acoesPermitidas: acoesCliente('ativo'),
    }
    db.clientes.unshift(cliente)
    return HttpResponse.json(cliente, { status: 201 })
  }),

  http.put('*/api/clientes/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const db = getDb()
    const idx = db.clientes.findIndex((x) => x.id === params.id)
    const atual = db.clientes[idx]
    if (!atual) return apiError(404, 'not_found', 'Cliente não encontrado.')
    const dados = validar((await request.json()) as Partial<ClienteInput>)
    if (typeof dados === 'string') return apiError(422, 'validation', dados)
    if (cnpjEmUso(dados.cnpj, atual.id))
      return apiError(409, 'cnpj_in_use', 'Já existe um cliente com este CNPJ.')
    const mudancas: Mudanca[] = (['nome', 'cnpj', 'slaDias'] as const)
      .filter((k) => dados[k] !== undefined && atual[k] !== dados[k])
      .map((k) => ({ campo: k, antes: atual[k], depois: dados[k] ?? null }))
    const antes = resumoContatos(atual.contatos)
    const depois = resumoContatos(dados.contatos)
    if (antes !== depois) mudancas.push({ campo: 'contatos', antes, depois })
    const agora = new Date().toISOString()
    db.clientes[idx] = {
      ...atual,
      nome: dados.nome,
      cnpj: dados.cnpj,
      slaDias: dados.slaDias === undefined ? atual.slaDias : dados.slaDias,
      contatos: comIds(atual.id, dados.contatos),
      alteradoEm: mudancas.length ? agora : atual.alteradoEm,
      alteradoPor: mudancas.length ? autor() : atual.alteradoPor,
      historico: mudancas.length
        ? [
            { id: `h${Date.now()}`, autor: autor(), em: agora, acao: 'editado', mudancas },
            ...atual.historico,
          ]
        : atual.historico,
    }
    return HttpResponse.json(db.clientes[idx])
  }),

  // Aba Configurações: grava tudo (o servidor de verdade confere mais regras).
  http.put('*/api/clientes/:id/configuracoes', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const db = getDb()
    const idx = db.clientes.findIndex((x) => x.id === params.id)
    const atual = db.clientes[idx]
    if (!atual) return apiError(404, 'not_found', 'Cliente não encontrado.')
    const v = (await request.json()) as ConfiguracoesClienteInput
    if (v.agendamentoBloqueado && !v.bloqueioMotivo?.trim())
      return apiError(422, 'validation', 'Informe o motivo do bloqueio.')
    const transportadora = v.transportadoraPadraoId
      ? getRelacionamento().transportadoras.find((x) => x.id === v.transportadoraPadraoId)
      : undefined
    const novas = {
      ...v,
      transportadoraPadraoNome: transportadora?.nome ?? null,
      bloqueioMotivo: v.agendamentoBloqueado ? v.bloqueioMotivo : null,
    }
    const mudancas: Mudanca[] = (Object.keys(v) as (keyof ConfiguracoesClienteInput)[])
      .filter((k) => JSON.stringify(atual.configuracoes[k]) !== JSON.stringify(novas[k]))
      .map((k) => ({
        campo: k === 'transportadoraPadraoId' ? 'transportadoraPadrao' : k,
        antes:
          k === 'transportadoraPadraoId'
            ? atual.configuracoes.transportadoraPadraoNome
            : (comoValor(atual.configuracoes[k]) ?? null),
        depois:
          k === 'transportadoraPadraoId' ? novas.transportadoraPadraoNome : comoValor(novas[k]),
      }))
    const agora = new Date().toISOString()
    db.clientes[idx] = {
      ...atual,
      slaDias: v.slaDias,
      configuracoes: novas,
      alteradoEm: mudancas.length ? agora : atual.alteradoEm,
      alteradoPor: mudancas.length ? autor() : atual.alteradoPor,
      historico: mudancas.length
        ? [
            { id: `h${Date.now()}`, autor: autor(), em: agora, acao: 'configurado', mudancas },
            ...atual.historico,
          ]
        : atual.historico,
    }
    return HttpResponse.json(db.clientes[idx])
  }),

  http.post('*/api/clientes/:id/transicao', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const db = getDb()
    const idx = db.clientes.findIndex((x) => x.id === params.id)
    const atual = db.clientes[idx]
    if (!atual) return apiError(404, 'not_found', 'Cliente não encontrado.')
    const { acao } = (await request.json()) as { acao: AcaoCliente }
    const destino = TRANSICOES_CLIENTE[atual.status][acao]
    if (!destino)
      return apiError(409, 'invalid_transition', `Ação "${acao}" não é permitida no status atual.`)
    const agora = new Date().toISOString()
    db.clientes[idx] = {
      ...atual,
      status: destino,
      acoesPermitidas: acoesCliente(destino),
      alteradoEm: agora,
      alteradoPor: autor(),
      historico: [
        {
          id: `h${Date.now()}`,
          autor: autor(),
          em: agora,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
        },
        ...atual.historico,
      ],
    }
    return HttpResponse.json(db.clientes[idx])
  }),
]
