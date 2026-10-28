import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'

/*
 * Administração › Auditoria (pedido do usuário, 19/10/2026): o histórico completo de tudo o que
 * acontece no sistema — junta os históricos de todos os registros (usuários, clientes,
 * transportadoras, motoristas, veículos, lotes, materiais, áreas, recipientes e perfis), cada
 * evento com o tipo e o nome/código do registro.
 *
 *   GET /api/auditoria?desde=<ISO>   eventos (mais recente primeiro)
 */

export const TIPOS_REGISTRO = [
  'usuario',
  'perfil',
  'cliente',
  'transportadora',
  'motorista',
  'veiculo',
  'ordem',
  'material',
  'area',
  'recipiente',
  'integracao',
] as const
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number]

export interface EventoAuditoria extends EventoHistorico {
  tipo: TipoRegistro
  registroId: string
  /** Código ou nome do registro (como está hoje). */
  registroRotulo: string
  /** Caixote ou pallet (recipientes). */
  registroSubtipo: string | null
  /** O registro foi excluído (lote — 27/10/2026): a tela mostra o rótulo sem link. */
  registroExcluido: boolean
}

const consultaSchema = z.object({ desde: z.iso.datetime({ offset: true }).optional() })

interface Rotulo {
  rotulo: string
  subtipo: string | null
  excluido: boolean
}

interface Linha {
  id: string
  autor: string
  em: string
  acao: string
  mudancas: string | null
  nota: string | null
}

export function criarServicoAuditoria(db: Db) {
  /** Rótulo (código ou nome) e subtipo de cada registro, por tipo. */
  async function rotulos(): Promise<Map<string, Rotulo>> {
    const mapa = new Map<string, Rotulo>()
    const por = (
      tipo: TipoRegistro,
      linhas: { id: string; rotulo: string; subtipo?: string }[],
      excluido = false,
    ) =>
      linhas.forEach((l) =>
        mapa.set(`${tipo}:${l.id}`, { rotulo: l.rotulo, subtipo: l.subtipo ?? null, excluido }),
      )
    const [
      usuarios,
      perfis,
      clientes,
      transp,
      motor,
      veic,
      ordens,
      excluidas,
      mat,
      areas,
      recip,
      integ,
    ] = await Promise.all([
      db.selectFrom('usuarios').select(['id', 'nome as rotulo']).execute(),
      db.selectFrom('perfisAcesso').select(['id', 'nomeOrdem as rotulo']).execute(),
      db.selectFrom('clientes').select(['id', 'nome as rotulo']).execute(),
      db.selectFrom('transportadoras').select(['id', 'nome as rotulo']).execute(),
      db.selectFrom('motoristas').select(['id', 'nome as rotulo']).execute(),
      db.selectFrom('veiculos').select(['id', 'codigo as rotulo']).execute(),
      db.selectFrom('ordens').select(['id', 'codigo as rotulo']).execute(),
      db.selectFrom('ordensExcluidas').select(['id', 'codigo as rotulo']).execute(),
      db.selectFrom('materiais').select(['id', 'nomeOrdem as rotulo']).execute(),
      db.selectFrom('areasEstoque').select(['id', 'nome as rotulo']).execute(),
      db.selectFrom('recipientes').select(['id', 'codigo as rotulo', 'tipo as subtipo']).execute(),
      db.selectFrom('integracoes').select(['id', 'nome as rotulo']).execute(),
    ])
    por('usuario', usuarios)
    por('perfil', perfis)
    por('cliente', clientes)
    por('transportadora', transp)
    por('motorista', motor)
    por('veiculo', veic)
    por('ordem', ordens)
    por('ordem', excluidas, true)
    por('material', mat)
    por('area', areas)
    por('recipiente', recip)
    por('integracao', integ)
    return mapa
  }

  return {
    async listar(entrada: unknown): Promise<EventoAuditoria[]> {
      const { desde } = consultaSchema.parse(entrada)
      const inicio = desde ? new Date(desde).toISOString() : null
      let usuarios = db
        .selectFrom('usuariosHistorico')
        .select(['id', 'autor', 'em', 'acao', 'mudancas', 'nota', 'usuarioId as registroId'])
      let clientes = db
        .selectFrom('clientesHistorico')
        .select(['id', 'autor', 'em', 'acao', 'mudancas', 'nota', 'clienteId as registroId'])
      let geral = db
        .selectFrom('historico')
        .select(['id', 'autor', 'em', 'acao', 'mudancas', 'nota', 'registroId', 'entidade'])
      if (inicio) {
        usuarios = usuarios.where('em', '>=', inicio)
        clientes = clientes.where('em', '>=', inicio)
        geral = geral.where('em', '>=', inicio)
      }
      const [u, c, g, nomes] = await Promise.all([
        usuarios.execute(),
        clientes.execute(),
        geral.execute(),
        rotulos(),
      ])
      const evento = (l: Linha, tipo: TipoRegistro, registroId: string): EventoAuditoria => {
        const r = nomes.get(`${tipo}:${registroId}`)
        return {
          id: `${tipo}-${l.id}`,
          autor: l.autor,
          em: l.em,
          acao: l.acao as EventoHistorico['acao'],
          ...(l.mudancas ? { mudancas: JSON.parse(l.mudancas) as Mudanca[] } : {}),
          ...(l.nota ? { nota: l.nota } : {}),
          tipo,
          registroId,
          registroRotulo: r?.rotulo ?? registroId,
          registroSubtipo: r?.subtipo ?? null,
          registroExcluido: r?.excluido ?? false,
        }
      }
      const eventos = [
        ...u.map((l) => evento(l, 'usuario', l.registroId)),
        ...c.map((l) => evento(l, 'cliente', l.registroId)),
        ...g
          .filter((l) => (TIPOS_REGISTRO as readonly string[]).includes(l.entidade))
          .map((l) => evento(l, l.entidade as TipoRegistro, l.registroId)),
      ]
      return eventos.sort((a, b) => b.em.localeCompare(a.em) || b.id.localeCompare(a.id))
    },
  }
}

export function rotasAuditoria(servico: ReturnType<typeof criarServicoAuditoria>) {
  const r = Router()
  r.get('/', async (req, res) => {
    res.json(await servico.listar({ desde: req.query.desde }))
  })
  return r
}
