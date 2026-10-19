import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import type { Transaction } from 'kysely'
import multer from 'multer'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { Database } from '../../db/schema.js'
import { extensaoDe, MAX_BYTES, nomeSeguro } from '../../shared/arquivos.js'
import { autorDa } from '../../shared/autor.js'
import { diaNoFuso, ehDia, inicioDoDia } from '../../shared/datas.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { Mudanca } from '../../shared/historico.js'
import { registrarHistorico } from '../../shared/historico.repositorio.js'
import {
  enviarImagem,
  original,
  textoTraduzidoSchema,
  TIPOS_FOTO,
  type FotoEnviada,
  type FotoRecebimento,
  type LocalizedText,
} from './ordens.lote.js'

/*
 * Operação › Recebimento (pedido do usuário, 19/10/2026):
 *   POST /api/ordens/:id/recebimento   recebe o lote AGENDADO → etapa Inspeção
 *   PUT  /api/ordens/:id/recebimento   corrige o recebimento (só enquanto em Inspeção)
 *   GET  /api/ordens/:id/recebimento/fotos/:foto   foto (imagem exibida na tela)
 *
 * Multipart: `dados` (JSON) + fotos nos campos `lacres.<i>`, `notas.<i>`, `pallets.<i>` e `gerais`
 * (i = posição do item na lista enviada). Na correção, cada item pode trazer `id` e `fotosManter`.
 *
 * Regras: data de recebimento obrigatória (não futura); inspeção visual obrigatória (bom, avaria,
 * outro) — avaria/outro pedem descrição e viram ocorrência de Recebimento no lote; lacres e notas
 * fiscais opcionais, mas cada um com número e pelo menos uma foto; pelo menos um pallet, cada um
 * com peso bruto e foto (tara opcional, líquido = bruto − tara); fotos gerais opcionais.
 */

/* ------------------------------------------------------------ contrato (espelho de src/services/types.ts) */

export const INSPECOES = ['bom', 'avaria', 'outro'] as const
export type InspecaoVisual = (typeof INSPECOES)[number]

export interface ItemRecebimento {
  id: string
  numero: string
  fotos: FotoRecebimento[]
}

