import express from 'express'
import { config } from './config.js'
import type { Db } from './db/database.js'
import { criarServicoDocumentos } from './modules/clientes/clientes-documentos.servico.js'
import { criarRepositorioSites } from './modules/clientes/clientes-sites.repositorio.js'
import { criarServicoSites } from './modules/clientes/clientes-sites.servico.js'
import { rotasGeo } from './modules/geo/geo.rotas.js'
import { criarServicoMotoristas, rotasMotoristas } from './modules/motoristas/motoristas.js'
import { criarServicoOrdens, rotasOrdens } from './modules/ordens/ordens.js'
import { criarServicoDashboard, rotasDashboard } from './modules/dashboard/dashboard.js'
import { criarServicoHistorico, rotasHistorico } from './modules/historico/historico.js'
import {
  criarServicoTransportadoras,
  rotasTransportadoras,
} from './modules/transportadoras/transportadoras.js'
import { criarServicoVeiculos, rotasVeiculos } from './modules/veiculos/veiculos.js'
import { criarServicoGeo, type ServicoGeo } from './modules/geo/geo.servico.js'
import { criarRepositorioClientes } from './modules/clientes/clientes.repositorio.js'
import { rotasClientes } from './modules/clientes/clientes.rotas.js'
import { criarServicoClientes } from './modules/clientes/clientes.servico.js'
import { criarRepositorioUsuarios } from './modules/usuarios/usuarios.repositorio.js'
import { rotasUsuarios } from './modules/usuarios/usuarios.rotas.js'
import { criarServicoUsuarios } from './modules/usuarios/usuarios.servico.js'
import { rotasSistema } from './modules/sistema/sistema.rotas.js'
import { rotaInexistente, tratarErros } from './shared/erros.js'

/**
 * Aplicação Express (sem abrir porta — usada pelo index.ts e pelos testes).
 * Cada módulo: repositório (banco) → serviço (regras) → rotas (HTTP).
 */
export function criarApp(db: Db, opcoes: { arquivosDir?: string; geo?: ServicoGeo } = {}) {
  const usuarios = criarServicoUsuarios(criarRepositorioUsuarios(db))
  const repoClientes = criarRepositorioClientes(db)
  const clientes = criarServicoClientes(repoClientes)
  const sites = criarServicoSites(criarRepositorioSites(db), repoClientes)
  const documentos = criarServicoDocumentos(db, repoClientes, {
    pasta: opcoes.arquivosDir ?? config.arquivosDir,
  })
  const geo = opcoes.geo ?? criarServicoGeo({ contato: config.geoContato })
  const transportadoras = criarServicoTransportadoras(db)
  const motoristas = criarServicoMotoristas(db)
  const veiculos = criarServicoVeiculos(db)
  const ordens = criarServicoOrdens(db, { pasta: opcoes.arquivosDir ?? config.arquivosDir })

  const api = express.Router()
  api.get('/saude', (_req, res) => {
    res.json({ ok: true })
  })
  api.use('/usuarios', rotasUsuarios(usuarios))
  api.use('/clientes', rotasClientes(clientes, sites, documentos))
  api.use('/geo', rotasGeo(geo))
  api.use('/transportadoras', rotasTransportadoras(transportadoras))
  api.use('/motoristas', rotasMotoristas(motoristas))
  api.use('/veiculos', rotasVeiculos(veiculos))
  api.use('/ordens', rotasOrdens(ordens))
  api.use('/dashboard', rotasDashboard(criarServicoDashboard(db)))
  api.use('/historico', rotasHistorico(criarServicoHistorico(db)))
  api.use(rotasSistema({ usuarios, clientes, transportadoras, motoristas }))
  api.use(rotaInexistente)

  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))
  app.use('/api', api)
  app.use(tratarErros)
  return app
}
