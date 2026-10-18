import { config } from '../config.js'
import { criarDb } from './database.js'
import { migrarParaUltima } from './migrate.js'
import { semear } from './seed.js'

/* npm run db:migrate | db:seed */

const comando = process.argv[2]
const db = criarDb(config.dbFile)
try {
  const aplicadas = await migrarParaUltima(db)
  console.log(
    aplicadas.length ? `Migrations aplicadas: ${aplicadas.join(', ')}` : 'Banco já atualizado.',
  )
  if (comando === 'seed') {
    const n = await semear(db)
    console.log(n ? `Usuários de exemplo criados: ${n}` : 'Já há usuários; nada foi criado.')
  }
} finally {
  await db.destroy()
}