export interface RecebimentoLote {
  /** Início do dia (ISO). */
  dataRecebimento: string
  inspecao: InspecaoVisual
  inspecaoDescricao: LocalizedText | null
  /** Ocorrência criada para avaria/outro. */
  ocorrenciaId: string | null
  lacres: ItemRecebimento[]
  notas: ItemRecebimento[]
  fotosGerais: FotoRecebimento[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/* ------------------------------------------------------------ regras */

const MAX_FOTOS_ITEM = 5
const MAX_FOTOS_GERAIS = 20
const MAX_ARQUIVOS = 300

const item = z.object({
  id: z.string().optional(),
  numero: z.string().trim().min(1, 'Informe o número.').max(40),
  fotosManter: z.array(z.string()).default([]),
})

const pallet = z
  .object({
    id: z.string().optional(),
    pesoBruto: z
      .number({ error: 'Informe o peso bruto.' })
      .positive('Informe o peso bruto.')
      .max(100_000),
    tara: z
      .number()
      .min(0)
      .max(100_000)
      .nullish()
      .transform((v) => v ?? null),
    conteudo: z
      .string()
      .trim()
      .max(200)
      .nullish()
      .transform((v) => v || null),
    fotosManter: z.array(z.string()).default([]),
  })
  .refine((p) => p.tara === null || p.tara <= p.pesoBruto, {
    message: 'A tara não pode ser maior que o peso bruto.',
    path: ['tara'],
  })

export const recebimentoSchema = z
  .object({
    dataRecebimento: z
      .string({ error: 'Informe a data de recebimento.' })
      .refine(ehDia, 'Informe a data de recebimento (AAAA-MM-DD).'),
    inspecao: z.enum(INSPECOES, { error: 'Escolha a inspeção visual.' }),
    inspecaoDescricao: textoTraduzidoSchema.nullish().transform((v) => v ?? null),
    lacres: z.array(item).max(50).default([]),
    notas: z.array(item).max(50).default([]),
    pallets: z.array(pallet).min(1, 'Informe pelo menos um pallet.').max(500),
    fotosGeraisManter: z.array(z.string()).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.dataRecebimento > diaNoFuso())
      ctx.addIssue({
        code: 'custom',
        path: ['dataRecebimento'],
        message: 'A data de recebimento não pode ser no futuro.',
      })
    if (v.inspecao !== 'bom' && !v.inspecaoDescricao)
      ctx.addIssue({
        code: 'custom',
        path: ['inspecaoDescricao'],
        message: 'Descreva o que foi encontrado na inspeção.',
      })
  })

type Entrada = z.output<typeof recebimentoSchema>
type Alvo = 'lacre' | 'nota' | 'pallet' | 'geral'
type Conexao = Db | Transaction<Database>

/** Categoria da ocorrência criada pela inspeção visual. */
const CATEGORIA_DA_INSPECAO = { avaria: 'avaria_carga', outro: 'outro' } as const

/* ------------------------------------------------------------ serviço */

export function criarServicoRecebimento(db: Db, opcoes: { pasta: string }) {
  const caminho = (ordemId: string, fotoId: string) =>
    path.join(opcoes.pasta, 'ordens', ordemId, 'recebimento', fotoId)

  async function fotosDoLote(cx: Conexao, ordemId: string) {
    return cx
      .selectFrom('ordensRecebimentoFotos')
      .selectAll()
      .where('ordemId', '=', ordemId)
      .orderBy('posicao', 'asc')
      .execute()
  }

  async function itens(cx: Conexao, tabela: 'ordensLacres' | 'ordensNotasFiscais', id: string) {
    return cx
      .selectFrom(tabela)
      .selectAll()
      .where('ordemId', '=', id)
      .orderBy('posicao', 'asc')
      .execute()
  }

  /** Resumo para o histórico (o mesmo formato antes e depois). */
  async function resumo(cx: Conexao, ordemId: string): Promise<Record<string, Mudanca['antes']>> {
    const r = await cx
      .selectFrom('ordensRecebimentos')
      .selectAll()
      .where('ordemId', '=', ordemId)
      .executeTakeFirst()
    const [lacres, notas, pallets, fotos] = await Promise.all([
      itens(cx, 'ordensLacres', ordemId),
      itens(cx, 'ordensNotasFiscais', ordemId),
      cx
        .selectFrom('ordensPallets')
        .select(['pesoKg', 'taraKg'])
        .where('ordemId', '=', ordemId)
        .where('origem', '=', 'iERP')
        .execute(),
      fotosDoLote(cx, ordemId),
    ])
    const bruto = pallets.reduce((a, p) => a + (p.pesoKg ?? 0), 0)
    const tara = pallets.reduce((a, p) => a + (p.taraKg ?? 0), 0)
    const descricao = r?.inspecaoDescricao
      ? original(JSON.parse(r.inspecaoDescricao) as LocalizedText)
      : null
    return {
      dataRecebimento: r ? diaNoFuso(new Date(r.dataRecebimento)) : null,
      inspecao: r?.inspecao ?? null,
      inspecaoDescricao: descricao,
      lacres: lacres.map((l) => l.numero).join(', ') || null,
      notas: notas.map((n) => n.numero).join(', ') || null,
      palletsRecebidos: pallets.length || null,
      pesoBruto: pallets.length ? Math.round(bruto * 100) / 100 : null,
      pesoLiquido: pallets.length ? Math.round((bruto - tara) * 100) / 100 : null,
      fotosGerais: fotos.filter((f) => f.alvo === 'geral').length || null,
      fotos: fotos.length || null,
    }
  }

  /** Cria (ou atualiza) a ocorrência de Recebimento ligada à inspeção avaria/outro. */
  async function sincronizarOcorrencia(
    trx: Transaction<Database>,
    ordemId: string,
    v: Entrada,
    atualId: string | null,
    autor: string,
    agora: string,
  ): Promise<string | null> {
    const atual = atualId
      ? await trx
          .selectFrom('ordensOcorrencias')
          .selectAll()
          .where('id', '=', atualId)
          .executeTakeFirst()
      : undefined
    const ativa = atual?.status === 'registrada' ? atual : undefined

    if (v.inspecao === 'bom') {
      // Voltou a "bom": a ocorrência criada pela inspeção é cancelada (fica no histórico).
      if (ativa) {
        await trx
          .updateTable('ordensOcorrencias')
          .set({ status: 'cancelado', alteradoEm: agora, alteradoPor: autor })
          .where('id', '=', ativa.id)
          .execute()
        await registrarHistorico(trx, 'ordem', ordemId, {
          autor,
          em: agora,
          acao: 'ocorrencia_cancelada',
          nota: `#${ativa.numero}`,
          mudancas: [{ campo: 'status', antes: 'registrada', depois: 'cancelado' }],
        })
      }
      return null
    }

    const categoria = CATEGORIA_DA_INSPECAO[v.inspecao]
    const texto = v.inspecaoDescricao!
    if (ativa) {
      const antesTexto = original(JSON.parse(ativa.texto) as LocalizedText)
      const mudancas: Mudanca[] = []
      if (ativa.categoria !== categoria)
        mudancas.push({ campo: 'categoria', antes: ativa.categoria, depois: categoria })
      if (antesTexto !== original(texto))
        mudancas.push({ campo: 'texto', antes: antesTexto, depois: original(texto) })
      if (mudancas.length || ativa.texto !== JSON.stringify(texto)) {
        await trx
          .updateTable('ordensOcorrencias')
          .set({ categoria, texto: JSON.stringify(texto), alteradoEm: agora, alteradoPor: autor })
          .where('id', '=', ativa.id)
          .execute()
        if (mudancas.length)
          await registrarHistorico(trx, 'ordem', ordemId, {
            autor,
            em: agora,
            acao: 'ocorrencia_editada',
            nota: `#${ativa.numero}`,
            mudancas,
          })
      }
      return ativa.id
    }

    const ultimo = await trx
      .selectFrom('ordensOcorrencias')
      .select((eb) => eb.fn.max('numero').as('n'))
      .where('ordemId', '=', ordemId)
      .executeTakeFirst()
    const numero = Number(ultimo?.n ?? 0) + 1
    const id = randomUUID()
    await trx
      .insertInto('ordensOcorrencias')
      .values({
        id,
        ordemId,
        numero,
        momento: 'recebimento',
        categoria,
        texto: JSON.stringify(texto),
        status: 'registrada',
        criadoEm: agora,
        criadoPor: autor,
        alteradoEm: agora,
        alteradoPor: autor,
      })
      .execute()
    await registrarHistorico(trx, 'ordem', ordemId, {
      autor,
      em: agora,
      acao: 'ocorrencia_registrada',
      nota: `#${numero}`,
      mudancas: [
        { campo: 'momento', antes: null, depois: 'recebimento' },
        { campo: 'categoria', antes: null, depois: categoria },
        { campo: 'texto', antes: null, depois: original(texto) },
      ],
    })
    return id
  }

  async function salvar(
    ordemId: string,
    dadosBrutos: unknown,
    arquivos: Map<string, FotoEnviada[]>,
    autor: string,
    modo: 'receber' | 'corrigir',
  ) {
    const ordem = await db
      .selectFrom('ordens')
      .select(['id', 'status'])
      .where('id', '=', ordemId)
      .executeTakeFirst()
    if (!ordem) throw naoEncontrado('Lote não encontrado.')
    const existente = await db
      .selectFrom('ordensRecebimentos')
      .selectAll()
      .where('ordemId', '=', ordemId)
      .executeTakeFirst()
    if (modo === 'receber' && (ordem.status !== 'agendado' || existente))
      throw new ErroApi(409, 'invalid_transition', 'Só lote agendado pode ser recebido.')
    if (modo === 'corrigir' && (ordem.status !== 'inspecao' || !existente))
      throw new ErroApi(
        409,
        'invalid_transition',
        'O recebimento só pode ser corrigido enquanto o lote está em Inspeção.',
      )
    const v = recebimentoSchema.parse(dadosBrutos)

    // O que já existe (correção): itens e fotos de cada alvo.
    const [lacresAntes, notasAntes, palletsAntes, fotosAntes] = await Promise.all([
      itens(db, 'ordensLacres', ordemId),
      itens(db, 'ordensNotasFiscais', ordemId),
      db
        .selectFrom('ordensPallets')
        .selectAll()
        .where('ordemId', '=', ordemId)
        .where('origem', '=', 'iERP')
        .execute(),
      fotosDoLote(db, ordemId),
    ])
    const idsAntes = {
      lacre: new Set(lacresAntes.map((x) => x.id)),
      nota: new Set(notasAntes.map((x) => x.id)),
      pallet: new Set(palletsAntes.map((x) => x.id)),
    }

    // Fotos que ficam + novas, por item (validadas antes de gravar qualquer coisa).
    const novasFotos: {
      id: string
      alvo: Alvo
      alvoId: string | null
      posicao: number
      nome: string
      extensao: string
      conteudo: Buffer
    }[] = []
    const mantidas = new Set<string>()
    const prepararFotos = (
      alvo: Alvo,
      alvoId: string | null,
      manter: string[],
      campo: string,
      min: number,
      max: number,
      rotulo: string,
    ) => {
      const validas = fotosAntes.filter(
        (f) => f.alvo === alvo && f.alvoId === alvoId && manter.includes(f.id),
      )
      const enviadas = arquivos.get(campo) ?? []
      const total = validas.length + enviadas.length
      if (total < min) throw new ErroApi(422, 'validation', `${rotulo}: tire ou escolha uma foto.`)
      if (total > max) throw new ErroApi(422, 'validation', `${rotulo}: até ${max} fotos.`)
      validas.forEach((f) => mantidas.add(f.id))
      let posicao = Math.max(0, ...validas.map((f) => f.posicao))
      for (const f of enviadas) {
        const nome = nomeSeguro(f.nomeOriginal)
        const extensao = extensaoDe(nome)
        if (!TIPOS_FOTO[extensao])
          throw new ErroApi(415, 'file_type_not_allowed', 'Envie fotos em JPG, PNG ou WEBP.', {
            permitidas: Object.keys(TIPOS_FOTO),
          })
        if (!f.conteudo.length) throw new ErroApi(422, 'validation', 'A foto está vazia.')
        novasFotos.push({
          id: randomUUID(),
          alvo,
          alvoId,
          posicao: ++posicao,
          nome,
          extensao,
          conteudo: f.conteudo,
        })
      }
    }
    // Item com id de outro lote/inexistente vira item novo.
    const idDo = (alvo: 'lacre' | 'nota' | 'pallet', id: string | undefined) =>
      id && idsAntes[alvo].has(id) ? id : randomUUID()

    const lacres = v.lacres.map((l, i) => {
      const id = idDo('lacre', l.id)
      prepararFotos('lacre', id, l.fotosManter, `lacres.${i}`, 1, MAX_FOTOS_ITEM, `Lacre ${i + 1}`)
      return { id, numero: l.numero }
    })
    const notas = v.notas.map((n, i) => {
      const id = idDo('nota', n.id)
      prepararFotos(
        'nota',
        id,
        n.fotosManter,
        `notas.${i}`,
        1,
        MAX_FOTOS_ITEM,
        `Nota fiscal ${i + 1}`,
      )
      return { id, numero: n.numero }
    })
    const pallets = v.pallets.map((p, i) => {
      const id = idDo('pallet', p.id)
      prepararFotos(
        'pallet',
        id,
        p.fotosManter,
        `pallets.${i}`,
        1,
        MAX_FOTOS_ITEM,
        `Pallet ${i + 1}`,
      )
      return { ...p, id }
    })
    prepararFotos('geral', null, v.fotosGeraisManter, 'gerais', 0, MAX_FOTOS_GERAIS, 'Fotos gerais')
    const removidas = fotosAntes.filter((f) => !mantidas.has(f.id))

    const agora = new Date().toISOString()
    // Recebido hoje: a hora de agora; em outro dia: o início daquele dia (São Paulo).
    const recebidoEm = v.dataRecebimento === diaNoFuso() ? agora : inicioDoDia(v.dataRecebimento)
    const gravados: string[] = []
    try {
      for (const f of novasFotos) {
        const destino = caminho(ordemId, f.id)
        await mkdir(path.dirname(destino), { recursive: true })
        await writeFile(destino, f.conteudo)
        gravados.push(destino)
      }
      await db.transaction().execute(async (trx) => {
        const antes = modo === 'corrigir' ? await resumo(trx, ordemId) : null

        // Itens: substitui a lista inteira (mantendo os ids — as fotos apontam para eles).
        await trx.deleteFrom('ordensLacres').where('ordemId', '=', ordemId).execute()
        await trx.deleteFrom('ordensNotasFiscais').where('ordemId', '=', ordemId).execute()
        if (lacres.length)
          await trx
            .insertInto('ordensLacres')
            .values(lacres.map((l, i) => ({ id: l.id, ordemId, posicao: i + 1, numero: l.numero })))
            .execute()
        if (notas.length)
          await trx
            .insertInto('ordensNotasFiscais')
            .values(notas.map((n, i) => ({ id: n.id, ordemId, posicao: i + 1, numero: n.numero })))
            .execute()

        // Pallets do iERP (os da integração ficam como estão; os do iERP vêm depois deles).
        await trx
          .deleteFrom('ordensPallets')
          .where('ordemId', '=', ordemId)
          .where('origem', '=', 'iERP')
          .execute()
        const outros = await trx
          .selectFrom('ordensPallets')
          .select((eb) => eb.fn.max('numero').as('n'))
          .where('ordemId', '=', ordemId)
          .executeTakeFirst()
        const base = Number(outros?.n ?? 0)
        const anteriores = new Map(palletsAntes.map((p) => [p.id, p]))
        await trx
          .insertInto('ordensPallets')
          .values(
            pallets.map((p, i) => {
              const ant = anteriores.get(p.id)
              const mudouPeso = !ant || ant.pesoKg !== p.pesoBruto || ant.taraKg !== p.tara
              return {
                id: p.id,
                ordemId,
                numero: base + i + 1,
                pesoKg: p.pesoBruto,
                taraKg: p.tara,
                conteudo: p.conteudo,
                pesadoPor: mudouPeso ? autor : (ant?.pesadoPor ?? autor),
                pesadoEm: mudouPeso ? agora : (ant?.pesadoEm ?? agora),
                fotoExtensao: null,
                origem: 'iERP',
                criadoEm: ant?.criadoEm ?? agora,
              }
            }),
          )
          .execute()

        // Fotos: sai o que não ficou; entra o que é novo.
        if (removidas.length)
          await trx
            .deleteFrom('ordensRecebimentoFotos')
            .where(
              'id',
              'in',
              removidas.map((f) => f.id),
            )
            .execute()
        if (novasFotos.length)
          await trx
            .insertInto('ordensRecebimentoFotos')
            .values(
              novasFotos.map((f) => ({
                id: f.id,
                ordemId,
                alvo: f.alvo,
                alvoId: f.alvoId,
                posicao: f.posicao,
                nome: f.nome,
                extensao: f.extensao,
                tamanho: f.conteudo.length,
                enviadoEm: agora,
                enviadoPor: autor,
              })),
            )
            .execute()

        const ocorrenciaId = await sincronizarOcorrencia(
          trx,
          ordemId,
          v,
          existente?.ocorrenciaId ?? null,
          autor,
          agora,
        )
        const linha = {
          dataRecebimento: inicioDoDia(v.dataRecebimento),
          inspecao: v.inspecao,
          inspecaoDescricao:
            v.inspecao === 'bom' || !v.inspecaoDescricao
              ? null
              : JSON.stringify(v.inspecaoDescricao),
          ocorrenciaId,
          alteradoEm: agora,
          alteradoPor: autor,
        }

        if (modo === 'receber') {
          await trx
            .insertInto('ordensRecebimentos')
            .values({ ordemId, ...linha, criadoEm: agora, criadoPor: autor })
            .execute()
          await trx
            .updateTable('ordens')
            .set({
              status: 'inspecao',
              recebidoEm,
              etapaDesde: recebidoEm,
              alteradoEm: agora,
              alteradoPor: autor,
            })
            .where('id', '=', ordemId)
            .execute()
          await trx
            .insertInto('ordensEtapas')
            .values({ id: randomUUID(), ordemId, etapa: 'inspecao', em: recebidoEm, autor })
            .execute()
          const depois = await resumo(trx, ordemId)
          await registrarHistorico(trx, 'ordem', ordemId, {
            autor,
            em: agora,
            acao: 'recebido',
            mudancas: [
              { campo: 'status', antes: 'agendado', depois: 'inspecao' },
              ...Object.entries(depois)
                .filter(([, x]) => x !== null)
                .map(([campo, x]) => ({ campo, antes: null, depois: x })),
            ],
          })
          return
        }

        await trx
          .updateTable('ordensRecebimentos')
          .set(linha)
          .where('ordemId', '=', ordemId)
          .execute()
        // Data corrigida: o início do SLA e a entrada em Inspeção acompanham.
        if (existente && existente.dataRecebimento !== linha.dataRecebimento) {
          await trx
            .updateTable('ordens')
            .set({ recebidoEm, etapaDesde: recebidoEm })
            .where('id', '=', ordemId)
            .execute()
          await trx
            .updateTable('ordensEtapas')
            .set({ em: recebidoEm })
            .where('ordemId', '=', ordemId)
            .where('etapa', '=', 'inspecao')
            .execute()
        }
        const depois = await resumo(trx, ordemId)
        const mudancas = Object.keys(depois)
          .filter((k) => (antes![k] ?? null) !== (depois[k] ?? null))
          .map((k) => ({ campo: k, antes: antes![k] ?? null, depois: depois[k] ?? null }))
        await trx
          .updateTable('ordens')
          .set({ alteradoEm: agora, alteradoPor: autor })
          .where('id', '=', ordemId)
          .execute()
        if (mudancas.length)
          await registrarHistorico(trx, 'ordem', ordemId, {
            autor,
            em: agora,
            acao: 'recebimento_editado',
            mudancas,
          })
      })
    } catch (e) {
      await Promise.all(gravados.map((g) => rm(g, { force: true })))
      throw e
    }
    await Promise.all(removidas.map((f) => rm(caminho(ordemId, f.id), { force: true })))
  }

  return {
    salvar,

    /** Recebimento do lote (entra no GET /api/ordens/:id); null = ainda não recebido. */
    async dados(ordemId: string): Promise<RecebimentoLote | null> {
      const r = await db
        .selectFrom('ordensRecebimentos')
        .selectAll()
        .where('ordemId', '=', ordemId)
        .executeTakeFirst()
      if (!r) return null
      const [lacres, notas, fotos] = await Promise.all([
        itens(db, 'ordensLacres', ordemId),
        itens(db, 'ordensNotasFiscais', ordemId),
        fotosDoLote(db, ordemId),
      ])
      const de = (alvo: Alvo, alvoId: string | null): FotoRecebimento[] =>
        fotos
          .filter((f) => f.alvo === alvo && f.alvoId === alvoId)
          .map((f) => ({ id: f.id, nome: f.nome, extensao: f.extensao, tamanho: f.tamanho }))
      return {
        dataRecebimento: r.dataRecebimento,
        inspecao: r.inspecao as InspecaoVisual,
        inspecaoDescricao: r.inspecaoDescricao
          ? (JSON.parse(r.inspecaoDescricao) as LocalizedText)
          : null,
        ocorrenciaId: r.ocorrenciaId,
        lacres: lacres.map((l) => ({ id: l.id, numero: l.numero, fotos: de('lacre', l.id) })),
        notas: notas.map((n) => ({ id: n.id, numero: n.numero, fotos: de('nota', n.id) })),
        fotosGerais: de('geral', null),
        criadoEm: r.criadoEm,
        criadoPor: r.criadoPor,
        alteradoEm: r.alteradoEm,
        alteradoPor: r.alteradoPor,
      }
    },

    async foto(ordemId: string, fotoId: string) {
      const f = await db
        .selectFrom('ordensRecebimentoFotos')
        .selectAll()
        .where('id', '=', fotoId)
        .where('ordemId', '=', ordemId)
        .executeTakeFirst()
      if (!f) throw naoEncontrado('Foto não encontrada.')
      const conteudo = await readFile(caminho(ordemId, fotoId)).catch(() => {
        throw naoEncontrado('Arquivo não encontrado no servidor.')
      })
      return { nome: f.nome, tipo: TIPOS_FOTO[f.extensao] ?? 'application/octet-stream', conteudo }
    },
  }
}

export type ServicoRecebimento = ReturnType<typeof criarServicoRecebimento>

/* ------------------------------------------------------------ rotas (montadas em /api/ordens) */

export function rotasRecebimento(
  servico: ServicoRecebimento,
  aoMudar: (ordemId: string) => Promise<unknown>,
) {
  const r = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: MAX_ARQUIVOS },
    defParamCharset: 'utf8',
  }).any()

  const ler = (req: { body: unknown; files?: unknown }) => {
    let dados: unknown
    try {
      dados = JSON.parse(String((req.body as Record<string, unknown>).dados ?? ''))
    } catch {
      throw new ErroApi(422, 'validation', 'Dados do recebimento inválidos.')
    }
    const arquivos = new Map<string, FotoEnviada[]>()
    for (const f of (req.files as Express.Multer.File[] | undefined) ?? []) {
      const lista = arquivos.get(f.fieldname) ?? []
      lista.push({ nomeOriginal: f.originalname, conteudo: f.buffer })
      arquivos.set(f.fieldname, lista)
    }
    return { dados, arquivos }
  }

  r.post('/:id/recebimento', upload, async (req, res) => {
    const id = String(req.params.id)
    const { dados, arquivos } = ler(req)
    await servico.salvar(id, dados, arquivos, autorDa(req), 'receber')
    res.status(201).json(await aoMudar(id))
  })
  r.put('/:id/recebimento', upload, async (req, res) => {
    const id = String(req.params.id)
    const { dados, arquivos } = ler(req)
    await servico.salvar(id, dados, arquivos, autorDa(req), 'corrigir')
    res.json(await aoMudar(id))
  })
  r.get('/:id/recebimento/fotos/:foto', async (req, res) => {
    enviarImagem(res, await servico.foto(String(req.params.id), String(req.params.foto)))
  })
  return r
}
