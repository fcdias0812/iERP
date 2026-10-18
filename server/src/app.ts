import express from 'express'
import type { Db } from './db/database.js'
import { criarRepositorioUsuarios } from './modules/usuarios/usuarios.repositorio.js'
import { rotasUsuarios } from './modules/usuarios/usuarios.rotas.js'
import { criarServicoUsuarios } from './modules/usuarios/usuarios.servico.js'
import { rotasSistema } from './modules/sistema/sistema.rotas.js'
import { rotaInexistente, tratarErros } from './shared/erros.js'

/**
 * Aplicação Express (sem abrir porta — usada pelo index.ts e pelos testes).
 * Cada módulo: repositório (banco) → serviço (regras) → rotas (HTTP).
 */
export function criarApp(db: Db) {
  const usuarios = criarServicoUsuarios(criarRepositorioUsuarios(db))

  const api = express.Router()
  api.get('/saude', (_req, res) => {
    res.json({ ok: true })
  })
  api.use('/usuarios', rotasUsuarios(usuarios))
  api.use(rotasSistema(usuarios))
  api.use(rotaInexistente)

  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))
  app.use('/api', api)
  app.use(tratarErros)
  return app
}
