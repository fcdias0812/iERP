import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { EstoqueItensTable } from '../../db/schema.js'
import type {
  AbaEstoque,
  MaquinaDeFora,
  MaterialDeFora,
  PosicaoEcommerce,
  SistemaEstoque,
  StatusDeFora,
} from './estoque.js'

/*
 * Estoque › Histórico (pedido do usuário, 20/10/2026: "igual as outras de histórico"). Os três
 * sistemas só mandam a lista de AGORA; o iERP compara cada leitura COMPLETA com a anterior
 * (decisão dele: "iERP compara as leituras") e registra:
 *   entrada  — o item apareceu (ou voltou) no estoque de lá;
 *   saida    — o item sumiu da lista de lá (vendido, expedido, descartado…);
 *   alterado — mudou um campo acompanhado (situação, quantidade, posição…), com antes e depois.
 * A PRIMEIRA leitura de um sistema só tira o retrato (sem "entrou" para o estoque inteiro). Leitura
 * incompleta (lista grande demais) ou com falha não conta: um item que não veio não "saiu".
 * As leituras vêm das telas e de uma leitura de fundo a cada 5 minutos (`iniciarEstoqueAoFundo`, em `estoque.ts`).
 */

export type AcaoEstoque = 'entrada' | 'saida' | 'alterado'
type Valor = string | number | boolean | null

/** O retrato de um item: o que se acompanha nele. */
export interface Retrato {
  itemId: string
  aba: AbaEstoque
  codigo: string
  descricao: string | null
  campos: Record<string, Valor>
  /** Rótulos de lá dos códigos (estados do armazém, nos 3 idiomas). */
  rotulos?: Record<string, { pt: string; en: string | null; zh: string | null }>
}

export interface EventoEstoque {
  id: string
  /** Quem "fez": o nome do sistema de lá. */
  autor: string
  em: string
  acao: AcaoEstoque
  mudancas?: { campo: string; antes: Valor; depois: Valor }[]
  /** O que é o item (mercadoria, modelo, produto). */
  nota?: string
  /** A tela do estoque. */
  tipo: AbaEstoque
  registroId: string
  registroRotulo: string
  registroSubtipo: null
  sistema: SistemaEstoque
  rotulos: Retrato['rotulos'] | null
}

const rotuloDe = (s: StatusDeFora | null) =>
  s ? { [s.codigo]: { pt: s.rotulo, en: s.rotuloEn, zh: s.rotuloZh } } : {}

export function retratoMaterial(m: MaterialDeFora): Retrato {
  return {
    itemId: m.id,
    aba: 'materiais',
    codigo: m.lote,
    descricao: m.tipoMercadoria,
    campos: {
      statusFisico: m.statusFisico?.codigo ?? null,
      statusVenda: m.statusVenda?.codigo ?? null,
      quantidade: m.quantidade,
      pesoKg: m.pesoKg,
      area: m.area,
      posicao: m.posicao,
    },
    rotulos: { ...rotuloDe(m.statusFisico), ...rotuloDe(m.statusVenda) },
  }
}

export function retratoMaquina(m: MaquinaDeFora, aba: 'assets' | 'pecas'): Retrato {
  return {
    itemId: m.id,
    aba,
    codigo: m.serial,
    descricao: [m.marca, m.modelo].filter(Boolean).join(' ') || m.resumo,
    campos: {
      statusMaquina: m.status?.codigo ?? null,
      preparo: m.preparo?.codigo ?? null,
      grade: m.grade,
      loteDeLa: m.lote,
    },
  }
}

export function retratoPosicao(p: PosicaoEcommerce): Retrato {
  return {
    itemId: p.id,
    aba: 'ecommerce',
    codigo: `${p.sku} @ ${p.posicao}`,
    descricao: p.descricao,
    campos: { quantidade: p.quantidade, produtoAtivo: p.produtoAtivo },
  }
}

/** O que mudou entre dois retratos do mesmo item. */
export function mudancasEntre(antes: Record<string, Valor>, depois: Record<string, Valor>) {
  return Object.keys({ ...antes, ...depois })
    .filter((campo) => (antes[campo] ?? null) !== (depois[campo] ?? null))
    .map((campo) => ({ campo, antes: antes[campo] ?? null, depois: depois[campo] ?? null }))
}

const LIMITE = 5000

