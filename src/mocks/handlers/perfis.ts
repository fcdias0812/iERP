import { http, HttpResponse } from 'msw/http'
import { PAGINAS } from '@/config/paginas'
import type { NivelAcesso } from '@/config/permissions'
import type { LocalizedText } from '@/lib/localized-text'
import type {
  EventoAuditoria,
  EventoHistorico,
  PerfilAcesso,
  PerfilAcessoInput,
  StatusCadastro,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'
import { getDb } from '../db'
import { ordensMock } from './ordens'

/*
 * API SIMULADA de Administração › Perfis de acesso e Auditoria (mesmo contrato de
 * server/src/modules/perfis e server/src/modules/auditoria). Os três perfis migrados:
 * Administrador (fixo), Operação (editar tudo menos Administração) e Leitura (visualizar).
 */

const autor = () => useSessionStore.getState().user.name
const agora = () => new Date().toISOString()
let seq = 0
const novoId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`
const texto = (pt: string, en: string, zh: string): LocalizedText => ({
  origem: 'pt-BR',
  textos: { 'pt-BR': pt, en, 'zh-TW': zh },
})
const semAdmin = (nivel: NivelAcesso) =>
  Object.fromEntries(PAGINAS.filter((p) => !p.startsWith('admin.')).map((p) => [p, nivel]))

interface Banco {
  perfis: PerfilAcesso[]
  historico: Record<string, EventoHistorico[]>
}
let banco: Banco | null = null

function db(): Banco {
  if (!banco) {
    const base = {
      descricao: null,
      usuarios: 0,
      status: 'ativo' as StatusCadastro,
      criadoEm: '2026-10-01T12:00:00.000Z',
      criadoPor: 'Sistema',
      alteradoEm: '2026-10-01T12:00:00.000Z',
      alteradoPor: 'Sistema',
    }
    banco = {
      perfis: [
        {
          ...base,
          id: 'admin',
          nome: texto('Administrador', 'Administrator', '管理員'),
          fixo: true,
          permissoes: {},
        },
        {
          ...base,
          id: 'operacao',
          nome: texto('Operação', 'Operations', '營運'),
          fixo: false,
          permissoes: semAdmin('editar'),
        },
        {
          ...base,
          id: 'leitura',
          nome: texto('Leitura', 'Read-only', '唯讀'),
          fixo: false,
          permissoes: semAdmin('ver'),
        },
      ],
      historico: {},
    }
  }
  return banco
}

/** Perfis (com a contagem de usuários). Usado também pela API simulada de usuários. */
export function perfisMock(): PerfilAcesso[] {
  const usuarios = getDb().usuarios
  for (const p of db().perfis) p.usuarios = usuarios.filter((u) => u.perfil === p.id).length
  return db().perfis
}

const detalhe = (p: PerfilAcesso) => ({
  ...p,
  historico: db().historico[p.id] ?? [],
  acoesPermitidas: p.fixo ? [] : p.status === 'ativo' ? ['inativar'] : ['reativar'],
})

function evento(id: string, e: Omit<EventoHistorico, 'id' | 'autor' | 'em'>) {
  const d = db()
  d.historico[id] = [
    { id: novoId('h'), autor: autor(), em: agora(), ...e },
    ...(d.historico[id] ?? []),
  ]
}

const limpar = (p: PerfilAcessoInput['permissoes']) =>
  Object.fromEntries(PAGINAS.filter((k) => p[k]).map((k) => [k, p[k] as NivelAcesso])) as Partial<
    Record<string, NivelAcesso>
  >

const sem = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
const nomeEmUso = (nome: LocalizedText, exceto?: string) =>
  db().perfis.some(
    (p) =>
      p.id !== exceto && sem(p.nome.textos['pt-BR'] ?? '') === sem(nome.textos[nome.origem] ?? ''),
  )

export const perfisHandlers = [
  http.get('*/api/perfis', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    return HttpResponse.json(perfisMock())
  }),
  http.get('*/api/perfis/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const p = perfisMock().find((x) => x.id === params.id)
    return p ? HttpResponse.json(detalhe(p)) : apiError(404, 'not_found', 'Perfil não encontrado.')
  }),
  http.post('*/api/perfis', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const i = (await request.json()) as PerfilAcessoInput
    if (nomeEmUso(i.nome)) return apiError(409, 'name_in_use', 'Já existe um perfil com este nome.')
    const p: PerfilAcesso = {
      id: novoId('per'),
      nome: i.nome,
      descricao: i.descricao,
      fixo: false,
      permissoes: limpar(i.permissoes),
      usuarios: 0,
      status: 'ativo',
      criadoEm: agora(),
      criadoPor: autor(),
      alteradoEm: agora(),
      alteradoPor: autor(),
    }
    db().perfis.push(p)
    evento(p.id, { acao: 'criado' })
    return HttpResponse.json(detalhe(p), { status: 201 })
  }),
  http.put('*/api/perfis/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const p = db().perfis.find((x) => x.id === params.id)
    if (!p) return apiError(404, 'not_found', 'Perfil não encontrado.')
    if (p.fixo) return apiError(409, 'fixed_profile', 'O perfil Administrador é fixo.')
    const i = (await request.json()) as PerfilAcessoInput
    if (nomeEmUso(i.nome, p.id))
      return apiError(409, 'name_in_use', 'Já existe um perfil com este nome.')
    const novas = limpar(i.permissoes)
    const mudancas = PAGINAS.filter(
      (k) => (p.permissoes[k] ?? 'nenhum') !== (novas[k] ?? 'nenhum'),
    ).map((k) => ({
      campo: `pagina:${k}`,
      antes: p.permissoes[k] ?? 'nenhum',
      depois: novas[k] ?? 'nenhum',
    }))
    Object.assign(p, {
      nome: i.nome,
      descricao: i.descricao,
      permissoes: novas,
      alteradoEm: agora(),
      alteradoPor: autor(),
    })
    if (mudancas.length) evento(p.id, { acao: 'editado', mudancas })
    return HttpResponse.json(detalhe(perfisMock().find((x) => x.id === p.id)!))
  }),
  http.post('*/api/perfis/:id/transicao', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const p = perfisMock().find((x) => x.id === params.id)
    if (!p) return apiError(404, 'not_found', 'Perfil não encontrado.')
    if (p.fixo) return apiError(409, 'fixed_profile', 'O perfil Administrador é fixo.')
    const { acao } = (await request.json()) as { acao: string }
    if (
      acao === 'inativar' &&
      getDb().usuarios.some((u) => u.perfil === p.id && u.status !== 'inativo')
    )
      return apiError(409, 'profile_in_use', 'Há usuários usando este perfil.')
    const antes = p.status
    p.status = acao === 'inativar' ? 'inativo' : 'ativo'
    evento(p.id, { acao: 'status', mudancas: [{ campo: 'status', antes, depois: p.status }] })
    return HttpResponse.json(detalhe(p))
  }),

  /* ---------------- auditoria: perfis + lotes (amostra simulada) */
  http.get('*/api/auditoria', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const desde = new URL(request.url).searchParams.get('desde')
    const eventos: EventoAuditoria[] = [
      ...perfisMock().flatMap((p) =>
        (db().historico[p.id] ?? []).map((h) => ({
          ...h,
          id: `perfil-${h.id}`,
          tipo: 'perfil' as const,
          registroId: p.id,
          registroRotulo: p.nome.textos['pt-BR'] ?? p.id,
          registroSubtipo: null,
        })),
      ),
      ...ordensMock().flatMap((o) =>
        o.historico.map((h) => ({
          ...h,
          id: `ordem-${h.id}`,
          tipo: 'ordem' as const,
          registroId: o.id,
          registroRotulo: o.codigo,
          registroSubtipo: null,
        })),
      ),
    ]
      .filter((e) => !desde || e.em >= desde)
      .sort((a, b) => b.em.localeCompare(a.em))
    return HttpResponse.json(eventos)
  }),
]
