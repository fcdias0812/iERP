import { perfilHandlers } from './perfil'
import { sistemaHandlers } from './sistema'
import { usuariosHandlers } from './usuarios'

/** Todos os handlers da API simulada. Módulos novos: crie o arquivo e some aqui. */
export const handlers = [...usuariosHandlers, ...sistemaHandlers, ...perfilHandlers]
