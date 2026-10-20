import { cadastrosHandlers } from './cadastros'
import { clientesHandlers } from './clientes'
import { dashboardHandlers } from './dashboard'
import { estoqueHandlers } from './estoque'
import { clientesAbasHandlers } from './clientes-abas'
import { ordensHandlers } from './ordens'
import { perfilHandlers } from './perfil'
import { integracoesHandlers } from './integracoes'
import { perfisHandlers } from './perfis'
import { relacionamentoHandlers } from './relacionamento'
import { sistemaHandlers } from './sistema'
import { usuariosHandlers } from './usuarios'
import { viagensHandlers } from './viagens'

/** Todos os handlers da API simulada. Módulos novos: crie o arquivo e some aqui. */
export const handlers = [
  ...clientesAbasHandlers,
  ...clientesHandlers,
  ...relacionamentoHandlers,
  ...ordensHandlers,
  ...viagensHandlers,
  ...estoqueHandlers,
  ...cadastrosHandlers,
  ...dashboardHandlers,
  ...usuariosHandlers,
  ...perfisHandlers,
  ...integracoesHandlers,
  ...sistemaHandlers,
  ...perfilHandlers,
]
