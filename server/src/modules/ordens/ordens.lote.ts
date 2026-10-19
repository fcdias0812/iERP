import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Router, type Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import { extensaoDe, MAX_BYTES, nomeSeguro } from '../../shared/arquivos.js'
import { autorDa } from '../../shared/autor.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { Mudanca } from '../../shared/historico.js'
import { registrarHistorico } from '../../shared/historico.repositorio.js'

/*
 * Detalhe do lote (Ordens › Lotes e Operação › Lotes) — o que acontece com o lote depois do
 * agendamento:
 *   GET  /api/ordens/:id                       (em ordens.ts) já traz etapas, pallets e ocorrências
 *   POST /api/ordens/:id/ocorrencias           registra — multipart: `dados` (JSON) + `fotos`
 *   PATCH /api/ordens/:id/ocorrencias/:oc      corrige — multipart: `dados` (+ `removerFotos`) + `fotos`
 *   POST /api/ordens/:id/ocorrencias/:oc/cancelar
 *   GET  /api/ordens/:id/ocorrencias/:oc/fotos/:foto   foto (imagem, exibida na tela)
 *   GET  /api/ordens/:id/pallets/:pallet/foto          foto do pallet
 *
 * Regras (decisões do usuário, 19/10/2026): momento (coleta, trajeto ou recebimento), categoria e
 * texto obrigatórios; fotos opcionais. Pode corrigir ou cancelar; tudo vai para o histórico do lote.
 * Pallets vêm da integração ou, depois, de Operação › Recebimento — aqui só são lidos.
 */

/* ------------------------------------------------------------ contrato (espelho de src/services/types.ts) */

export const MOMENTOS = ['coleta', 'trajeto', 'recebimento'] as const
export type MomentoOcorrencia = (typeof MOMENTOS)[number]

export const CATEGORIAS_OCORRENCIA = [
  'atraso',
  'avaria_carga',
  'divergencia_quantidade',
  'embalagem_inadequada',
  'problema_veiculo',
  'acesso_negado',
  'material_nao_identificado',
  'outro',
] as const
export type CategoriaOcorrencia = (typeof CATEGORIAS_OCORRENCIA)[number]

export type StatusOcorrencia = 'registrada' | 'cancelado'

const IDIOMAS = ['pt-BR', 'en', 'zh-TW'] as const
type Idioma = (typeof IDIOMAS)[number]

/** Texto digitado nos 3 idiomas (mesmo formato de src/lib/localized-text.ts). */
export interface LocalizedText {
  origem: Idioma
  textos: Partial<Record<Idioma, string>>
  automaticos?: Idioma[]
}

export interface FotoOcorrencia {
  id: string
  nome: string
  extensao: string
  tamanho: number
  enviadoEm: string
  enviadoPor: string
}

