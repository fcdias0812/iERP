import { http, HttpResponse } from 'msw/http'
import type {
  ContatoCliente,
  DocumentoCliente,
  PainelCliente,
  PeriodoPainel,
  SiteCliente,
  SiteInput,
  TipoDocumento,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'
import { getDb } from '../db'
import { ordensMock } from './ordens'

/*
 * API SIMULADA das abas do cliente (mesmo contrato de server/src/modules/clientes):
 * painel da Visão geral, sites/docas, documentos e geolocalização. Usada nos testes e2e e na
 * demonstração sem backend (VITE_USE_MOCKS=true). Regras resumidas; as completas são do servidor.
 */

const autor = () => useSessionStore.getState().user.name
const TIPOS: TipoDocumento[] = ['contrato', 'fiscal', 'licenca', 'outro']
const EXTENSOES = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'xml',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'zip',
]
const MAX_BYTES = 25 * 1024 * 1024

const cliente = (id: unknown) => getDb().clientes.find((c) => c.id === id)
/** Documento sem o conteúdo (o conteúdo só sai no download). */
function semDoc(d: DocumentoCliente & { conteudo?: Blob }): DocumentoCliente {
  const copia = { ...d }
  delete copia.conteudo
  return copia
}

function historico(clienteId: string, acao: Parameters<typeof registrar>[1], nota: string) {
  registrar(clienteId, acao, nota)
}
function registrar(
  clienteId: string,
  acao:
    | 'site_criado'
    | 'site_editado'
    | 'site_removido'
    | 'documento_adicionado'
    | 'documento_removido',
  nota: string,
) {
  const c = cliente(clienteId)
  if (!c) return
  c.historico = [
    { id: `h${Date.now()}`, autor: autor(), em: new Date().toISOString(), acao, nota },
    ...c.historico,
  ]
}

/** Responsável do site: contato existente ou novo (que entra nos contatos do cliente). */
function responsavel(clienteId: string, input: SiteInput): ContatoCliente | null | string {
  const c = cliente(clienteId)!
  if (input.novoContato) {
    const novo: ContatoCliente = {
      id: `${clienteId}-c${Date.now()}`,
      nome: input.novoContato.nome,
      email: input.novoContato.email.trim().toLowerCase(),
      telefone: input.novoContato.telefone.replace(/\D/g, ''),
      principal: false,
    }
    c.contatos = [...c.contatos, novo]
    return novo
  }
  if (!input.contatoId) return null
  return (
    c.contatos.find((k) => k.id === input.contatoId) ??
    'O responsável precisa ser um contato deste cliente.'
  )
}

function montarSite(
  clienteId: string,
  input: SiteInput,
  atual?: SiteCliente,
): SiteCliente | string {
  if (!input.codigo?.trim()) return 'Informe o código do site.'
  const sites = getDb().sites[clienteId] ?? []
  if (
    sites.some(
      (s) => s.id !== atual?.id && s.codigo.toLowerCase() === input.codigo.trim().toLowerCase(),
    )
  )
    return 'site_code_in_use'
  const resp = responsavel(clienteId, input)
  if (typeof resp === 'string') return resp
  const agora = new Date().toISOString()
  return {
    id: atual?.id ?? `site${Date.now()}`,
    codigo: input.codigo.trim(),
    regiao: input.regiao,
    horario: input.horario,
    totalGaylords: input.totalGaylords,
    cep: input.cep,
    endereco: input.endereco,
    latitude: input.latitude,
    longitude: input.longitude,
    shredderProprio: input.shredderProprio,
    edgeSite: input.edgeSite,
    responsavel: resp,
    docas: input.docas.map((d, i) => ({ ...d, id: `doca${Date.now()}${i}` })),
    criadoEm: atual?.criadoEm ?? agora,
    alteradoEm: agora,
  }
}

