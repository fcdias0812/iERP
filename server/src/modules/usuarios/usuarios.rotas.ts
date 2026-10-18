import { Router } from 'express'
import { autorDa } from '../../shared/autor.js'
import { lerConsulta } from '../../shared/consulta-tabela.js'
import { COLUNAS_USUARIO } from './usuarios.regras.js'
import type { ServicoUsuarios } from './usuarios.servico.js'

/*
 * API de usuários (montada em /api/usuarios):
 *   GET  /resumo           indicadores (total, ativos, bloqueados, inativos)
 *   GET  /                 lista (q, s, f, a, p, ps — formato do DataTable)
 *   GET  /:id              detalhe com histórico e ações permitidas
 *   POST /                 cria (201)
 *   PUT  /:id              edita (nome, e-mail, perfil)
 *   POST /:id/transicao    { acao, motivo? } — bloquear, desbloquear, inativar, reativar
 */
export function rotasUsuarios(servico: ServicoUsuarios) {
  const r = Router()

  r.get('/resumo', async (_req, res) => {
    res.json(await servico.resumo())
  })

  r.get('/', async (req, res) => {
    res.json(await servico.listar(lerConsulta(req.query, COLUNAS_USUARIO)))
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