export function criarHistoricoEstoque(db: Db) {
  // Uma comparação por vez por sistema (duas leituras terminando juntas não duplicam eventos).
  const filas = new Map<SistemaEstoque, Promise<void>>()

  async function comparar(sistema: SistemaEstoque, retratos: Retrato[], em: string) {
    const antigos = new Map(
      (
        await db.selectFrom('estoqueItens').selectAll().where('sistema', '=', sistema).execute()
      ).map((r) => [r.itemId, r]),
    )
    const primeira = antigos.size === 0
    const eventos: {
      id: string
      sistema: string
      itemId: string
      aba: string
      codigo: string
      descricao: string | null
      acao: AcaoEstoque
      mudancas: string | null
      rotulos: string | null
      em: string
    }[] = []
    const evento = (
      r: Retrato,
      acao: AcaoEstoque,
      mudancas: ReturnType<typeof mudancasEntre> = [],
    ) =>
      eventos.push({
        id: randomUUID(),
        sistema,
        itemId: r.itemId,
        aba: r.aba,
        codigo: r.codigo,
        descricao: r.descricao,
        acao,
        mudancas: mudancas.length ? JSON.stringify(mudancas) : null,
        rotulos: r.rotulos && Object.keys(r.rotulos).length ? JSON.stringify(r.rotulos) : null,
        em,
      })

    const vistos = new Set<string>()
    const gravar: EstoqueItensTable[] = []
    for (const r of retratos) {
      if (vistos.has(r.itemId)) continue
      vistos.add(r.itemId)
      const antigo = antigos.get(r.itemId)
      const campos = JSON.stringify(r.campos)
      if (!primeira) {
        if (!antigo || !antigo.ativo) evento(r, 'entrada')
        else {
          const m = mudancasEntre(JSON.parse(antigo.campos) as Record<string, Valor>, r.campos)
          if (m.length) evento(r, 'alterado', m)
        }
      }
      if (!antigo || !antigo.ativo || antigo.campos !== campos || antigo.aba !== r.aba)
        gravar.push({
          sistema,
          itemId: r.itemId,
          aba: r.aba,
          codigo: r.codigo,
          descricao: r.descricao,
          campos,
          ativo: 1,
          vistoEm: em,
        })
    }
    const saiu = [...antigos.values()].filter((a) => a.ativo && !vistos.has(a.itemId))
    for (const a of saiu)
      evento(
        {
          itemId: a.itemId,
          aba: a.aba as AbaEstoque,
          codigo: a.codigo,
          descricao: a.descricao,
          campos: {},
        },
        'saida',
      )

    if (!gravar.length && !saiu.length && !eventos.length) return
    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < gravar.length; i += 200)
        await trx
          .insertInto('estoqueItens')
          .values(gravar.slice(i, i + 200))
          .onConflict((c) =>
            c.columns(['sistema', 'itemId']).doUpdateSet((eb) => ({
              aba: eb.ref('excluded.aba'),
              codigo: eb.ref('excluded.codigo'),
              descricao: eb.ref('excluded.descricao'),
              campos: eb.ref('excluded.campos'),
              ativo: eb.ref('excluded.ativo'),
              vistoEm: eb.ref('excluded.vistoEm'),
            })),
          )
          .execute()
      for (let i = 0; i < saiu.length; i += 500)
        await trx
          .updateTable('estoqueItens')
          .set({ ativo: 0, vistoEm: em })
          .where('sistema', '=', sistema)
          .where(
            'itemId',
            'in',
            saiu.slice(i, i + 500).map((a) => a.itemId),
          )
          .execute()
      for (let i = 0; i < eventos.length; i += 200)
        await trx
          .insertInto('estoqueEventos')
          .values(eventos.slice(i, i + 200))
          .execute()
    })
  }

  /** Registra o que mudou numa leitura COMPLETA de um sistema. Nunca lança. */
  function registrar(sistema: SistemaEstoque, retratos: Retrato[], em: string) {
    const anterior = filas.get(sistema) ?? Promise.resolve()
    const vez = anterior
      .then(() => comparar(sistema, retratos, em))
      .catch((e: unknown) => console.error(`[estoque] histórico de ${sistema}:`, e))
    filas.set(sistema, vez)
    return vez
  }

  const consultaSchema = z.object({ desde: z.iso.datetime({ offset: true }).optional() })

  /** Os eventos (mais recentes primeiro), com o nome cadastrado de cada sistema. */
  async function listar(entrada: unknown): Promise<EventoEstoque[]> {
    const { desde } = consultaSchema.parse(entrada)
    const nomes = new Map(
      (
        await db
          .selectFrom('integracoes')
          .select(['sistema', 'nome'])
          .where('sistema', 'in', ['ARMAZEM', 'NOTEBOOKS', 'RTB_WMS'])
          .execute()
      ).map((i) => [i.sistema, i.nome]),
    )
    let q = db.selectFrom('estoqueEventos').selectAll()
    if (desde) q = q.where('em', '>=', new Date(desde).toISOString())
    const linhas = await q.orderBy('em', 'desc').orderBy('id', 'desc').limit(LIMITE).execute()
    return linhas.map((l) => ({
      id: l.id,
      autor: nomes.get(l.sistema) ?? l.sistema,
      em: l.em,
      acao: l.acao as AcaoEstoque,
      ...(l.mudancas ? { mudancas: JSON.parse(l.mudancas) as EventoEstoque['mudancas'] } : {}),
      ...(l.descricao ? { nota: l.descricao } : {}),
      tipo: l.aba as AbaEstoque,
      registroId: l.itemId,
      registroRotulo: l.codigo,
      registroSubtipo: null,
      sistema: l.sistema as SistemaEstoque,
      rotulos: l.rotulos ? (JSON.parse(l.rotulos) as Retrato['rotulos']) : null,
    }))
  }

  return { registrar, listar }
}

export type HistoricoEstoque = ReturnType<typeof criarHistoricoEstoque>
