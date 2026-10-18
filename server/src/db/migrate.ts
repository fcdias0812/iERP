import { Migrator } from 'kysely/migration'
import type { Db } from './database.js'
import { migrations } from './migrations/index.js'

/** Aplica as migrations pendentes. Lança erro se alguma falhar. */
export async function migrarParaUltima(db: Db) {
  const migrator = new Migrator({
    // Sem o CamelCasePlugin: as migrations e as tabelas de controle usam os nomes reais.
    db: db.withoutPlugins(),
    provider: { getMigrations: async () => migrations },
  })
  const { error, results } = await migrator.migrateToLatest()
  if (error) throw error
  return (results ?? []).filter((r) => r.status === 'Success').map((r) => r.migrationName)
}
