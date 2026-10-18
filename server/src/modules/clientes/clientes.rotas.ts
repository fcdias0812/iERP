import { Router } from 'express'
import { autorDa } from '../../shared/autor.js'
import { lerConsulta } from '../../shared/consulta-tabela.js'
import { COLUNAS_CLIENTE } from './clientes.regras.js'
import type { ServicoClientes } from './clientes.servico.js'

/*
 * API de clientes (montada em /api/clientes):
 *   GET  /resumo           indicadores (total, ativos, inativos)
 *   GET  /                 lista (q, s, f, a, p, ps — formato do DataTable)
 *   GET  /:id              detalhe com contatos, histórico e ações permitidas
 *   POST /                 cria (201) — nome, cnpj, contatos (um principal)
 *   PUT  /:id              edita (substitui os contatos)
 *   POST /:id/transicao    { acao } — inativar, reativar
 */
export function rotasClientes(servico: ServicoClientes) {
  const r = Router()

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

  return r
}
