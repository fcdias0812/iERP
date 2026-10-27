import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import type { Db } from '../../db/database.js'
import { naoEncontrado } from '../../shared/erros.js'
import type { RepositorioClientes } from './clientes.repositorio.js'

/*
 * Link público para o cliente acompanhar os lotes (pedido do usuário, 22/10/2026 — o
 * "Rastreabilidade dos lotes" do iERP 1.0). Decisões dele: um link FIXO por cliente, com copiar,
 * gerar outro (o antigo para de funcionar) e desativar; página ENXUTA ("algo enxuto e de rápida
 * leitura. Nada grande") com situação, datas, recebimento (pallets, peso bruto, lacres) e o
 * andamento do processo; todos os lotes do cliente menos os cancelados (inclusive os que vêm do
 * Gerenciamento e do MSDC); 3 idiomas.
 *
 * O link é o próprio acesso (quem tem o link vê): 48 hex aleatórios (192 bits), nada no endereço
 * identifica a empresa; código inválido ou desativado = 404 igual, sem consultar mais nada.
 *
 *   POST   /api/clientes/:id/rastreio     gera (ou troca) o link → cliente
 *   DELETE /api/clientes/:id/rastreio     desativa → cliente
 *   GET    /api/publico/rastreio/:token   a página pública (SEM login — manter fora do login)
 */

export interface LotePublico {
  codigo: string
  /** O número que o próprio cliente deu (PO, lote dele). */
  referenciaCliente: string | null
  status: string
  coletaPrevista: string | null
  dataColeta: string | null
  recebidoEm: string | null
  pallets: number | null
  /** Peso BRUTO da chegada (o que a balança deu; a tara pode faltar). */
  pesoBrutoKg: number | null
  lacres: string[]
  /** Andamento no sistema que processa (MoonShot): "2/4 · Leitura das peças". */
  processamento: { etapa: string | null; indice: number | null; total: number | null } | null
  /** Quando o lote entrou em cada etapa (agendado, inspecao, processo, aguardando_cod, concluido). */
  etapas: { etapa: string; em: string }[]
}

export interface RastreioPublico {
  cliente: string
  geradoEm: string
  lotes: LotePublico[]
}

const TOKEN = /^[0-9a-f]{48}$/
const LIMITE = 500
const novoToken = () => randomBytes(24).toString('hex')