export interface OcorrenciaLote {
  id: string
  numero: number
  momento: MomentoOcorrencia
  categoria: CategoriaOcorrencia
  texto: LocalizedText
  status: StatusOcorrencia
  fotos: FotoOcorrencia[]
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

/** Foto do recebimento (lacre, nota fiscal, pallet ou geral). */
export interface FotoRecebimento {
  id: string
  nome: string
  extensao: string
  tamanho: number
}

export interface PalletLote {
  id: string
  numero: number
  /** Peso bruto (kg). */
  pesoKg: number | null
  /** Tara — peso do pallet vazio (kg). */
  taraKg: number | null
  /** Bruto − tara (kg); sem tara = bruto. */
  pesoLiquidoKg: number | null
  /** Fotos do recebimento (Operação › Recebimento). */
  fotos: FotoRecebimento[]
  conteudo: string | null
  pesadoPor: string | null
  pesadoEm: string | null
  temFoto: boolean
  /** Sistema de onde veio o registro (ex.: "iERP"). */
  origem: string
}

export interface EtapaLote {
  etapa: string
  em: string
}

/* ------------------------------------------------------------ regras */

/** Fotos: só imagens que o navegador exibe. */
export const TIPOS_FOTO: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const MAX_FOTOS = 10
const MAX_TEXTO = 2000

export const textoTraduzidoSchema = z
  .object({
    origem: z.enum(IDIOMAS),
    textos: z.object({
      'pt-BR': z.string().max(MAX_TEXTO).optional(),
      en: z.string().max(MAX_TEXTO).optional(),
      'zh-TW': z.string().max(MAX_TEXTO).optional(),
    }),
    automaticos: z.array(z.enum(IDIOMAS)).optional(),
  })
  .refine((v) => Boolean(v.textos[v.origem]?.trim()), {
    message: 'Descreva a ocorrência.',
    path: ['textos'],
  })

export const ocorrenciaSchema = z.object({
  momento: z.enum(MOMENTOS, { error: 'Escolha o momento da ocorrência.' }),
  categoria: z.enum(CATEGORIAS_OCORRENCIA, { error: 'Escolha a categoria.' }),
  texto: textoTraduzidoSchema,
})

const edicaoSchema = ocorrenciaSchema.extend({
  removerFotos: z.array(z.string()).default([]),
})

export const original = (t: LocalizedText) => t.textos[t.origem]?.trim() ?? ''

/* ------------------------------------------------------------ serviço */

export interface FotoEnviada {
  nomeOriginal: string
  conteudo: Buffer
}

export function criarServicoLote(db: Db, opcoes: { pasta: string }) {
  const pastaOrdem = (ordemId: string) => path.join(opcoes.pasta, 'ordens', ordemId)
  const caminhoFoto = (ordemId: string, fotoId: string) =>
    path.join(pastaOrdem(ordemId), 'ocorrencias', fotoId)
  const caminhoPallet = (ordemId: string, palletId: string) =>
    path.join(pastaOrdem(ordemId), 'pallets', palletId)

  async function exigirOrdem(ordemId: string) {
    const o = await db
      .selectFrom('ordens')
      .select('id')
      .where('id', '=', ordemId)
      .executeTakeFirst()
    if (!o) throw naoEncontrado('Lote não encontrado.')
  }

  async function exigirOcorrencia(ordemId: string, ocId: string) {
    const oc = await db
      .selectFrom('ordensOcorrencias')
      .selectAll()
      .where('id', '=', ocId)
      .where('ordemId', '=', ordemId)
      .executeTakeFirst()
    if (!oc) throw naoEncontrado('Ocorrência não encontrada.')
    return oc
  }

  /** Confere as fotos antes de gravar qualquer coisa. */
  function prepararFotos(fotos: FotoEnviada[]) {
    return fotos.map((f) => {
      const nome = nomeSeguro(f.nomeOriginal)
      const extensao = extensaoDe(nome)
      if (!TIPOS_FOTO[extensao])
        throw new ErroApi(415, 'file_type_not_allowed', 'Envie fotos em JPG, PNG ou WEBP.', {
          permitidas: Object.keys(TIPOS_FOTO),
        })
      if (!f.conteudo.length) throw new ErroApi(422, 'validation', 'A foto está vazia.')
      return { id: randomUUID(), nome, extensao, conteudo: f.conteudo }
    })
  }

  /** Grava as fotos no disco; se algo falhar depois, `desfazer` apaga o que foi gravado. */
  async function gravarFotos(ordemId: string, fotos: ReturnType<typeof prepararFotos>) {
    const gravados: string[] = []
    for (const f of fotos) {
      const destino = caminhoFoto(ordemId, f.id)
      await mkdir(path.dirname(destino), { recursive: true })
      await writeFile(destino, f.conteudo)
      gravados.push(destino)
    }
    return { desfazer: () => Promise.all(gravados.map((g) => rm(g, { force: true }))) }
  }

  async function fotosDa(ocIds: string[]) {
    if (!ocIds.length) return new Map<string, FotoOcorrencia[]>()
    const linhas = await db
      .selectFrom('ordensOcorrenciasFotos')
      .selectAll()
      .where('ocorrenciaId', 'in', ocIds)
      .orderBy('posicao', 'asc')
      .execute()
    const mapa = new Map<string, FotoOcorrencia[]>()
    for (const f of linhas) {
      const lista = mapa.get(f.ocorrenciaId) ?? []
      lista.push({
        id: f.id,
        nome: f.nome,
        extensao: f.extensao,
        tamanho: f.tamanho,
        enviadoEm: f.enviadoEm,
        enviadoPor: f.enviadoPor,
      })
      mapa.set(f.ocorrenciaId, lista)
    }
    return mapa
  }

  return {
    /** Etapas, pallets e ocorrências do lote (entram no GET /api/ordens/:id). */
    async dados(ordemId: string) {
      const [etapas, pallets, ocorrencias, fotosPallets] = await Promise.all([
        db
          .selectFrom('ordensEtapas')
          .select(['etapa', 'em'])
          .where('ordemId', '=', ordemId)
          .orderBy('em', 'asc')
          .orderBy('id', 'asc')
          .execute(),
        db
          .selectFrom('ordensPallets')
          .selectAll()
          .where('ordemId', '=', ordemId)
          .orderBy('numero', 'asc')
          .execute(),
        db
          .selectFrom('ordensOcorrencias')
          .selectAll()
          .where('ordemId', '=', ordemId)
          .orderBy('numero', 'desc')
          .execute(),
        db
          .selectFrom('ordensRecebimentoFotos')
          .select(['id', 'alvoId', 'nome', 'extensao', 'tamanho'])
          .where('ordemId', '=', ordemId)
          .where('alvo', '=', 'pallet')
          .orderBy('posicao', 'asc')
          .execute(),
      ])
      const fotos = await fotosDa(ocorrencias.map((o) => o.id))
      const fotosDoPallet = (id: string): FotoRecebimento[] =>
        fotosPallets
          .filter((f) => f.alvoId === id)
          .map((f) => ({ id: f.id, nome: f.nome, extensao: f.extensao, tamanho: f.tamanho }))
      return {
        etapas: etapas as EtapaLote[],
        pallets: pallets.map((p): PalletLote => ({
          id: p.id,
          numero: p.numero,
          pesoKg: p.pesoKg,
          taraKg: p.taraKg,
          pesoLiquidoKg: p.pesoKg === null ? null : p.pesoKg - (p.taraKg ?? 0),
          fotos: fotosDoPallet(p.id),
          conteudo: p.conteudo,
          pesadoPor: p.pesadoPor,
          pesadoEm: p.pesadoEm,
          temFoto: Boolean(p.fotoExtensao),
          origem: p.origem,
        })),
        ocorrencias: ocorrencias.map((o): OcorrenciaLote => ({
          id: o.id,
          numero: o.numero,
          momento: o.momento as MomentoOcorrencia,
          categoria: o.categoria as CategoriaOcorrencia,
          texto: JSON.parse(o.texto) as LocalizedText,
          status: o.status as StatusOcorrencia,
          fotos: fotos.get(o.id) ?? [],
          criadoEm: o.criadoEm,
          criadoPor: o.criadoPor,
          alteradoEm: o.alteradoEm,
          alteradoPor: o.alteradoPor,
        })),
      }
    },

    async registrar(ordemId: string, dadosBrutos: unknown, fotos: FotoEnviada[], autor: string) {
      await exigirOrdem(ordemId)
      const v = ocorrenciaSchema.parse(dadosBrutos)
      if (fotos.length > MAX_FOTOS)
        throw new ErroApi(422, 'validation', `Envie até ${MAX_FOTOS} fotos por ocorrência.`)
      const novas = prepararFotos(fotos)
      const id = randomUUID()
      const agora = new Date().toISOString()
      const disco = await gravarFotos(ordemId, novas)
      try {
        await db.transaction().execute(async (trx) => {
          const ultimo = await trx
            .selectFrom('ordensOcorrencias')
            .select((eb) => eb.fn.max('numero').as('n'))
            .where('ordemId', '=', ordemId)
            .executeTakeFirst()
          const numero = Number(ultimo?.n ?? 0) + 1
          await trx
            .insertInto('ordensOcorrencias')
            .values({
              id,
              ordemId,
              numero,
              momento: v.momento,
              categoria: v.categoria,
              texto: JSON.stringify(v.texto),
              status: 'registrada',
              criadoEm: agora,
              criadoPor: autor,
              alteradoEm: agora,
              alteradoPor: autor,
            })
            .execute()
          if (novas.length)
            await trx
              .insertInto('ordensOcorrenciasFotos')
              .values(
                novas.map((f, i) => ({
                  id: f.id,
                  ocorrenciaId: id,
                  posicao: i + 1,
                  nome: f.nome,
                  extensao: f.extensao,
                  tamanho: f.conteudo.length,
                  enviadoEm: agora,
                  enviadoPor: autor,
                })),
              )
              .execute()
          await registrarHistorico(trx, 'ordem', ordemId, {
            autor,
            em: agora,
            acao: 'ocorrencia_registrada',
            nota: `#${numero}`,
            mudancas: [
              { campo: 'momento', antes: null, depois: v.momento },
              { campo: 'categoria', antes: null, depois: v.categoria },
              { campo: 'texto', antes: null, depois: original(v.texto) },
              ...(novas.length ? [{ campo: 'fotos', antes: null, depois: novas.length }] : []),
            ],
          })
        })
      } catch (e) {
        await disco.desfazer()
        throw e
      }
      return id
    },

    async corrigir(
      ordemId: string,
      ocId: string,
      dadosBrutos: unknown,
      fotos: FotoEnviada[],
      autor: string,
    ) {
      const oc = await exigirOcorrencia(ordemId, ocId)
      if (oc.status !== 'registrada')
        throw new ErroApi(409, 'invalid_transition', 'Ocorrência cancelada não pode ser alterada.')
      const v = edicaoSchema.parse(dadosBrutos)
      const atuais = (await fotosDa([ocId])).get(ocId) ?? []
      const remover = atuais.filter((f) => v.removerFotos.includes(f.id))
      if (atuais.length - remover.length + fotos.length > MAX_FOTOS)
        throw new ErroApi(422, 'validation', `Envie até ${MAX_FOTOS} fotos por ocorrência.`)
      const novas = prepararFotos(fotos)

      const textoAntes = JSON.parse(oc.texto) as LocalizedText
      const mudancas: Mudanca[] = []
      if (oc.momento !== v.momento)
        mudancas.push({ campo: 'momento', antes: oc.momento, depois: v.momento })
      if (oc.categoria !== v.categoria)
        mudancas.push({ campo: 'categoria', antes: oc.categoria, depois: v.categoria })
      if (original(textoAntes) !== original(v.texto))
        mudancas.push({ campo: 'texto', antes: original(textoAntes), depois: original(v.texto) })
      if (remover.length || novas.length)
        mudancas.push({
          campo: 'fotos',
          antes: atuais.length,
          depois: atuais.length - remover.length + novas.length,
        })
      const textoMudou = JSON.stringify(textoAntes) !== JSON.stringify(v.texto)
      if (!mudancas.length && !textoMudou) return ocId

      const agora = new Date().toISOString()
      const disco = await gravarFotos(ordemId, novas)
      try {
        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable('ordensOcorrencias')
            .set({
              momento: v.momento,
              categoria: v.categoria,
              texto: JSON.stringify(v.texto),
              alteradoEm: agora,
              alteradoPor: autor,
            })
            .where('id', '=', ocId)
            .execute()
          if (remover.length)
            await trx
              .deleteFrom('ordensOcorrenciasFotos')
              .where(
                'id',
                'in',
                remover.map((f) => f.id),
              )
              .execute()
          // Fotos novas entram depois das que já existem.
          const ultima = await trx
            .selectFrom('ordensOcorrenciasFotos')
            .select((eb) => eb.fn.max('posicao').as('n'))
            .where('ocorrenciaId', '=', ocId)
            .executeTakeFirst()
          const ultimaPosicao = Number(ultima?.n ?? 0)
          if (novas.length)
            await trx
              .insertInto('ordensOcorrenciasFotos')
              .values(
                novas.map((f, i) => ({
                  id: f.id,
                  ocorrenciaId: ocId,
                  posicao: ultimaPosicao + i + 1,
                  nome: f.nome,
                  extensao: f.extensao,
                  tamanho: f.conteudo.length,
                  enviadoEm: agora,
                  enviadoPor: autor,
                })),
              )
              .execute()
          // Só a revisão de uma tradução (sem mudar o original) não entra no histórico.
          if (mudancas.length)
            await registrarHistorico(trx, 'ordem', ordemId, {
              autor,
              em: agora,
              acao: 'ocorrencia_editada',
              nota: `#${oc.numero}`,
              mudancas,
            })
        })
      } catch (e) {
        await disco.desfazer()
        throw e
      }
      await Promise.all(remover.map((f) => rm(caminhoFoto(ordemId, f.id), { force: true })))
      return ocId
    },

