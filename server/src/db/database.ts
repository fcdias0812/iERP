import SQLite from 'better-sqlite3'
import { CamelCasePlugin, Kysely, SqliteDialect } from 'kysely'
import type { Database } from './schema.js'

export type Db = Kysely<Database>

/*
 * Conexão com o banco. Hoje: SQLite (better-sqlite3).
 *
 * Para migrar para PostgreSQL, troque SÓ o dialeto (as consultas e migrations usam o
 * construtor do Kysely e tipos portáveis — ver db/schema.ts):
 *
 *   import { Pool } from 'pg'
 *   import { PostgresDialect } from 'kysely'
 *   dialect: new PostgresDialect({ pool: new Pool({ connectionString: process.env.DATABASE_URL }) })
 */
export function criarDb(arquivo: string): Db {
  const sqlite = new SQLite(arquivo)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite }),
    plugins: [new CamelCasePlugin()],
  })
}
