import { http, HttpResponse } from 'msw/http'
import type { ResultadoBusca } from '@/services/types'
import { simulateNetwork } from '../config'
import { getDb } from '../db'

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
    const out: ResultadoBusca[] = getDb()
      .usuarios.filter((u) => contem(u.nome, q) || contem(u.email, q) || contem(u.codigo, q))
      .slice(0, 8)
      .map((u) => ({
        tipo: 'usuario' as const,
        id: u.id,
        codigo: u.codigo,
        titulo: u.nome,
        rota: `/admin/usuarios/${u.id}`,
      }))
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
