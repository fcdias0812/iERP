import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { Transaction } from 'kysely'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { Database } from '../../db/schema.js'
import { autorDa } from '../../shared/autor.js'
import { ErroApi } from '../../shared/erros.js'
import { normalizar } from '../../shared/texto.js'
import { original, textoTraduzidoSchema, type LocalizedText } from '../ordens/ordens.lote.js'

/*
 * Tipos de documento do lote (22/10/2026). Uma lista ÚNICA para todos os clientes: os do sistema
 * (escopo, nota fiscal, MTR, CDF, foto, outro — o rótulo vem da tradução) e os criados na aba
 * Configurações do cliente (nome nos 3 idiomas). Cada cliente marca os que ACEITA nos documentos
 * do lote e os que VÃO NO RELATÓRIO FINAL (o ZIP só sai com eles no lote). O escopo é sempre
 * aceito (o agendamento usa).
 *
 *   GET  /api/tipos-documento        a lista
 *   POST /api/tipos-documento        { nome } — cria um tipo novo
 */

type Conexao = Db | Transaction<Database>

export interface TipoDocumento {
  codigo: string
  /** null = do sistema (o rótulo é traduzido na tela). */
  nome: LocalizedText | null
}

export interface TipoDoCliente extends TipoDocumento {
  aceita: boolean
  relatorio: boolean
}

export async function listarTipos(cx: Conexao): Promise<TipoDocumento[]> {
  const l = await cx.selectFrom('tiposDocumento').selectAll().orderBy('ordem').execute()
  return l.map((t) => ({
    codigo: t.codigo,
    nome: t.nome ? (JSON.parse(t.nome) as LocalizedText) : null,
  }))
}

/** Os tipos com o que o cliente marcou (sem marca: os do sistema aceitos, nenhum no relatório). */
export async function tiposDoCliente(cx: Conexao, clienteId: string): Promise<TipoDoCliente[]> {
  const [tipos, marcas] = await Promise.all([
    listarTipos(cx),
    cx
      .selectFrom('clientesTiposDocumento')
      .selectAll()
      .where('clienteId', '=', clienteId)
      .execute(),
  ])
  const por = new Map(marcas.map((m) => [m.tipoCodigo, m]))
  return tipos.map((t) => {
    const m = por.get(t.codigo)
    return {
      ...t,
      aceita: t.codigo === 'escopo' || (m ? m.aceita === 1 : t.nome === null),
      relatorio: m ? m.relatorio === 1 : false,
    }
  })
}

export const marcasSchema = z
  .array(
    z.object({
      tipo: z.string().min(1).max(60),
      aceita: z.boolean(),
      relatorio: z.boolean(),
    }),
  )
  .max(200)

/** Grava as marcas do cliente (o escopo fica sempre aceito; relatório só do que é aceito). */
export async function gravarMarcas(
  cx: Conexao,
  clienteId: string,
  marcas: z.output<typeof marcasSchema>,
) {
  const conhecidos = new Set((await listarTipos(cx)).map((t) => t.codigo))
  const desconhecido = marcas.find((m) => !conhecidos.has(m.tipo))
  if (desconhecido) throw new ErroApi(422, 'validation', 'Tipo de documento desconhecido.')
  await cx.deleteFrom('clientesTiposDocumento').where('clienteId', '=', clienteId).execute()
  if (marcas.length)
    await cx
      .insertInto('clientesTiposDocumento')
      .values(
        marcas.map((m) => {
          const aceita = m.tipo === 'escopo' || m.aceita
          return {
            clienteId,
            tipoCodigo: m.tipo,
            aceita: aceita ? 1 : 0,
            relatorio: aceita && m.relatorio ? 1 : 0,
          }
        }),
      )
      .execute()
}

const novoSchema = z.object({ nome: textoTraduzidoSchema })

export function rotasTiposDocumento(db: Db) {
  const r = Router()
  r.get('/', async (_req, res) => {
    res.json(await listarTipos(db))
  })
  r.post('/', async (req, res) => {
    const { nome } = novoSchema.parse(req.body)
    const texto = original(nome)
    if (!texto) throw new ErroApi(422, 'validation', 'Informe o nome do tipo.')
    if (texto.length > 60) throw new ErroApi(422, 'validation', 'Nome com até 60 caracteres.')
    const busca = normalizar(texto)
    const igual = await db
      .selectFrom('tiposDocumento')
      .select('codigo')
      .where('nomeBusca', '=', busca)
      .executeTakeFirst()
    if (igual) throw new ErroApi(409, 'name_in_use', 'Já existe um tipo com este nome.')
    const ultimo = await db
      .selectFrom('tiposDocumento')
      .select((eb) => eb.fn.max('ordem').as('n'))
      .executeTakeFirst()
    const codigo = `tp-${randomUUID().slice(0, 8)}`
    await db
      .insertInto('tiposDocumento')
      .values({
        codigo,
        nome: JSON.stringify(nome),
        nomeBusca: busca,
        ordem: Number(ultimo?.n ?? 0) + 1,
        criadoEm: new Date().toISOString(),
        criadoPor: autorDa(req),
      })
      .execute()
    res.status(201).json({ codigo, nome })
  })
  return r
}
