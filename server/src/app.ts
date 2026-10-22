import express from 'express'
import { config } from './config.js'
import type { Db } from './db/database.js'
import { criarServicoConfiguracoes } from './modules/clientes/clientes-configuracoes.js'
import { criarServicoDocumentos } from './modules/clientes/clientes-documentos.servico.js'
import { criarServicoRastreio, rotasRastreioPublico } from './modules/clientes/clientes-rastreio.js'
import { criarRepositorioSites } from './modules/clientes/clientes-sites.repositorio.js'
import { criarServicoSites } from './modules/clientes/clientes-sites.servico.js'
import { rotasGeo } from './modules/geo/geo.rotas.js'
import { criarServicoMotoristas, rotasMotoristas } from './modules/motoristas/motoristas.js'
import { criarServicoOrdens, rotasOrdens } from './modules/ordens/ordens.js'
import { criarServicoDashboard, rotasDashboard } from './modules/dashboard/dashboard.js'
import { criarServicoHistorico, rotasHistorico } from './modules/historico/historico.js'
import { criarServicoCadastros, rotasCadastro } from './modules/cadastros/cadastros.js'
import { criarServicoPerfis, rotasPerfis } from './modules/perfis/perfis.js'
import { criarServicoAuditoria, rotasAuditoria } from './modules/auditoria/auditoria.js'
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
import { rotasContratoIntegracao } from './modules/integracao/contrato.rotas.js'
import { rotasLotesDeFora } from './modules/integracao/gerenciamento.js'
import { criarServicoIntegracoes, rotasIntegracoes } from './modules/integracao/integracao.js'
import {
  criarServicoViagens,
  rotasViagens,
  type ServicoViagens,
} from './modules/viagens/viagens.js'
import {
  criarServicoEstoque,
  rotasEstoque,
  type ServicoEstoque,
} from './modules/estoque/estoque.js'
import { rotaInexistente, tratarErros } from './shared/erros.js'

/**
 * Aplicação Express (sem abrir porta — usada pelo index.ts e pelos testes).
 * Cada módulo: repositório (banco) → serviço (regras) → rotas (HTTP).
 */
export function criarApp(
  db: Db,
  opcoes: {
    arquivosDir?: string
    geo?: ServicoGeo
    fetchExterno?: typeof fetch
    /** Ordens › Viagens — o index.ts passa o MESMO serviço que escuta o rastreador ao vivo. */
    viagens?: ServicoViagens
    /** Estoque — os testes passam o deles (sem a espera do "Atualizar"). */
    estoque?: ServicoEstoque
  } = {},
) {
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
  const viagens = opcoes.viagens ?? criarServicoViagens(db, { fetch: opcoes.fetchExterno })
  const ordens = criarServicoOrdens(db, {
    pasta: opcoes.arquivosDir ?? config.arquivosDir,
    viagens,
  })
  const cadastros = criarServicoCadastros(db)

  const api = express.Router()
  api.get('/saude', (_req, res) => {
    res.json({ ok: true })
  })
  api.use('/usuarios', rotasUsuarios(usuarios))
  const rastreio = criarServicoRastreio(db, repoClientes)
  api.use(
    '/clientes',
    rotasClientes(
      clientes,
      sites,
      documentos,
      criarServicoConfiguracoes(db, repoClientes),
      rastreio,
    ),
  )
  // Página PÚBLICA do cliente (link de acompanhamento) — fica fora do login quando ele existir.
  api.use('/publico/rastreio', rotasRastreioPublico(rastreio))
  api.use('/geo', rotasGeo(geo))
  api.use('/transportadoras', rotasTransportadoras(transportadoras))
  api.use('/motoristas', rotasMotoristas(motoristas))
  api.use('/veiculos', rotasVeiculos(veiculos))
  api.use('/ordens', rotasOrdens(ordens))
  // Lote que veio de outro sistema: o espelho do que aconteceu lá (Gerenciamento de Projetos).
  api.use('/ordens', rotasLotesDeFora(db, opcoes.fetchExterno))
  api.use('/viagens', rotasViagens(viagens, opcoes.fetchExterno))
  api.use(
    '/estoque',
    rotasEstoque(opcoes.estoque ?? criarServicoEstoque(db, { fetch: opcoes.fetchExterno })),
  )
  api.use('/dashboard', rotasDashboard(criarServicoDashboard(db)))
  api.use('/historico', rotasHistorico(criarServicoHistorico(db)))
  api.use('/materiais', rotasCadastro(cadastros.materiais))
  api.use('/areas', rotasCadastro(cadastros.areas))
  api.use('/recipientes', rotasCadastro(cadastros.recipientes, 'tipo'))
  api.use('/perfis', rotasPerfis(criarServicoPerfis(db)))
  api.use('/auditoria', rotasAuditoria(criarServicoAuditoria(db)))
  api.use('/integracoes', rotasIntegracoes(criarServicoIntegracoes(db)))
  // Contrato com os sistemas de fora (o mesmo do iERP antigo): autenticado por X-Api-Key.
  api.use(
    '/integracao/v1',
    rotasContratoIntegracao(db, (ordemId, anexoId) => ordens.arquivo(ordemId, anexoId)),
  )
  api.use(rotasSistema(db, { usuarios, clientes, transportadoras, motoristas }))
  api.use(rotaInexistente)

  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))
  app.use('/api', api)
  app.use(tratarErros)
  return app
}
