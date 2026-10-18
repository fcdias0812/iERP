/*
 * Tipos das tabelas para o Kysely (nomes em camelCase no código; o CamelCasePlugin
 * converte para snake_case no banco).
 *
 * Convenções PORTÁVEIS (SQLite hoje, PostgreSQL depois):
 *  - datas/horas: texto ISO 8601 em UTC (`new Date().toISOString()`);
 *  - sim/não: inteiro 0/1;
 *  - listas/objetos: texto JSON;
 *  - ids: texto (UUID).
 */

export interface UsuariosTable {
  id: string
  /** Sequencial que gera o código (USR-00001). */
  numero: number
  codigo: string
  nome: string
  /** Sempre em minúsculas (único). */
  email: string
  perfil: string
  status: string
  ultimoAcesso: string | null
  /** Nome + e-mail + código sem acento e em minúsculas (busca geral). */
  busca: string
  criadoEm: string
  criadoPor: string
  alteradoEm: string
  alteradoPor: string
}

export interface UsuariosHistoricoTable {
  id: string
  usuarioId: string
  autor: string
  em: string
  acao: string
  /** JSON: [{ campo, antes, depois }]. */
  mudancas: string | null
  nota: string | null
}

export interface Database {
  usuarios: UsuariosTable
  usuariosHistorico: UsuariosHistoricoTable
}
