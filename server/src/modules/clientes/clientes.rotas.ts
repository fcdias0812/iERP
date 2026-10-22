import { Router } from 'express'
import multer from 'multer'
import { autorDa } from '../../shared/autor.js'
import { lerConsulta } from '../../shared/consulta-tabela.js'
import { MAX_BYTES, type ServicoDocumentos } from './clientes-documentos.servico.js'
import type { ServicoConfiguracoes } from './clientes-configuracoes.js'
import type { ServicoSites } from './clientes-sites.servico.js'
import { COLUNAS_CLIENTE } from './clientes.regras.js'
import type { ServicoClientes } from './clientes.servico.js'
import type { LotesResumoCliente } from './clientes.types.js'

/*
 * API de clientes (montada em /api/clientes):
 *   GET  /resumo           indicadores (total, ativos, inativos)
 *   GET  /                 lista (q, s, f, a, p, ps — formato do DataTable)
 *   GET  /:id              detalhe com contatos, histórico e ações permitidas
 *   POST /                 cria (201) — nome, cnpj, contatos (um principal)
 *   PUT  /:id              edita (substitui os contatos)
 *   POST /:id/transicao    { acao } — inativar, reativar
 *   PUT  /:id/configuracoes  aba Configurações (rastreio, agendamento, recebimento, prazos)
 *
 *   GET    /:id/lotes/resumo            lotes a chegar / em operação / finalizados + últimos 5
 *   GET    /:id/sites                   sites com docas e responsável
 *   POST   /:id/sites                   cria site (responsável existente ou contato novo)
 *   PUT    /:id/sites/:siteId           edita site e docas
 *   DELETE /:id/sites/:siteId           remove site
 *   GET    /:id/documentos              lista
 *   POST   /:id/documentos              envia (multipart: arquivo + tipo), até 25 MB
 *   GET    /:id/documentos/:docId/arquivo  baixa (sempre como anexo)
 *   DELETE /:id/documentos/:docId       remove
 */
export function rotasClientes(
  servico: ServicoClientes,
  sites: ServicoSites,
  documentos: ServicoDocumentos,
  configuracoes: ServicoConfiguracoes,
) {
  const r = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
    // Nome do arquivo com acento chega certo.
    defParamCharset: 'utf8',
  }).single('arquivo')

  r.get('/resumo', async (_req, res) => {
    res.json(await servico.resumo())
  })

  r.get('/', async (req, res) => {
    res.json(await servico.listar(lerConsulta(req.query, COLUNAS_CLIENTE)))
  })

  r.get('/:id', async (req, res) => {
    res.json(await servico.obter(req.params.id))
  })

  r.post('/', async (req, res) => {
    res.status(201).json(await servico.criar(req.body, autorDa(req)))
  })

  r.put('/:id', async (req, res) => {
    res.json(await servico.atualizar(req.params.id, req.body, autorDa(req)))
  })

  r.post('/:id/transicao', async (req, res) => {
    res.json(await servico.transicionar(req.params.id, req.body, autorDa(req)))
  })

  r.put('/:id/configuracoes', async (req, res) => {
    res.json(await configuracoes.salvar(req.params.id, req.body, autorDa(req)))
  })

  /* ---------------- visão geral: lotes */

  r.get('/:id/lotes/resumo', async (req, res) => {
    await servico.obter(req.params.id)
    // Os lotes vêm dos sistemas de produção; a integração ainda não está ligada.
    const body: LotesResumoCliente = {
      conectado: false,
      aChegar: 0,
      emOperacao: 0,
      finalizados: 0,
      ultimos: [],
    }
    res.json(body)
  })

  /* ---------------- logística: sites e docas */

  r.get('/:id/sites', async (req, res) => {
    res.json(await sites.listar(req.params.id))
  })

  r.post('/:id/sites', async (req, res) => {
    res.status(201).json(await sites.criar(req.params.id, req.body, autorDa(req)))
  })

  r.put('/:id/sites/:siteId', async (req, res) => {
    res.json(await sites.atualizar(req.params.id, req.params.siteId, req.body, autorDa(req)))
  })

  r.delete('/:id/sites/:siteId', async (req, res) => {
    await sites.remover(req.params.id, req.params.siteId, autorDa(req))
    res.status(204).end()
  })

  /* ---------------- documentos */

  r.get('/:id/documentos', async (req, res) => {
    res.json(await documentos.listar(req.params.id))
  })

  r.post('/:id/documentos', upload, async (req, res) => {
    const doc = await documentos.adicionar(
      String(req.params.id),
      req.file ? { nomeOriginal: req.file.originalname, conteudo: req.file.buffer } : undefined,
      req.body?.tipo,
      autorDa(req),
    )
    res.status(201).json(doc)
  })

  r.get('/:id/documentos/:docId/arquivo', async (req, res) => {
    const a = await documentos.arquivo(req.params.id, req.params.docId)
    res.setHeader('Content-Type', a.tipoConteudo)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.attachment(a.nome)
    res.send(a.conteudo)
  })

  r.delete('/:id/documentos/:docId', async (req, res) => {
    await documentos.remover(req.params.id, req.params.docId, autorDa(req))
    res.status(204).end()
  })

  return r
}
