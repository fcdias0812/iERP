import { http, HttpResponse } from 'msw/http'
import type {
  EventoHistorico,
  Integracao,
  IntegracaoDetalhe,
  IntegracaoInput,
} from '@/services/types'
import { useSessionStore } from '@/stores/session-store'
import { apiError, simulateNetwork } from '../config'

/*
 * API SIMULADA de Administração › Integração (mesmo contrato de
 * server/src/modules/integracao/integracao.ts). Começa com o MoonShot cadastrado, sem chave, e o
 * Gerenciamento de Projetos (de onde os lotes vêm) com uma coleta esperando o cliente Nokia.
 */

const autor = () => useSessionStore.getState().user.name
const agora = () => new Date().toISOString()
let seq = 0
const novoId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

interface Registro extends Integracao {
  historico: EventoHistorico[]
}
let banco: Registro[] | null = null

function db(): Registro[] {
  banco ??= [
    {
      id: 'int00001',
      sistema: 'MOONSHOT',
      tipo: 'processamento',
      nome: 'MoonShot (Dell)',
      chavePrefixo: null,
      chaveCriadaEm: null,
      urlAvisos: 'http://localhost:5063/api/ierp2/avisos',
      urlPainel: 'http://localhost:5063/api/ierp2/painel',
      caPainel: null,
      temTokenPainel: false,
      temChaveTransito: false,
      status: 'ativo',
      ultimoUsoEm: null,
      ultimoAvisoEm: null,
      ultimoPainelEm: null,
      ultimoErro: null,
      ultimoErroEm: null,
      avisosPendentes: 0,
      sincronizacao: null,
      criadoEm: '2026-10-19T12:00:00.000Z',
      criadoPor: 'Sistema',
      alteradoEm: '2026-10-19T12:00:00.000Z',
      alteradoPor: 'Sistema',
      historico: [],
    },
    {
      id: 'int00002',
      sistema: 'GERENCIAMENTO',
      tipo: 'origem',
      nome: 'Gerenciamento de Projetos',
      chavePrefixo: null,
      chaveCriadaEm: null,
      urlAvisos: null,
      urlPainel: 'http://localhost:5005/api/integracao/painel',
      caPainel: null,
      temTokenPainel: true,
      temChaveTransito: false,
      status: 'ativo',
      ultimoUsoEm: null,
      ultimoAvisoEm: null,
      ultimoPainelEm: '2026-10-20T12:00:00.000Z',
      ultimoErro: null,
      ultimoErroEm: null,
      avisosPendentes: 0,
      sincronizacao: {
        em: '2026-10-20T12:00:00.000Z',
        coletas: 12,
        ligadas: 9,
        criados: 0,
        pendencias: [{ cliente: 'Nokia', coletas: 3, motivo: 'sem_cliente' }],
        falhas: [],
        sumidos: [],
        cargaCompletaEm: '2026-10-20T12:00:00.000Z',
      },
      criadoEm: '2026-10-20T11:00:00.000Z',
      criadoPor: 'Sistema',
      alteradoEm: '2026-10-20T11:00:00.000Z',
      alteradoPor: 'Sistema',
      historico: [],
    },
  ]
  return banco
}

const resumo = (r: Registro): Integracao => {
  const i: Partial<Registro> = { ...r }
  delete i.historico
  return i as Integracao
}
const detalhe = (r: Registro): IntegracaoDetalhe => ({
  ...r,
  avisos: [],
  acoesPermitidas: r.status === 'ativo' ? ['inativar'] : ['reativar'],
})
const evento = (r: Registro, e: Omit<EventoHistorico, 'id' | 'autor' | 'em'>) => {
  r.historico = [{ id: novoId('h'), autor: autor(), em: agora(), ...e }, ...r.historico]
}

