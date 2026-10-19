import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { EXTENSOES, extensaoDe, nomeSeguro } from '../../shared/arquivos.js'
import type { Db } from '../../db/database.js'
import { ErroApi, naoEncontrado } from '../../shared/erros.js'
import type { RepositorioClientes } from './clientes.repositorio.js'
import type { DocumentoCliente, TipoDocumento } from './clientes.types.js'

/*
 * Clientes › Documentos. O arquivo fica em disco (`ARQUIVOS_DIR/clientes/<cliente>/<id>`, sem
 * extensão — nunca é executado nem servido como página) e os dados no banco.
 * Download sempre como anexo, com o tipo do arquivo pela extensão permitida.
 */

export const TIPOS_DOCUMENTO: TipoDocumento[] = ['contrato', 'fiscal', 'licenca', 'outro']

export { MAX_BYTES } from '../../shared/arquivos.js'

export function criarServicoDocumentos(
  db: Db,
  clientes: RepositorioClientes,
  opcoes: { pasta: string },
) {
  const caminho = (clienteId: string, docId: string) =>
    path.join(opcoes.pasta, 'clientes', clienteId, docId)

  async function garantirCliente(clienteId: string) {
    if (!(await clientes.obter(clienteId))) throw naoEncontrado('Cliente não encontrado.')
  }

  async function obterOuFalhar(clienteId: string, docId: string) {
    const doc = await db
      .selectFrom('clientesDocumentos')
      .selectAll()
      .where('id', '=', docId)
      .where('clienteId', '=', clienteId)
      .executeTakeFirst()
    if (!doc) throw naoEncontrado('Documento não encontrado.')
    return doc
  }

  const paraDocumento = (d: Awaited<ReturnType<typeof obterOuFalhar>>): DocumentoCliente => ({
    id: d.id,
    tipo: d.tipo as TipoDocumento,
    nome: d.nome,
    extensao: d.extensao,
    tamanho: d.tamanho,
    enviadoEm: d.enviadoEm,
    enviadoPor: d.enviadoPor,
  })

  return {
    async listar(clienteId: string): Promise<DocumentoCliente[]> {
      await garantirCliente(clienteId)
      const docs = await db
        .selectFrom('clientesDocumentos')
        .selectAll()
        .where('clienteId', '=', clienteId)
        .orderBy('enviadoEm', 'desc')
        .execute()
      return docs.map(paraDocumento)
    },

    async adicionar(
      clienteId: string,
      arquivo: { nomeOriginal: string; conteudo: Buffer } | undefined,
      tipoBruto: unknown,
      autor: string,
    ): Promise<DocumentoCliente> {
      await garantirCliente(clienteId)
      if (!arquivo) throw new ErroApi(422, 'validation', 'Envie um arquivo.')
      const tipo = String(tipoBruto ?? '') as TipoDocumento
      if (!TIPOS_DOCUMENTO.includes(tipo))
        throw new ErroApi(422, 'validation', 'Tipo de documento inválido.')
      const nome = nomeSeguro(arquivo.nomeOriginal)
      const extensao = extensaoDe(nome)
      if (!EXTENSOES[extensao])
        throw new ErroApi(415, 'file_type_not_allowed', 'Tipo de arquivo não permitido.', {
          permitidas: Object.keys(EXTENSOES),
        })
      if (!arquivo.conteudo.length) throw new ErroApi(422, 'validation', 'O arquivo está vazio.')

      const id = randomUUID()
      const destino = caminho(clienteId, id)
      await mkdir(path.dirname(destino), { recursive: true })
      await writeFile(destino, arquivo.conteudo)
      const agora = new Date().toISOString()
      try {
        await clientes.transacao(async (trx) => {
          await trx
            .insertInto('clientesDocumentos')
            .values({
              id,
              clienteId,
              tipo,
              nome,
              extensao,
              tamanho: arquivo.conteudo.length,
              enviadoEm: agora,
              enviadoPor: autor,
            })
            .execute()
          await clientes.registrarHistorico(trx, clienteId, {
            autor,
            em: agora,
            acao: 'documento_adicionado',
            nota: nome,
            mudancas: [{ campo: 'tipoDocumento', antes: null, depois: tipo }],
          })
        })
      } catch (e) {
        // Banco falhou: não deixa arquivo órfão no disco.
        await rm(destino, { force: true })
        throw e
      }
      return paraDocumento(await obterOuFalhar(clienteId, id))
    },

    /** Conteúdo para download. */
    async arquivo(clienteId: string, docId: string) {
      const doc = await obterOuFalhar(clienteId, docId)
      const conteudo = await readFile(caminho(clienteId, docId)).catch(() => {
        throw naoEncontrado('Arquivo não encontrado no servidor.')
      })
      return {
        nome: doc.nome,
        tipoConteudo: EXTENSOES[doc.extensao] ?? 'application/octet-stream',
        conteudo,
      }
    },

    async remover(clienteId: string, docId: string, autor: string) {
      const doc = await obterOuFalhar(clienteId, docId)
      await clientes.transacao(async (trx) => {
        await trx.deleteFrom('clientesDocumentos').where('id', '=', docId).execute()
        await clientes.registrarHistorico(trx, clienteId, {
          autor,
          em: new Date().toISOString(),
          acao: 'documento_removido',
          nota: doc.nome,
          mudancas: [{ campo: 'tipoDocumento', antes: doc.tipo, depois: null }],
        })
      })
      await rm(caminho(clienteId, docId), { force: true })
    },
  }
}

export type ServicoDocumentos = ReturnType<typeof criarServicoDocumentos>
