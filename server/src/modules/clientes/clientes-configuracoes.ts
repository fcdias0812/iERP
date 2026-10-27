import type { Selectable } from 'kysely'
import { z } from 'zod'
import type { Db } from '../../db/database.js'
import type { ClientesTable } from '../../db/schema.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { Mudanca } from '../../shared/historico.js'
import { DESTINOS } from '../integracao/destinos.js'
import type { ServicosOs } from '../ordens/ordens.calculo.js'
import { original, textoTraduzidoSchema, type LocalizedText } from '../ordens/ordens.lote.js'
import type { RepositorioClientes } from './clientes.repositorio.js'
import type { ConfiguracoesCliente } from './clientes.types.js'
import {
  gravarMarcas,
  marcasSchema,
  tiposDoCliente,
  type TipoDoCliente,
} from './tipos-documento.js'

/*
 * Clientes › Configurações (pedido do usuário, 22/10/2026: switches do rastreio da coleta e "mais
 * opções úteis"; ele escolheu todas as propostas, menos "exigir código de chegada"):
 *  - rastreio: toda coleta rastreada ou não; exceção (quem agenda muda só aquela coleta); motorista
 *    e placa obrigatórios na coleta rastreada;
 *  - agendamento: serviços e transportadora que já vêm escolhidos, instruções do cliente (3
 *    idiomas), escopo em planilha .xlsx obrigatório;
 *  - recebimento: lacre, nota fiscal, tara de cada pallet e fotos gerais obrigatórios;
 *  - prazos: sistema que processa os lotes (antes era o nome "Dell"), SLA, dias parado na etapa
 *    até virar anomalia, antecedência mínima (só avisa) e bloqueio de novos agendamentos.
 * O Agendamento (`ordens.ts`) e o Recebimento (`ordens.recebimento.ts`) conferem as regras.
 *
 *   PUT /api/clientes/:id/configuracoes   grava tudo (histórico com o que mudou)
 */

export const SERVICOS: (keyof ServicosOs)[] = [
  'psm',
  'onsiteShredding',
  'recycleOnly',
  'valueRecoveryRacks',
  'valueRecoveryItad',
]

/** Os sistemas de fora que processam lotes (hoje só o MoonShot). */
export const SISTEMAS_PROCESSAMENTO = DESTINOS.map((d) => d.sistema)

const dias = (max: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .nullish()
    .transform((v) => v ?? null)

export const configuracoesSchema = z
  .object({
    rastrearColeta: z.boolean(),
    rastreioExcecao: z.boolean(),
    exigirMotoristaPlaca: z.boolean(),
    servicosPadrao: z
      .object({
        psm: z.boolean(),
        onsiteShredding: z.boolean(),
        recycleOnly: z.boolean(),
        valueRecoveryRacks: z.boolean(),
        valueRecoveryItad: z.boolean(),
      })
      .nullish()
      .transform((v) => v ?? null),
    transportadoraPadraoId: z
      .string()
      .nullish()
      .transform((v) => v || null),
    instrucoes: textoTraduzidoSchema.nullish().transform((v) => (v && original(v) ? v : null)),
    exigirEscopoPlanilha: z.boolean(),
    exigirLacre: z.boolean(),
    exigirNota: z.boolean(),
    exigirTara: z.boolean(),
    exigirFotosGerais: z.boolean(),
    sistemaProcessamento: z
      .string()
      .nullish()
      .transform((v) => v || null)
      .refine((v) => v === null || SISTEMAS_PROCESSAMENTO.includes(v), 'Sistema desconhecido.'),
    slaDias: dias(3650),
    diasParadoEtapa: dias(365),
    antecedenciaDias: dias(365),
    agendamentoBloqueado: z.boolean(),
    bloqueioMotivo: z
      .string()
      .trim()
      .max(500)
      .nullish()
      .transform((v) => v || null),
    /** Tipos de documento do lote: aceita / vai no relatório final (ausente = não muda). */
    documentos: marcasSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.agendamentoBloqueado && !v.bloqueioMotivo)
      ctx.addIssue({
        code: 'custom',
        path: ['bloqueioMotivo'],
        message: 'Informe o motivo do bloqueio.',
      })
  })
  // Desbloqueado não guarda motivo.
  .transform((v) => ({ ...v, bloqueioMotivo: v.agendamentoBloqueado ? v.bloqueioMotivo : null }))