export const integracoesHandlers = [
  http.get('*/api/integracoes/sistemas', () =>
    HttpResponse.json([
      { sistema: 'MOONSHOT', nome: 'MoonShot (Dell)', tipo: 'processamento' },
      { sistema: 'GERENCIAMENTO', nome: 'Gerenciamento de Projetos', tipo: 'origem' },
      { sistema: 'MSDC', nome: 'Re-Teck MSDC (Microsoft)', tipo: 'origem' },
      { sistema: 'RASTREADOR', nome: 'Rastreador de GPS (ReTeckTracker)', tipo: 'rastreio' },
    ]),
  ),
  http.get('*/api/integracoes', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    return HttpResponse.json(db().map(resumo))
  }),
  http.get('*/api/integracoes/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const r = db().find((x) => x.id === params.id)
    return r
      ? HttpResponse.json(detalhe(r))
      : apiError(404, 'not_found', 'Integração não encontrada.')
  }),
  http.post('*/api/integracoes', async ({ request }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const i = (await request.json()) as IntegracaoInput
    if (db().some((x) => x.sistema === i.sistema))
      return apiError(409, 'system_in_use', 'Este sistema já está cadastrado.')
    const r: Registro = {
      ...db()[0]!,
      id: novoId('int'),
      sistema: i.sistema ?? '',
      tipo:
        i.sistema === 'GERENCIAMENTO' || i.sistema === 'MSDC'
          ? 'origem'
          : i.sistema === 'RASTREADOR'
            ? 'rastreio'
            : 'processamento',
      caPainel: i.caPainel || null,
      sincronizacao: null,
      nome: i.nome,
      urlAvisos: i.urlAvisos,
      urlPainel: i.urlPainel,
      temTokenPainel: Boolean(i.tokenPainel),
      temChaveTransito: Boolean(i.chaveTransito),
      chavePrefixo: null,
      chaveCriadaEm: null,
      historico: [],
    }
    evento(r, { acao: 'criado' })
    db().push(r)
    return HttpResponse.json(detalhe(r), { status: 201 })
  }),
  http.put('*/api/integracoes/:id', async ({ request, params }) => {
    const fail = await simulateNetwork(request)
    if (fail) return fail
    const r = db().find((x) => x.id === params.id)
    if (!r) return apiError(404, 'not_found', 'Integração não encontrada.')
    const i = (await request.json()) as IntegracaoInput
    Object.assign(r, {
      nome: i.nome,
      urlAvisos: i.urlAvisos,
      urlPainel: i.urlPainel,
      temTokenPainel: i.tokenPainel === undefined ? r.temTokenPainel : Boolean(i.tokenPainel),
      temChaveTransito:
        i.chaveTransito === undefined ? r.temChaveTransito : Boolean(i.chaveTransito),
      alteradoEm: agora(),
      alteradoPor: autor(),
    })
    evento(r, { acao: 'editado' })
    return HttpResponse.json(detalhe(r))
  }),
  http.post('*/api/integracoes/:id/chave', async ({ params }) => {
    const r = db().find((x) => x.id === params.id)
    if (!r) return apiError(404, 'not_found', 'Integração não encontrada.')
    const chave = `rtk_${crypto.randomUUID().replace(/-/g, '')}`
    evento(r, { acao: r.chavePrefixo ? 'chave_trocada' : 'chave_gerada' })
    Object.assign(r, { chavePrefixo: chave.slice(0, 8), chaveCriadaEm: agora() })
    return HttpResponse.json({ chave, integracao: detalhe(r) })
  }),
  http.delete('*/api/integracoes/:id/chave', async ({ params }) => {
    const r = db().find((x) => x.id === params.id)
    if (!r) return apiError(404, 'not_found', 'Integração não encontrada.')
    evento(r, { acao: 'chave_revogada' })
    Object.assign(r, { chavePrefixo: null, chaveCriadaEm: null })
    return HttpResponse.json(detalhe(r))
  }),
  http.post('*/api/integracoes/:id/transicao', async ({ request, params }) => {
    const r = db().find((x) => x.id === params.id)
    if (!r) return apiError(404, 'not_found', 'Integração não encontrada.')
    const { acao } = (await request.json()) as { acao: string }
    const antes = r.status
    r.status = acao === 'inativar' ? 'inativo' : 'ativo'
    evento(r, { acao: 'status', mudancas: [{ campo: 'status', antes, depois: r.status }] })
    return HttpResponse.json(detalhe(r))
  }),
]
