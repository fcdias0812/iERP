import { Migrator } from 'kysely/migration'
import { config } from '../config.js'
import { criarDb } from './database.js'
import { migrarParaUltima } from './migrate.js'
import { migrations } from './migrations/index.js'
import { semear } from './seed.js'

/*
 * npm run db:migrate | db:seed | db:desfazer
 *
 * db:desfazer — SÓ DESENVOLVIMENTO: desfaz a ÚLTIMA migration aplicada (roda o `down`). Uso:
 * corrigir uma migration que ainda NÃO foi commitada (pare a API antes; ao subir de novo ela
 * reaplica a versão corrigida). Migration já commitada nunca é alterada — crie outra.
 */

const comando = process.argv[2]
const db = criarDb(config.dbFile)
try {
  if (comando === 'desfazer') {
    const migrator = new Migrator({
      db: db.withoutPlugins(),
      provider: { getMigrations: async () => migrations },
    })
    const { error, results } = await migrator.migrateDown()
    if (error) throw error
    console.log(
      results?.length
        ? results.map((r) => `Desfeita: ${r.migrationName} (${r.status})`).join('\n')
        : 'Nenhuma migration para desfazer.',
    )
  } else {
    const aplicadas = await migrarParaUltima(db)
    console.log(
      aplicadas.length ? `Migrations aplicadas: ${aplicadas.join(', ')}` : 'Banco já atualizado.',
    )
    if (comando === 'seed') {
      const n = await semear(db)
      console.log(n ? `Registros de exemplo criados: ${n}` : 'Já há dados; nada foi criado.')
    }
  }
} finally {
  await db.destroy()
}
