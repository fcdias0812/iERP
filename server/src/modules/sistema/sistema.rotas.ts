import { Router } from 'express'
import { ErroApi } from '../../shared/erros.js'
import type { ServicoUsuarios } from '../usuarios/usuarios.servico.js'

/*
 * Serviços do shell do frontend:
 *   GET  /api/busca?q=          busca global (Ctrl+K) — por enquanto, usuários
 *   GET  /api/notificacoes      notificações (ainda não definidas: lista vazia)
 *   POST /api/notificacoes/lidas
 *   POST|DELETE /api/perfil/foto  foto do perfil (depende do login: ainda não disponível)
 */
export function rotasSistema(usuarios: ServicoUsuarios) {
  const r = Router()

  r.get('/busca', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (q.length < 2) {
      res.json([])
      return
    }
    const encontrados = await usuarios.buscar(q)
    res.json(
      encontrados.map((u) => ({
        tipo: 'usuario',
        id: u.id,
        codigo: u.codigo,
        titulo: u.nome,
        rota: `/admin/usuarios/${u.id}`,
      })),
    )
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