export function criarServicoRastreio(db: Db, repo: RepositorioClientes) {
  /** Gera o link (ou troca: o antigo para de funcionar). */
  async function gerar(id: string, autor: string) {
    await repo.transacao(async (trx) => {
      const c = await trx
        .selectFrom('clientes')
        .select('rastreioToken')
        .where('id', '=', id)
        .executeTakeFirst()
      if (!c) throw naoEncontrado('Cliente não encontrado.')
      const agora = new Date().toISOString()
      await trx
        .updateTable('clientes')
        .set({ rastreioToken: novoToken(), alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', id)
        .execute()
      // O código não vai para o histórico (o histórico não é o lugar do link).
      await repo.registrarHistorico(trx, id, {
        autor,
        em: agora,
        acao: c.rastreioToken ? 'rastreio_trocado' : 'rastreio_gerado',
      })
    })
    return (await repo.obter(id))!
  }

  async function desativar(id: string, autor: string) {
    await repo.transacao(async (trx) => {
      const c = await trx
        .selectFrom('clientes')
        .select('rastreioToken')
        .where('id', '=', id)
        .executeTakeFirst()
      if (!c) throw naoEncontrado('Cliente não encontrado.')
      if (!c.rastreioToken) return
      const agora = new Date().toISOString()
      await trx
        .updateTable('clientes')
        .set({ rastreioToken: null, alteradoEm: agora, alteradoPor: autor })
        .where('id', '=', id)
        .execute()
      await repo.registrarHistorico(trx, id, { autor, em: agora, acao: 'rastreio_desativado' })
    })
    return (await repo.obter(id))!
  }

  /** A página pública: null = link inválido ou desativado. */
  async function publico(token: string): Promise<RastreioPublico | null> {
    if (!TOKEN.test(token)) return null
    const cliente = await db
      .selectFrom('clientes')
      .select(['id', 'nome'])
      .where('rastreioToken', '=', token)
      .executeTakeFirst()
    if (!cliente) return null

    const ordens = await db
      .selectFrom('ordens')
      .select([
        'id',
        'codigo',
        'referenciaCliente',
        'status',
        'coletaPrevista',
        'dataColeta',
        'recebidoEm',
        'processamentoEtapa',
        'processamentoIndice',
        'processamentoTotal',
      ])
      .where('clienteId', '=', cliente.id)
      .where('status', '<>', 'cancelado')
      // A mesma coleta é um lote só para o cliente também (22/10/2026).
      .where('juntadoA', 'is', null)
      .execute()
    // Mais recentes primeiro, pela data da coleta (a confirmada ou a prevista).
    const coleta = (o: { dataColeta: string | null; coletaPrevista: string | null }) =>
      o.dataColeta ?? o.coletaPrevista ?? ''
    const lista = ordens.sort((a, b) => coleta(b).localeCompare(coleta(a))).slice(0, LIMITE)
    const ids = lista.map((o) => o.id)

    const [pallets, lacres, etapas] = ids.length
      ? await Promise.all([
          db
            .selectFrom('ordensPallets')
            .select(['ordemId', 'pesoKg'])
            .where('ordemId', 'in', ids)
            .where('origem', '=', 'iERP')
            .execute(),
          db
            .selectFrom('ordensLacres')
            .select(['ordemId', 'numero'])
            .where('ordemId', 'in', ids)
            .orderBy('posicao')
            .execute(),
          db
            .selectFrom('ordensEtapas')
            .select(['ordemId', 'etapa', 'em'])
            .where('ordemId', 'in', ids)
            .orderBy('em')
            .execute(),
        ])
      : [[], [], []]

    const porLote = <T extends { ordemId: string }>(l: T[]) => {
      const m = new Map<string, T[]>()
      for (const x of l) m.set(x.ordemId, [...(m.get(x.ordemId) ?? []), x])
      return m
    }
    const palletsDe = porLote(pallets)
    const lacresDe = porLote(lacres)
    const etapasDe = porLote(etapas)

    return {
      cliente: cliente.nome,
      geradoEm: new Date().toISOString(),
      lotes: lista.map((o) => {
        const ps = palletsDe.get(o.id) ?? []
        const bruto = ps.reduce((a, p) => a + (p.pesoKg ?? 0), 0)
        // Uma data por etapa (a primeira vez que o lote entrou nela).
        const vistas = new Map<string, string>()
        for (const e of etapasDe.get(o.id) ?? [])
          if (!vistas.has(e.etapa)) vistas.set(e.etapa, e.em)
        return {
          codigo: o.codigo,
          referenciaCliente: o.referenciaCliente,
          status: o.status,
          coletaPrevista: o.coletaPrevista,
          dataColeta: o.dataColeta,
          recebidoEm: o.recebidoEm,
          pallets: ps.length || null,
          pesoBrutoKg: ps.length ? Math.round(bruto * 100) / 100 : null,
          lacres: (lacresDe.get(o.id) ?? []).map((l) => l.numero),
          processamento:
            o.status === 'processo' && o.processamentoEtapa
              ? {
                  etapa: o.processamentoEtapa,
                  indice: o.processamentoIndice,
                  total: o.processamentoTotal,
                }
              : null,
          etapas: [...vistas].map(([etapa, em]) => ({ etapa, em })),
        }
      }),
    }
  }

  return { gerar, desativar, publico }
}

export type ServicoRastreio = ReturnType<typeof criarServicoRastreio>

/** A página pública (montada em /api/publico/rastreio — fora de qualquer login). */
export function rotasRastreioPublico(servico: ServicoRastreio) {
  const r = Router()
  r.get('/:token', async (req, res) => {
    // Link é acesso: não guardar em cache, não indexar, não vazar no Referer.
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const dados = await servico.publico(String(req.params.token).trim().toLowerCase())
    if (!dados) throw naoEncontrado('Página não encontrada.')
    res.json(dados)
  })
  return r
}
