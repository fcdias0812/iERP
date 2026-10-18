import { criarApp } from './app.js'
import { config } from './config.js'
import { criarDb } from './db/database.js'
import { migrarParaUltima } from './db/migrate.js'

/* Sobe o servidor: aplica as migrations pendentes e abre a porta. */

const db = criarDb(config.dbFile)
const aplicadas = await migrarParaUltima(db)
if (aplicadas.length) console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`)

const servidor = criarApp(db).listen(config.port, () => {
  console.log(`iERP API em http://localhost:${config.port}/api (banco: ${config.dbFile})`)
})

const encerrar = () => {
  servidor.close(() => void db.destroy().then(() => process.exit(0)))
}
process.on('SIGINT', encerrar)
process.on('SIGTERM', encerrar)