    async cancelar(ordemId: string, ocId: string, autor: string) {
      const oc = await exigirOcorrencia(ordemId, ocId)
      if (oc.status !== 'registrada')
        throw new ErroApi(409, 'invalid_transition', 'A ocorrência já está cancelada.')
      const agora = new Date().toISOString()
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable('ordensOcorrencias')
          .set({ status: 'cancelado', alteradoEm: agora, alteradoPor: autor })
          .where('id', '=', ocId)
          .execute()
        await registrarHistorico(trx, 'ordem', ordemId, {
          autor,
          em: agora,
          acao: 'ocorrencia_cancelada',
          nota: `#${oc.numero}`,
          mudancas: [{ campo: 'status', antes: 'registrada', depois: 'cancelado' }],
        })
      })
    },

    async fotoOcorrencia(ordemId: string, ocId: string, fotoId: string) {
      await exigirOcorrencia(ordemId, ocId)
      const f = await db
        .selectFrom('ordensOcorrenciasFotos')
        .selectAll()
        .where('id', '=', fotoId)
        .where('ocorrenciaId', '=', ocId)
        .executeTakeFirst()
      if (!f) throw naoEncontrado('Foto não encontrada.')
      const conteudo = await readFile(caminhoFoto(ordemId, fotoId)).catch(() => {
        throw naoEncontrado('Arquivo não encontrado no servidor.')
      })
      return { nome: f.nome, tipo: TIPOS_FOTO[f.extensao] ?? 'application/octet-stream', conteudo }
    },

    async fotoPallet(ordemId: string, palletId: string) {
      const p = await db
        .selectFrom('ordensPallets')
        .select(['numero', 'fotoExtensao'])
        .where('id', '=', palletId)
        .where('ordemId', '=', ordemId)
        .executeTakeFirst()
      if (!p?.fotoExtensao) throw naoEncontrado('Foto não encontrada.')
      const conteudo = await readFile(caminhoPallet(ordemId, palletId)).catch(() => {
        throw naoEncontrado('Arquivo não encontrado no servidor.')
      })
      return {
        nome: `pallet-${p.numero}.${p.fotoExtensao}`,
        tipo: TIPOS_FOTO[p.fotoExtensao] ?? 'application/octet-stream',
        conteudo,
      }
    },
  }
}

