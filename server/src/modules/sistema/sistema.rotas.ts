import { Router } from 'express'
import type { Db } from '../../db/database.js'
import { ErroApi } from '../../shared/erros.js'
import type { ServicoClientes } from '../clientes/clientes.servico.js'
import type { ServicoMotoristas } from '../motoristas/motoristas.js'
import type { ServicoTransportadoras } from '../transportadoras/transportadoras.js'
import type { ServicoUsuarios } from '../usuarios/usuarios.servico.js'
import { criarBuscaGlobal } from './busca.js'

/*
 * Serviços do shell do frontend:
 *   GET  /api/busca?q=          busca global (Ctrl+K) — todos os registros (ver busca.ts)
 *   GET  /api/notificacoes      notificações (ainda não definidas: lista vazia)
 *   POST /api/notificacoes/lidas
 *   POST|DELETE /api/perfil/foto  foto do perfil (depende do login: ainda não disponível)
 */
export function rotasSistema(
  db: Db,
  servicos: {
    usuarios: ServicoUsuarios
    clientes: ServicoClientes
    transportadoras: ServicoTransportadoras
    motoristas: ServicoMotoristas
  },
) {
  const r = Router()
  const buscar = criarBuscaGlobal(db, servicos)

  r.get('/busca', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    res.json(q.length < 2 ? [] : await buscar(q))
  })

  r.get('/notificacoes', (_req, res) => {
    res.json([])
  })

  r.post('/notificacoes/lidas', (_req, res) => {
    res.status(204).end()
  })

  r.all('/perfil/foto', () => {
    throw new ErroApi(
      501,
      'not_implemented',
      'Foto de perfil depende do login (ainda não definido).',
    )
  })

  return r
}
