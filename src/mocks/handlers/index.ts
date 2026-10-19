import { clientesHandlers } from './clientes'
import { clientesAbasHandlers } from './clientes-abas'
import { ordensHandlers } from './ordens'
import { perfilHandlers } from './perfil'
import { relacionamentoHandlers } from './relacionamento'
import { sistemaHandlers } from './sistema'
import { usuariosHandlers } from './usuarios'

/** Todos os handlers da API simulada. Módulos novos: crie o arquivo e some aqui. */
export const handlers = [
  ...clientesAbasHandlers,
  ...clientesHandlers,
  ...relacionamentoHandlers,
  ...ordensHandlers,
  ...usuariosHandlers,
  ...sistemaHandlers,
  ...perfilHandlers,
]