export const clientesAbasHandlers = [
  // Painel da Visão geral: as mesmas contas do servidor, sobre os lotes simulados.
  http.get('*/api/clientes/:id/painel', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const c = cliente(params.id)
    if (!c) return apiError(404, 'not_found', 'Cliente não encontrado.')
    const pedido = new URL(request.url).searchParams.get('periodo')
    const periodo: PeriodoPainel =
      (['30', '90', '365', 'tudo'] as const).find((x) => x === pedido) ?? '365'
    return HttpResponse.json(painelSimulado(c.id, c.configuracoes.slaDias, periodo))
  }),

  /* ---------------- sites */

  http.get('*/api/clientes/:id/sites', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    if (!cliente(params.id)) return apiError(404, 'not_found', 'Cliente não encontrado.')
    return HttpResponse.json(getDb().sites[String(params.id)] ?? [])
  }),

  http.post('*/api/clientes/:id/sites', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const id = String(params.id)
    if (!cliente(id)) return apiError(404, 'not_found', 'Cliente não encontrado.')
    const site = montarSite(id, (await request.json()) as SiteInput)
    if (site === 'site_code_in_use')
      return apiError(409, 'site_code_in_use', 'Já existe um site com este código neste cliente.')
    if (typeof site === 'string') return apiError(422, 'validation', site)
    const db = getDb()
    db.sites[id] = [...(db.sites[id] ?? []), site]
    historico(id, 'site_criado', site.codigo)
    return HttpResponse.json(site, { status: 201 })
  }),

  http.put('*/api/clientes/:id/sites/:siteId', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const id = String(params.id)
    const db = getDb()
    const atual = (db.sites[id] ?? []).find((s) => s.id === params.siteId)
    if (!atual) return apiError(404, 'not_found', 'Site não encontrado.')
    const site = montarSite(id, (await request.json()) as SiteInput, atual)
    if (site === 'site_code_in_use')
      return apiError(409, 'site_code_in_use', 'Já existe um site com este código neste cliente.')
    if (typeof site === 'string') return apiError(422, 'validation', site)
    db.sites[id] = (db.sites[id] ?? []).map((s) => (s.id === atual.id ? site : s))
    historico(id, 'site_editado', site.codigo)
    return HttpResponse.json(site)
  }),

  http.delete('*/api/clientes/:id/sites/:siteId', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const id = String(params.id)
    const db = getDb()
    const atual = (db.sites[id] ?? []).find((s) => s.id === params.siteId)
    if (!atual) return apiError(404, 'not_found', 'Site não encontrado.')
    db.sites[id] = (db.sites[id] ?? []).filter((s) => s.id !== atual.id)
    historico(id, 'site_removido', atual.codigo)
    return new HttpResponse(null, { status: 204 })
  }),

  /* ---------------- documentos */

  http.get('*/api/clientes/:id/documentos', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    if (!cliente(params.id)) return apiError(404, 'not_found', 'Cliente não encontrado.')
    return HttpResponse.json((getDb().documentos[String(params.id)] ?? []).map(semDoc))
  }),

  http.post('*/api/clientes/:id/documentos', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const id = String(params.id)
    if (!cliente(id)) return apiError(404, 'not_found', 'Cliente não encontrado.')
    const form = await request.formData()
    const arquivo = form.get('arquivo')
    const tipo = String(form.get('tipo') ?? '') as TipoDocumento
    if (!(arquivo instanceof File)) return apiError(422, 'validation', 'Envie um arquivo.')
    if (!TIPOS.includes(tipo)) return apiError(422, 'validation', 'Tipo de documento inválido.')
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? ''
    if (!EXTENSOES.includes(extensao))
      return apiError(415, 'file_type_not_allowed', 'Tipo de arquivo não permitido.')
    if (arquivo.size > MAX_BYTES)
      return apiError(413, 'file_too_large', 'Arquivo maior que o permitido.')
    const doc = {
      id: `doc${Date.now()}`,
      tipo,
      nome: arquivo.name,
      extensao,
      tamanho: arquivo.size,
      enviadoEm: new Date().toISOString(),
      enviadoPor: autor(),
      conteudo: arquivo,
    }
    const db = getDb()
    db.documentos[id] = [doc, ...(db.documentos[id] ?? [])]
    historico(id, 'documento_adicionado', doc.nome)
    return HttpResponse.json(semDoc(doc), { status: 201 })
  }),

  http.get('*/api/clientes/:id/documentos/:docId/arquivo', async ({ params }) => {
    const doc = (getDb().documentos[String(params.id)] ?? []).find((d) => d.id === params.docId)
    if (!doc) return apiError(404, 'not_found', 'Documento não encontrado.')
    return new HttpResponse(doc.conteudo, {
      headers: { 'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.nome)}"` },
    })
  }),

  http.delete('*/api/clientes/:id/documentos/:docId', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const id = String(params.id)
    const db = getDb()
    const doc = (db.documentos[id] ?? []).find((d) => d.id === params.docId)
    if (!doc) return apiError(404, 'not_found', 'Documento não encontrado.')
    db.documentos[id] = (db.documentos[id] ?? []).filter((d) => d.id !== doc.id)
    historico(id, 'documento_removido', doc.nome)
    return new HttpResponse(null, { status: 204 })
  }),

  /* ---------------- geolocalização (respostas fixas: sem internet) */

  http.get('*/api/geo/cep/:cep', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const cep = String(params.cep).replace(/\D/g, '')
    if (cep !== '01001000') return apiError(404, 'cep_not_found', 'CEP não encontrado.')
    return HttpResponse.json({
      cep,
      logradouro: 'Praça da Sé',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP',
      regiao: 'sudeste',
      endereco: 'Praça da Sé, Sé, São Paulo – SP',
    })
  }),

  http.get('*/api/geo/endereco', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    return HttpResponse.json({
      latitude: -23.5503898,
      longitude: -46.633081,
      descricao: 'Praça da Sé, São Paulo',
      precisao: 'endereco',
    })
  }),
]