export type ServicoLote = ReturnType<typeof criarServicoLote>

/* ------------------------------------------------------------ rotas (montadas em /api/ordens) */

/** Imagem exibida na tela: só tipos de imagem, sem "adivinhar" o conteúdo. */
export function enviarImagem(res: Response, f: { nome: string; tipo: string; conteudo: Buffer }) {
  if (!f.tipo.startsWith('image/')) {
    res.attachment(f.nome)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(f.conteudo)
    return
  }
  res.setHeader('Content-Type', f.tipo)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'")
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.nome)}`)
  res.send(f.conteudo)
}

export function rotasLote(servico: ServicoLote, aoMudar?: (ordemId: string) => Promise<unknown>) {
  const r = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: MAX_FOTOS },
    defParamCharset: 'utf8',
  }).array('fotos', MAX_FOTOS)

  const lerDados = (body: unknown) => {
    try {
      return JSON.parse(String((body as Record<string, unknown>).dados ?? '')) as unknown
    } catch {
      throw new ErroApi(422, 'validation', 'Dados da ocorrência inválidos.')
    }
  }
  const fotosDe = (files: unknown): FotoEnviada[] =>
    ((files as Express.Multer.File[] | undefined) ?? []).map((f) => ({
      nomeOriginal: f.originalname,
      conteudo: f.buffer,
    }))
  const responder = async (res: Response, ordemId: string, status = 200) => {
    res.status(status).json(aoMudar ? await aoMudar(ordemId) : { ok: true })
  }

  r.post('/:id/ocorrencias', upload, async (req, res) => {
    const id = String(req.params.id)
    await servico.registrar(id, lerDados(req.body), fotosDe(req.files), autorDa(req))
    await responder(res, id, 201)
  })
  r.patch('/:id/ocorrencias/:oc', upload, async (req, res) => {
    const id = String(req.params.id)
    await servico.corrigir(
      id,
      String(req.params.oc),
      lerDados(req.body),
      fotosDe(req.files),
      autorDa(req),
    )
    await responder(res, id)
  })
  r.post('/:id/ocorrencias/:oc/cancelar', async (req, res) => {
    const id = String(req.params.id)
    await servico.cancelar(id, String(req.params.oc), autorDa(req))
    await responder(res, id)
  })
  r.get('/:id/ocorrencias/:oc/fotos/:foto', async (req, res) => {
    enviarImagem(
      res,
      await servico.fotoOcorrencia(
        String(req.params.id),
        String(req.params.oc),
        String(req.params.foto),
      ),
    )
  })
  r.get('/:id/pallets/:pallet/foto', async (req, res) => {
    enviarImagem(res, await servico.fotoPallet(String(req.params.id), String(req.params.pallet)))
  })
  return r
}
