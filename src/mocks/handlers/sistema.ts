import { http, HttpResponse } from 'msw/http'
import type { ResultadoBusca } from '@/services/types'
import { simulateNetwork } from '../config'
import { getDb } from '../db'
import { getRelacionamento } from './relacionamento'

/** Busca global (Ctrl+K) e notificações. */

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
const contem = (texto: string, q: string) => norm(texto).includes(norm(q))

export const sistemaHandlers = [
  http.get('*/api/busca', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
    if (q.length < 2) return HttpResponse.json([])
    const db = getDb()
    const out: ResultadoBusca[] = [
      ...db.clientes
        .filter((c) => contem(c.nome, q) || contem(c.codigo, q) || c.cnpj.includes(q.toUpperCase()))
        .slice(0, 5)
        .map((c) => ({
          tipo: 'cliente' as const,
          id: c.id,
          codigo: c.codigo,
          titulo: c.nome,
          rota: `/clientes/${c.id}`,
        })),
      ...getRelacionamento()
        .transportadoras.filter(
          (t) => contem(t.nome, q) || contem(t.codigo, q) || t.cnpj.includes(q.toUpperCase()),
        )
        .slice(0, 5)
        .map((t) => ({
          tipo: 'transportadora' as const,
          id: t.id,
          codigo: t.codigo,
          titulo: t.nome,
          rota: `/transportadoras/${t.id}`,
        })),
      ...getRelacionamento()
        .motoristas.filter(
          (m) =>
            contem(m.nome, q) || contem(m.codigo, q) || m.cpf.includes(q.replace(/\D/g, '') || '-'),
        )
        .slice(0, 5)
        .map((m) => ({
          tipo: 'motorista' as const,
          id: m.id,
          codigo: m.codigo,
          titulo: m.nome,
          rota: `/motoristas?aberto=${m.id}`,
        })),
      ...db.usuarios
        .filter((u) => contem(u.nome, q) || contem(u.email, q) || contem(u.codigo, q))
        .slice(0, 5)
        .map((u) => ({
          tipo: 'usuario' as const,
          id: u.id,
          codigo: u.codigo,
          titulo: u.nome,
          rota: `/admin/usuarios/${u.id}`,
        })),
    ]
    return HttpResponse.json(out)
  }),

  http.get('*/api/notificacoes', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    return HttpResponse.json(getDb().notificacoes)
  }),

  http.post('*/api/notificacoes/lidas', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const { ids } = (await request.json()) as { ids?: string[] }
    const db = getDb()
    db.notificacoes = db.notificacoes.map((n) =>
      !ids || ids.includes(n.id) ? { ...n, lida: true } : n,
    )
    return new HttpResponse(null, { status: 204 })
  }),
]