const DIA_MS = 86_400_000

/** O painel do cliente sobre os lotes simulados (regras completas no servidor). */
function painelSimulado(
  clienteId: string,
  slaDias: number | null,
  periodo: PeriodoPainel,
): PainelCliente {
  const agora = Date.now()
  const inicio = periodo === 'tudo' ? null : agora - Number(periodo) * DIA_MS
  const noPeriodo = (iso: string | null) => Boolean(iso) && (!inicio || Date.parse(iso!) >= inicio)
  const lotes = ordensMock().filter((o) => o.clienteId === clienteId && !o.juntadoA)
  const validos = lotes.filter((o) => o.status !== 'cancelado')
  const coleta = (o: (typeof lotes)[number]) => o.dataColeta ?? o.coletaPrevista
  const doPeriodo = validos.filter((o) => noPeriodo(coleta(o)))
  const recebidos = validos.filter((o) => noPeriodo(o.recebidoEm))
  const concluidos = validos.filter((o) => o.status === 'concluido' && noPeriodo(o.codEmitidoEm))
  const emOperacao = validos.filter((o) =>
    ['inspecao', 'processo', 'aguardando_cod'].includes(o.status),
  )
  const mes = (iso: string) => iso.slice(0, 7)
  const meses = Array.from({ length: periodo === '30' ? 2 : periodo === '90' ? 4 : 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  }).reverse()
  const pesagens = recebidos.flatMap((o) =>
    o.pallets.map((p) => ({ mes: mes(o.recebidoEm!), kg: p.pesoKg })),
  )
  const duracoes = concluidos
    .filter((o) => o.recebidoEm && o.codEmitidoEm)
    .map((o) => (Date.parse(o.codEmitidoEm!) - Date.parse(o.recebidoEm!)) / DIA_MS)
  const noPrazo = slaDias ? duracoes.filter((d) => d <= slaDias).length : 0
  const materiais = new Map<string, { codigo: string; rotulo: string; kg: number }>()
  for (const o of doPeriodo)
    for (const m of o.balanco?.commodities ?? []) {
      const atual = materiais.get(m.codigo) ?? { codigo: m.codigo, rotulo: m.rotulo, kg: 0 }
      atual.kg += m.pesoKg
      materiais.set(m.codigo, atual)
    }
  const ocorrencias = new Map<PainelCliente['ocorrencias'][number]['categoria'], number>()
  for (const o of lotes)
    for (const oc of o.ocorrencias)
      if (oc.status !== 'cancelado' && noPeriodo(oc.criadoEm))
        ocorrencias.set(oc.categoria, (ocorrencias.get(oc.categoria) ?? 0) + 1)
  return {
    periodo,
    desde: inicio ? new Date(inicio).toISOString().slice(0, 10) : null,
    agora: {
      aChegar: validos.filter((o) => o.status === 'agendado').length,
      emOperacao: emOperacao.length,
      proximaColeta:
        validos
          .filter((o) => o.status === 'agendado' && Date.parse(coleta(o)) >= agora - DIA_MS)
          .map((o) => coleta(o).slice(0, 10))
          .sort()[0] ?? null,
    },
    numeros: {
      lotes: doPeriodo.length,
      concluidos: concluidos.length,
      kgRecebidos: pesagens.reduce((a, p) => a + (p.kg ?? 0), 0),
      palletsRecebidos: pesagens.length,
    },
    etapas: (['agendado', 'inspecao', 'processo', 'aguardando_cod', 'concluido'] as const).map(
      (etapa) => ({ etapa, lotes: doPeriodo.filter((o) => o.status === etapa).length }),
    ),
    porMes: meses.map((m) => ({
      mes: m,
      lotes: doPeriodo.filter((o) => mes(coleta(o)) === m).length,
      kg: pesagens.filter((p) => p.mes === m).reduce((a, p) => a + (p.kg ?? 0), 0),
    })),
    materiais: [...materiais.values()].sort((a, b) => b.kg - a.kg),
    prazo: {
      slaDias,
      noPrazo,
      foraDoPrazo: slaDias ? duracoes.length - noPrazo : 0,
      cumprimento: slaDias && duracoes.length ? noPrazo / duracoes.length : null,
      tempoMedioDias: duracoes.length
        ? Math.round((duracoes.reduce((a, d) => a + d, 0) / duracoes.length) * 10) / 10
        : null,
      atrasadosAgora: slaDias
        ? emOperacao.filter(
            (o) => o.recebidoEm && (agora - Date.parse(o.recebidoEm)) / DIA_MS > slaDias,
          ).length
        : 0,
    },
    ocorrencias: [...ocorrencias.entries()]
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total),
    ultimos: [...lotes]
      .sort((a, b) => b.alteradoEm.localeCompare(a.alteradoEm))
      .slice(0, 5)
      .map((o) => ({ id: o.id, codigo: o.codigo, status: o.status, alteradoEm: o.alteradoEm })),
  }
}
