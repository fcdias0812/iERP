import { http, HttpResponse } from 'msw/http'
import type { LocalizedText } from '@/lib/localized-text'
import type {
  AreaEstoque,
  AreaEstoqueInput,
  EventoHistorico,
  Material,
  MaterialInput,
  Recipiente,
  RecipienteInput,
  StatusCadastro,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'

/*
 * API SIMULADA de Sistema › Cadastros (mesmo contrato de server/src/modules/cadastros): uma
 * amostra dos materiais (o servidor tem a lista inicial completa), duas áreas e um caixote.
 */

const autor = () => useSessionStore.getState().user.name
const agora = () => new Date().toISOString()
let seq = 0
const novoId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

const texto = (pt: string, en: string, zh: string): LocalizedText => ({
  origem: 'pt-BR',
  textos: { 'pt-BR': pt, en, 'zh-TW': zh },
  automaticos: ['en', 'zh-TW'],
})
const controle = (id: string) => ({
  id,
  status: 'ativo' as StatusCadastro,
  criadoEm: '2026-10-01T12:00:00.000Z',
  criadoPor: 'Sistema',
  alteradoEm: '2026-10-01T12:00:00.000Z',
  alteradoPor: 'Sistema',
})

interface Banco {
  materiais: Material[]
  areas: AreaEstoque[]
  recipientes: Recipiente[]
  historico: Record<string, EventoHistorico[]>
}
let banco: Banco | null = null

/** Materiais, áreas e recipientes simulados (usado também pela busca global simulada). */
export const cadastrosMock = () => db()

function db(): Banco {
  banco ??= {
    materiais: [
      { ...controle('mat00001'), nome: texto('Alumínio', 'Aluminum', '鋁'), recipientes: 0 },
      { ...controle('mat00002'), nome: texto('Cobre', 'Copper', '銅'), recipientes: 1 },
      {
        ...controle('mat00003'),
        nome: texto('Eletrônicos diversos', 'Miscellaneous electronics', '其他電子產品'),
        recipientes: 0,
      },
      {
        ...controle('mat00004'),
        nome: texto('Placas-mãe (inteiras)', 'Motherboards (whole)', '主機板（完整）'),
        recipientes: 0,
      },
      { ...controle('mat00005'), nome: texto('Vidro', 'Glass', '玻璃'), recipientes: 0 },
    ],
    areas: [
      { ...controle('are00001'), nome: 'DELL', descricao: null, recipientes: 1 },
      {
        ...controle('are00002'),
        nome: 'SHREDDING',
        descricao: texto('Área de trituração.', 'Shredding area.', '粉碎區。'),
        recipientes: 0,
      },
    ],
    recipientes: [
      {
        ...controle('rec00001'),
        tipo: 'caixote',
        codigo: 'CXT-20260001',
        materialId: 'mat00002',
        materialNome: texto('Cobre', 'Copper', '銅'),
        areaId: 'are00001',
        areaNome: 'DELL',
        posicao: 'A-01',
        taraKg: 13,
      },
    ],
    historico: {},
  }
  return banco
}

/** Recalcula quantos recipientes usam cada material e cada área. */
function contar() {
  const d = db()
  for (const m of d.materiais)
    m.recipientes = d.recipientes.filter((r) => r.materialId === m.id).length
  for (const a of d.areas) a.recipientes = d.recipientes.filter((r) => r.areaId === a.id).length
}

const detalhe = <T extends { id: string; status: StatusCadastro }>(item: T) => ({
  ...item,
  historico: db().historico[item.id] ?? [],
  acoesPermitidas: item.status === 'ativo' ? ['inativar'] : ['reativar'],
})

function evento(id: string, acao: EventoHistorico['acao'], mudancas?: EventoHistorico['mudancas']) {
  const d = db()
  d.historico[id] = [
    { id: novoId('h'), autor: autor(), em: agora(), acao, mudancas },
    ...(d.historico[id] ?? []),
  ]
}

const sem = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** Rotas de um cadastro simulado (lista, detalhe, criar, editar, inativar/reativar). */
function rotas<
  T extends { id: string; status: StatusCadastro; alteradoEm: string; alteradoPor: string },
  I,
>(
  caminho: string,
  lista: () => T[],
  criar: (i: I) => T | Response,
  editar: (atual: T, i: I) => T | Response,
  filtro?: (item: T, url: URL) => boolean,
) {
  return [
    http.get(`*/api/${caminho}`, async ({ request }) => {
      const fail = await simulateNetwork(request)
      if (fail) return fail
      const url = new URL(request.url)
      contar()
      return HttpResponse.json(lista().filter((x) => !filtro || filtro(x, url)))
    }),
    http.get(`*/api/${caminho}/:id`, async ({ request, params }) => {
      const fail = await simulateNetwork(request)
      if (fail) return fail
      contar()
      const item = lista().find((x) => x.id === params.id)
      return item ? HttpResponse.json(detalhe(item)) : apiError(404, 'not_found', 'Não encontrado.')
    }),
    http.post(`*/api/${caminho}`, async ({ request }) => {
      const fail = await simulateNetwork(request)
      if (fail) return fail
      const r = criar((await request.json()) as I)
      if (r instanceof Response) return r
      lista().push(r)
      evento(r.id, 'criado')
      contar()
      return HttpResponse.json(detalhe(r), { status: 201 })
    }),
    http.put(`*/api/${caminho}/:id`, async ({ request, params }) => {
      const fail = await simulateNetwork(request)
      if (fail) return fail
      const atual = lista().find((x) => x.id === params.id)
      if (!atual) return apiError(404, 'not_found', 'Não encontrado.')
      const r = editar(atual, (await request.json()) as I)
      if (r instanceof Response) return r
      Object.assign(atual, r, { alteradoEm: agora(), alteradoPor: autor() })
      evento(atual.id, 'editado')
      return HttpResponse.json(detalhe(atual))
    }),
    http.post(`*/api/${caminho}/:id/transicao`, async ({ request, params }) => {
      const fail = await simulateNetwork(request)
      if (fail) return fail
      const atual = lista().find((x) => x.id === params.id)
      if (!atual) return apiError(404, 'not_found', 'Não encontrado.')
      const { acao } = (await request.json()) as { acao: string }
      const antes = atual.status
      atual.status = acao === 'inativar' ? 'inativo' : 'ativo'
      evento(atual.id, 'status', [{ campo: 'status', antes, depois: atual.status }])
      return HttpResponse.json(detalhe(atual))
    }),
  ]
}

const nomeLivre = (nome: string, exceto: string | null, todos: string[][]) =>
  !todos.some(([id, n]) => id !== exceto && sem(n!) === sem(nome))

export const cadastrosHandlers = [
  ...rotas<Material, MaterialInput>(
    'materiais',
    () => db().materiais,
    (i) => {
      const nome = i.nome.textos[i.nome.origem] ?? ''
      if (
        !nomeLivre(
          nome,
          null,
          db().materiais.map((m) => [m.id, m.nome.textos['pt-BR'] ?? '']),
        )
      )
        return apiError(409, 'name_in_use', 'Já existe um material com este nome.')
      return {
        ...controle(novoId('mat')),
        nome: i.nome,
        recipientes: 0,
        criadoEm: agora(),
        criadoPor: autor(),
      }
    },
    (atual, i) => ({ ...atual, nome: i.nome }),
  ),
  ...rotas<AreaEstoque, AreaEstoqueInput>(
    'areas',
    () => db().areas,
    (i) => {
      if (
        !nomeLivre(
          i.nome,
          null,
          db().areas.map((a) => [a.id, a.nome]),
        )
      )
        return apiError(409, 'name_in_use', 'Já existe uma área com este nome.')
      return {
        ...controle(novoId('are')),
        nome: i.nome,
        descricao: i.descricao,
        recipientes: 0,
        criadoEm: agora(),
        criadoPor: autor(),
      }
    },
    (atual, i) => ({ ...atual, nome: i.nome, descricao: i.descricao }),
  ),
  ...rotas<Recipiente, RecipienteInput>(
    'recipientes',
    () => db().recipientes,
    (i) => {
      const d = db()
      const m = d.materiais.find((x) => x.id === i.materialId && x.status === 'ativo')
      const a = d.areas.find((x) => x.id === i.areaId && x.status === 'ativo')
      if (!m || !a) return apiError(422, 'validation', 'Escolha material e área ativos.')
      const prefixo = i.tipo === 'caixote' ? 'CXT' : 'PLT'
      const ano = new Date().getFullYear()
      const numero =
        d.recipientes.filter((r) => r.tipo === i.tipo && r.codigo.startsWith(`${prefixo}-${ano}`))
          .length + 1
      return {
        ...controle(novoId('rec')),
        tipo: i.tipo,
        codigo: `${prefixo}-${ano}${String(numero).padStart(4, '0')}`,
        materialId: m.id,
        materialNome: m.nome,
        areaId: a.id,
        areaNome: a.nome,
        posicao: i.posicao,
        taraKg: i.taraKg,
        criadoEm: agora(),
        criadoPor: autor(),
      }
    },
    (atual, i) => {
      const d = db()
      const m = d.materiais.find((x) => x.id === i.materialId)
      const a = d.areas.find((x) => x.id === i.areaId)
      if (!m || !a) return apiError(422, 'validation', 'Escolha material e área.')
      return {
        ...atual,
        materialId: m.id,
        materialNome: m.nome,
        areaId: a.id,
        areaNome: a.nome,
        posicao: i.posicao,
        taraKg: i.taraKg,
      }
    },
    (r, url) => !url.searchParams.get('tipo') || r.tipo === url.searchParams.get('tipo'),
  ),
]