type Linha = Selectable<ClientesTable>
const json = <T>(v: string | null) => (v ? (JSON.parse(v) as T) : null)

/** As configurações gravadas no cliente. */
export function configuracoesDa(
  l: Linha,
  transportadoraNome: string | null,
  documentos: TipoDoCliente[] = [],
): ConfiguracoesCliente {
  return {
    rastrearColeta: l.rastrearColeta === 1,
    rastreioExcecao: l.rastreioExcecao === 1,
    exigirMotoristaPlaca: l.exigirMotoristaPlaca === 1,
    servicosPadrao: json<ServicosOs>(l.servicosPadrao),
    transportadoraPadraoId: l.transportadoraPadraoId,
    transportadoraPadraoNome: l.transportadoraPadraoId ? transportadoraNome : null,
    instrucoes: json<LocalizedText>(l.instrucoes),
    exigirEscopoPlanilha: l.exigirEscopoPlanilha === 1,
    exigirLacre: l.exigirLacre === 1,
    exigirNota: l.exigirNota === 1,
    exigirTara: l.exigirTara === 1,
    exigirFotosGerais: l.exigirFotosGerais === 1,
    sistemaProcessamento: l.sistemaProcessamento,
    slaDias: l.slaDias,
    diasParadoEtapa: l.diasParadoEtapa,
    antecedenciaDias: l.antecedenciaDias,
    agendamentoBloqueado: l.agendamentoBloqueado === 1,
    bloqueioMotivo: l.bloqueioMotivo,
    documentos,
  }
}

/** As configurações de um cliente (para o Agendamento e o Recebimento conferirem). */
export async function configuracoesDoCliente(db: Db, clienteId: string) {
  const l = await db
    .selectFrom('clientes')
    .selectAll()
    .where('id', '=', clienteId)
    .executeTakeFirst()
  return l ? configuracoesDa(l, null, await tiposDoCliente(db, clienteId)) : null
}

/** Serviços em texto para o histórico ("III, IV"). */
const ROMANOS = ['I', 'II', 'III', 'IV', 'V']
const servicosEmTexto = (s: ServicosOs | null) =>
  s ? SERVICOS.flatMap((k, i) => (s[k] ? [ROMANOS[i]!] : [])).join(', ') : null

