import { passthrough } from 'msw'
import { http, HttpResponse } from 'msw/http'
import type { LocalizedText } from '@/lib/localized-text'
import type { ResultadoBusca } from '@/services/types'
import { simulateNetwork } from '../config'
import { getDb } from '../db'
import { cadastrosMock } from './cadastros'
import { ordensMock } from './ordens'
import { perfisMock } from './perfis'
import { getRelacionamento } from './relacionamento'

/** Busca global (Ctrl+K) e notificações. */

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
const contem = (texto: string, q: string) => norm(texto).includes(norm(q))

export const sistemaHandlers = [
  // Versão nova publicada (28/10/2026): com `sessionStorage['ierp-mock-build']`, o "servidor"
  // responde outro build (os e2e ligam); sem isso, o version.json de verdade do site.
  http.get('*/version.json', () => {
    let outro: string | null = null
    try {
      outro = globalThis.sessionStorage?.getItem('ierp-mock-build') ?? null
    } catch {
      outro = null
    }
    return outro ? HttpResponse.json({ build: outro }) : passthrough()
  }),
  http.get('*/api/busca', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
    if (q.length < 2) return HttpResponse.json([])
    const db = getDb()
    const rel = getRelacionamento()
    const cad = cadastrosMock()
    const nomes = (t: LocalizedText) => Object.values(t.textos).join(' ')
    const recipientes = (tipo: 'caixote' | 'pallet') =>
      cad.recipientes
        .filter((r) => r.tipo === tipo && (contem(r.codigo, q) || contem(r.posicao, q)))
        .slice(0, 5)
        .map((r) => ({
          tipo,
          id: r.id,
          codigo: r.codigo,
          titulo: r.materialNome.textos['pt-BR'] ?? '',
          tituloTraduzido: r.materialNome,
          detalhe: r.posicao,
        }))
    const out: ResultadoBusca[] = [
      ...db.clientes
        .filter((c) => contem(c.nome, q) || contem(c.codigo, q) || c.cnpj.includes(q.toUpperCase()))
        .slice(0, 5)
        .map((c) => ({ tipo: 'cliente' as const, id: c.id, codigo: c.codigo, titulo: c.nome })),
      ...Object.entries(db.sites)
        .flatMap(([clienteId, sites]) => sites.map((s) => ({ clienteId, s })))
        .filter(({ s }) => contem(s.codigo, q) || contem(s.endereco ?? '', q))
        .slice(0, 5)
        .map(({ clienteId, s }) => ({
          tipo: 'site' as const,
          id: s.id,
          codigo: s.codigo,
          titulo: db.clientes.find((c) => c.id === clienteId)?.nome ?? '',
          detalhe: s.endereco?.match(/,\s*([^,]+?)\s*[–-]\s*[A-Z]{2}$/)?.[1] ?? null,
          paiId: clienteId,
        })),
      ...ordensMock()
        .filter(
          (o) =>
            contem(o.codigo, q) || contem(o.referenciaCliente ?? '', q) || contem(o.clienteNome, q),
        )
        .slice(0, 5)
        .map((o) => ({
          tipo: 'lote' as const,
          id: o.id,
          codigo: o.codigo,
          titulo: o.clienteNome,
          detalhe: o.siteCodigo,
        })),
      ...recipientes('caixote'),
      ...recipientes('pallet'),
      ...rel.transportadoras
        .filter((t) => contem(t.nome, q) || contem(t.codigo, q) || t.cnpj.includes(q.toUpperCase()))
        .slice(0, 5)
        .map((t) => ({
          tipo: 'transportadora' as const,
          id: t.id,
          codigo: t.codigo,
          titulo: t.nome,
        })),
      ...rel.motoristas
        .filter(
          (m) =>
            contem(m.nome, q) || contem(m.codigo, q) || m.cpf.includes(q.replace(/\D/g, '') || '-'),
        )
        .slice(0, 5)
        .map((m) => ({ tipo: 'motorista' as const, id: m.id, codigo: m.codigo, titulo: m.nome })),
      ...rel.veiculos
        .filter((v) => contem(v.codigo, q) || contem(v.tipo, q))
        .slice(0, 5)
        .map((v) => ({ tipo: 'veiculo' as const, id: v.id, codigo: v.codigo, titulo: v.tipo })),
      ...cad.materiais
        .filter((m) => contem(nomes(m.nome), q))
        .slice(0, 5)
        .map((m) => ({
          tipo: 'material' as const,
          id: m.id,
          codigo: '',
          titulo: m.nome.textos['pt-BR'] ?? '',
          tituloTraduzido: m.nome,
        })),
      ...cad.areas
        .filter((a) => contem(a.nome, q))
        .slice(0, 5)
        .map((a) => ({ tipo: 'area' as const, id: a.id, codigo: '', titulo: a.nome })),
      ...db.usuarios
        .filter((u) => contem(u.nome, q) || contem(u.email, q) || contem(u.codigo, q))
        .slice(0, 5)
        .map((u) => ({ tipo: 'usuario' as const, id: u.id, codigo: u.codigo, titulo: u.nome })),
      ...perfisMock()
        .filter((p) => contem(nomes(p.nome), q))
        .slice(0, 5)
        .map((p) => ({
          tipo: 'perfil' as const,
          id: p.id,
          codigo: '',
          titulo: p.nome.textos['pt-BR'] ?? '',
          tituloTraduzido: p.nome,
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
