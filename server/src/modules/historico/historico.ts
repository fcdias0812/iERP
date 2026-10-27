import { Router } from 'express'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { EventoHistorico, Mudanca } from '../../shared/historico.js'

/*
 * Histórico do MÓDULO (Ordens › Histórico e Operação › Histórico — pedido do usuário, 19/10/2026):
 * a mesma auditoria do histórico de cada registro, mas de todos os lotes, já filtrada pelo que
 * interessa a cada módulo (divisão aprovada por ele):
 *   - ordens:   lote criado (agendamento), edições do lote, documentos e ocorrências de coleta e
 *               trajeto e as viagens (iniciada, chegou, finalizada, cancelada, emergência);
 *   - operacao: lote criado, recebimento e correções, mudanças de etapa e ocorrências de
 *               recebimento (futuro: chamados internos).
 *
 *   GET /api/historico/:modulo?desde=<ISO>   eventos (mais recente primeiro) com o lote e o cliente
 */

export const MODULOS_HISTORICO = ['ordens', 'operacao'] as const
export type ModuloHistorico = (typeof MODULOS_HISTORICO)[number]

/** Evento do histórico do módulo: o evento + o registro a que pertence. */
export interface EventoHistoricoModulo extends EventoHistorico {
  /** Registro do evento (hoje sempre um lote). */
  registroId: string
  registroCodigo: string
  clienteNome: string
}

/** Ações de lote de cada módulo (as de ocorrência dependem do momento). */
const ACOES: Record<ModuloHistorico, string[]> = {
  ordens: [
    'criado',
    'editado',
    'documento_adicionado',
    'documento_removido',
    'viagem_adicionada',
    'juntado',
    'coleta_juntada',
    'separado',
    'viagem_iniciada',
    'viagem_chegou',
    'viagem_finalizada',
    'viagem_cancelada',
    'viagem_emergencia',
    'viagem_emergencia_ciente',
  ],
  operacao: [
    'criado',
    'recebido',
    'recebimento_editado',
    'status',
    'processamento',
    'devolucao_pedida',
    'devolucao_cancelada',
  ],
}
const ACOES_OCORRENCIA = ['ocorrencia_registrada', 'ocorrencia_editada', 'ocorrencia_cancelada']
const MOMENTOS: Record<ModuloHistorico, string[]> = {
  ordens: ['coleta', 'trajeto'],
  operacao: ['recebimento'],
}

const consultaSchema = z.object({
  modulo: z.enum(MODULOS_HISTORICO, { error: 'Módulo de histórico desconhecido.' }),
  desde: z.iso.datetime({ offset: true }).optional(),
})

export function criarServicoHistorico(db: Db) {
  return {
    async listar(entrada: unknown): Promise<EventoHistoricoModulo[]> {
      const { modulo, desde } = consultaSchema.parse(entrada)
      let q = db
        .selectFrom('historico as h')
        .innerJoin('ordens as o', 'o.id', 'h.registroId')
        .innerJoin('clientes as c', 'c.id', 'o.clienteId')
        .select([
          'h.id',
          'h.autor',
          'h.em',
          'h.acao',
          'h.mudancas',
          'h.nota',
          'h.registroId',
          'o.codigo as registroCodigo',
          'c.nome as clienteNome',
        ])
        .where('h.entidade', '=', 'ordem')
        .where('h.acao', 'in', [...ACOES[modulo], ...ACOES_OCORRENCIA])
      if (desde) q = q.where('h.em', '>=', new Date(desde).toISOString())
      const linhas = await q.orderBy('h.em', 'desc').orderBy('h.id', 'desc').execute()

      // Ocorrências: o momento (coleta, trajeto, recebimento) decide o módulo. A referência do
      // evento é "#n" (número da ocorrência no lote).
      const comOcorrencia = [
        ...new Set(
          linhas.filter((l) => ACOES_OCORRENCIA.includes(l.acao)).map((l) => l.registroId),
        ),
      ]
      const momentos = new Map<string, string>()
      if (comOcorrencia.length) {
        const ocs = await db
          .selectFrom('ordensOcorrencias')
          .select(['ordemId', 'numero', 'momento'])
          .where('ordemId', 'in', comOcorrencia)
          .execute()
        for (const oc of ocs) momentos.set(`${oc.ordemId}#${oc.numero}`, oc.momento)
      }

      return linhas
        .filter((l) => {
          if (!ACOES_OCORRENCIA.includes(l.acao)) return true
          const momento = momentos.get(`${l.registroId}${l.nota ?? ''}`)
          return momento !== undefined && MOMENTOS[modulo].includes(momento)
        })
        .map((l) => ({
          id: l.id,
          autor: l.autor,
          em: l.em,
          acao: l.acao as EventoHistorico['acao'],
          ...(l.mudancas ? { mudancas: JSON.parse(l.mudancas) as Mudanca[] } : {}),
          ...(l.nota ? { nota: l.nota } : {}),
          registroId: l.registroId,
          registroCodigo: l.registroCodigo,
          clienteNome: l.clienteNome,
        }))
    },
  }
}

export type ServicoHistorico = ReturnType<typeof criarServicoHistorico>

export function rotasHistorico(servico: ServicoHistorico) {
  const r = Router()
  r.get('/:modulo', async (req, res) => {
    res.json(await servico.listar({ modulo: req.params.modulo, desde: req.query.desde }))
  })
  return r
}
