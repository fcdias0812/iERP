import { http, HttpResponse } from 'msw/http'
import i18n from '@/i18n'
import { facetCounts, runQuery, type EngineColumn } from '@/components/data-table/engine'
import { searchToQuery, tableSearchSchema } from '@/components/data-table/url-state'
import { ROLES } from '@/config/permissions'
import type {
  AcaoUsuario,
  Mudanca,
  Usuario,
  UsuarioInput,
  UsuarioResumo,
  UsuariosResumo,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'
import { TRANSICOES, acoesDe, codigoUsuario, getDb, normEmail, resumoDe } from '../db'

/*
 * API de usuários: GET/POST /api/usuarios, GET/PUT /api/usuarios/:id,
 * POST /api/usuarios/:id/transicao, GET /api/usuarios/resumo.
 * A lista aceita os mesmos parâmetros do estado do DataTable na URL (q, s, f, a, p, ps)
 * e usa o MESMO motor (runQuery) — mesma semântica do modo cliente.
 */

const autor = () => useSessionStore.getState().user.name
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Colunas que a API sabe filtrar/ordenar (ids = campos de UsuarioResumo). */
export function colunasUsuario(): EngineColumn<UsuarioResumo>[] {
  return [
    { id: 'codigo', type: 'unique-text', accessor: (r) => r.codigo },
    { id: 'nome', type: 'unique-text', accessor: (r) => r.nome },
    { id: 'email', type: 'unique-text', accessor: (r) => r.email },
    {
      id: 'perfil',
      type: 'enum',
      accessor: (r) => r.perfil,
      options: ROLES.map((r) => ({ value: r, label: i18n.t(`roles.${r}`) })),
    },
    { id: 'status', type: 'status', accessor: (r) => r.status },
    { id: 'ultimoAcesso', type: 'date', accessor: (r) => r.ultimoAcesso },
    { id: 'criadoEm', type: 'date', accessor: (r) => r.criadoEm },
  ]
}

/** Lê a query da URL no mesmo formato do DataTable. */
function lerConsulta(url: URL) {
  const raw: Record<string, unknown> = {}
  for (const [k, v] of url.searchParams) {
    if (k === 'q') raw.q = v
    else if (k === 's') raw.s = v
    else if (k === 'p' || k === 'ps') raw[k] = Number(v)
    else if (k === 'f' || k === 'a') {
      try {
        raw[k] = JSON.parse(v)
      } catch {
        /* parâmetro inválido: ignora */
      }
    }
  }
  const colunas = colunasUsuario()
  const query = searchToQuery(
    tableSearchSchema.parse(raw),
    Object.fromEntries(colunas.map((c) => [c.id, c.type])),
  )
  // Sem ordenação pedida: por nome.
  if (!query.sort.length) query.sort = [{ id: 'nome', desc: false }]
  // O servidor aceita páginas maiores (exportação).
  if (typeof raw.ps === 'number' && raw.ps > 0) query.pageSize = Math.min(raw.ps, 100_000)
  return { query, colunas }
}

/** Valida o que veio do formulário. Devolve a mensagem de erro ou os dados limpos. */
function validar(input: Partial<UsuarioInput>): string | UsuarioInput {
  const nome = input.nome?.trim() ?? ''
  const email = normEmail(input.email ?? '')
  if (nome.length < 3) return 'Informe o nome completo.'
  if (!EMAIL.test(email)) return 'E-mail inválido.'
  if (!input.perfil || !ROLES.includes(input.perfil)) return 'Perfil de acesso inválido.'
  return { nome, email, perfil: input.perfil }
}

function emailEmUso(email: string, idAtual?: string) {
  return getDb().usuarios.some((u) => u.id !== idAtual && normEmail(u.email) === email)
}

const completo = (u: Usuario): Usuario => ({ ...u, acoesPermitidas: acoesDe(u.status) })

const CAMPOS_EDITAVEIS: (keyof UsuarioInput)[] = ['nome', 'email', 'perfil']

export const usuariosHandlers = [
  http.get('*/api/usuarios/resumo', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const { usuarios } = getDb()
    const conta = (s: Usuario['status']) => usuarios.filter((u) => u.status === s).length
    const body: UsuariosResumo = {
      total: usuarios.length,
      ativos: conta('ativo'),
      bloqueados: conta('bloqueado'),
      inativos: conta('inativo'),
    }
    return HttpResponse.json(body)
  }),

  http.get('*/api/usuarios', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const { query, colunas } = lerConsulta(new URL(request.url))
    const resumos = getDb().usuarios.map(resumoDe)
    const page = runQuery(resumos, colunas, query, (r) => r.id)
    const facets: Record<string, Record<string, number>> = {}
    for (const c of colunas.filter((c) => c.type === 'enum' || c.type === 'status'))
      facets[c.id] = Object.fromEntries(facetCounts(resumos, colunas, query, c.id))
    return HttpResponse.json({ rows: page.rows, total: page.total, totals: page.totals, facets })
  }),

  http.get('*/api/usuarios/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const u = getDb().usuarios.find((x) => x.id === params.id)
    return u ? HttpResponse.json(u) : apiError(404, 'not_found', 'Usuário não encontrado.')
  }),

  http.post('*/api/usuarios', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const dados = validar((await request.json()) as Partial<UsuarioInput>)
    if (typeof dados === 'string') return apiError(422, 'validation', dados)
    if (emailEmUso(dados.email))
      return apiError(409, 'email_in_use', 'Já existe um usuário com este e-mail.')
    const db = getDb()
    const agora = new Date().toISOString()
    db.seq += 1
    const usuario = completo({
      id: `usr${String(db.seq).padStart(5, '0')}`,
      codigo: codigoUsuario(db.seq),
      ...dados,
      status: 'ativo',
      ultimoAcesso: null,
      criadoEm: agora,
      criadoPor: autor(),
      alteradoEm: agora,
      alteradoPor: autor(),
      historico: [{ id: `h${Date.now()}`, autor: autor(), em: agora, acao: 'criado' }],
      acoesPermitidas: [],
    })
    db.usuarios.unshift(usuario)
    return HttpResponse.json(usuario, { status: 201 })
  }),

  http.put('*/api/usuarios/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const db = getDb()
    const idx = db.usuarios.findIndex((x) => x.id === params.id)
    const atual = db.usuarios[idx]
    if (!atual) return apiError(404, 'not_found', 'Usuário não encontrado.')
    const dados = validar((await request.json()) as Partial<UsuarioInput>)
    if (typeof dados === 'string') return apiError(422, 'validation', dados)
    if (emailEmUso(dados.email, atual.id))
      return apiError(409, 'email_in_use', 'Já existe um usuário com este e-mail.')
    const agora = new Date().toISOString()
    // Histórico com antes → depois só do que mudou.
    const mudancas: Mudanca[] = CAMPOS_EDITAVEIS.filter((k) => atual[k] !== dados[k]).map((k) => ({
      campo: k,
      antes: atual[k],
      depois: dados[k],
    }))
    db.usuarios[idx] = completo({
      ...atual,
      ...dados,
      alteradoEm: agora,
      alteradoPor: autor(),
      historico: mudancas.length
        ? [
            { id: `h${Date.now()}`, autor: autor(), em: agora, acao: 'editado', mudancas },
            ...atual.historico,
          ]
        : atual.historico,
    })
    return HttpResponse.json(db.usuarios[idx])
  }),

  http.post('*/api/usuarios/:id/transicao', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const db = getDb()
    const idx = db.usuarios.findIndex((x) => x.id === params.id)
    const atual = db.usuarios[idx]
    if (!atual) return apiError(404, 'not_found', 'Usuário não encontrado.')
    const { acao, motivo } = (await request.json()) as { acao: AcaoUsuario; motivo?: string }
    const destino = TRANSICOES[atual.status][acao]
    if (!destino)
      return apiError(409, 'invalid_transition', `Ação "${acao}" não é permitida no status atual.`)
    if (acao === 'bloquear' && !motivo?.trim())
      return apiError(422, 'validation', 'Informe o motivo do bloqueio.')
    const agora = new Date().toISOString()
    db.usuarios[idx] = completo({
      ...atual,
      status: destino,
      alteradoEm: agora,
      alteradoPor: autor(),
      historico: [
        {
          id: `h${Date.now()}`,
          autor: autor(),
          em: agora,
          acao: 'status',
          mudancas: [{ campo: 'status', antes: atual.status, depois: destino }],
          nota: motivo?.trim() || undefined,
        },
        ...atual.historico,
      ],
    })
    return HttpResponse.json(db.usuarios[idx])
  }),
]