export function criarServicoConfiguracoes(db: Db, repo: RepositorioClientes) {
  return {
    async salvar(id: string, corpo: unknown, autor: string) {
      const v = configuracoesSchema.parse(corpo)
      await repo.transacao(async (trx) => {
        const linha = await trx
          .selectFrom('clientes')
          .selectAll()
          .where('id', '=', id)
          .executeTakeFirst()
        if (!linha) throw naoEncontrado('Cliente não encontrado.')
        const nomeDa = async (tid: string | null) =>
          tid
            ? ((
                await trx
                  .selectFrom('transportadoras')
                  .select('nome')
                  .where('id', '=', tid)
                  .executeTakeFirst()
              )?.nome ?? null)
            : null
        const nomeNovo = await nomeDa(v.transportadoraPadraoId)
        if (v.transportadoraPadraoId && !nomeNovo)
          throw new ErroApi(422, 'validation', 'Transportadora não encontrada.')
        const docsAntes = await tiposDoCliente(trx, id)
        const atual = configuracoesDa(linha, await nomeDa(linha.transportadoraPadraoId), docsAntes)

        // Histórico: antes → depois só do que mudou (serviços, instruções e transportadora em texto).
        const comparavel = (
          c: Omit<ConfiguracoesCliente, 'transportadoraPadraoNome' | 'documentos'> & {
            documentos?: unknown
          },
          nome: string | null,
        ) => ({
          ...c,
          documentos: undefined,
          servicosPadrao: servicosEmTexto(c.servicosPadrao),
          instrucoes: c.instrucoes ? original(c.instrucoes) : null,
          transportadoraPadraoId: nome,
        })
        const antes = comparavel(atual, atual.transportadoraPadraoNome)
        const depois = comparavel(v, nomeNovo)
        const mudancas: Mudanca[] = (Object.keys(depois) as (keyof typeof depois)[])
          .filter((k) => k !== 'documentos' && antes[k] !== depois[k])
          .map((k) => ({
            campo: k === 'transportadoraPadraoId' ? 'transportadoraPadrao' : k,
            antes: (antes[k] ?? null) as Mudanca['antes'],
            depois: (depois[k] ?? null) as Mudanca['depois'],
          }))
        // Tipos de documento: os aceitos e os do relatório final (códigos — a tela traduz).
        if (v.documentos) {
          const lista = (
            f: (d: { tipo: string; aceita: boolean; relatorio: boolean }) => boolean,
            l: { tipo: string; aceita: boolean; relatorio: boolean }[],
          ) =>
            l
              .filter(f)
              .map((d) => d.tipo)
              .join(', ') || null
          const antesDocs = docsAntes.map((d) => ({
            tipo: d.codigo,
            aceita: d.aceita,
            relatorio: d.relatorio,
          }))
          const depoisDocs = v.documentos.map((d) => ({
            ...d,
            aceita: d.tipo === 'escopo' || d.aceita,
            relatorio: (d.tipo === 'escopo' || d.aceita) && d.relatorio,
          }))
          for (const [campo, f] of [
            ['documentosAceitos', (d: { aceita: boolean }) => d.aceita],
            ['documentosRelatorio', (d: { relatorio: boolean }) => d.relatorio],
          ] as const) {
            const a = lista(f, antesDocs)
            const b = lista(f, depoisDocs)
            if (a !== b) mudancas.push({ campo, antes: a, depois: b })
          }
          await gravarMarcas(trx, id, v.documentos)
        }
        const instrucoes = v.instrucoes ? JSON.stringify(v.instrucoes) : null
        // Instruções com a mesma frase original, mas tradução revisada, também gravam.
        if (!mudancas.length && instrucoes === linha.instrucoes) return

        const agora = new Date().toISOString()
        const n = (b: boolean) => (b ? 1 : 0)
        await repo.atualizar(trx, id, {
          rastrearColeta: n(v.rastrearColeta),
          rastreioExcecao: n(v.rastreioExcecao),
          exigirMotoristaPlaca: n(v.exigirMotoristaPlaca),
          servicosPadrao: v.servicosPadrao ? JSON.stringify(v.servicosPadrao) : null,
          transportadoraPadraoId: v.transportadoraPadraoId,
          instrucoes,
          exigirEscopoPlanilha: n(v.exigirEscopoPlanilha),
          exigirLacre: n(v.exigirLacre),
          exigirNota: n(v.exigirNota),
          exigirTara: n(v.exigirTara),
          exigirFotosGerais: n(v.exigirFotosGerais),
          sistemaProcessamento: v.sistemaProcessamento,
          slaDias: v.slaDias,
          diasParadoEtapa: v.diasParadoEtapa,
          antecedenciaDias: v.antecedenciaDias,
          agendamentoBloqueado: n(v.agendamentoBloqueado),
          bloqueioMotivo: v.bloqueioMotivo,
          alteradoEm: agora,
          alteradoPor: autor,
        })
        if (mudancas.length)
          await repo.registrarHistorico(trx, id, {
            autor,
            em: agora,
            acao: 'configurado',
            mudancas,
          })
      })
      return (await repo.obter(id))!
    },
  }
}

export type ServicoConfiguracoes = ReturnType<typeof criarServicoConfiguracoes>
