import { criarApp } from './app.js'
import { config } from './config.js'
import { criarDb } from './db/database.js'
import { migrarParaUltima } from './db/migrate.js'
import { iniciarSincronizacao } from './modules/integracao/sincronizacao.js'
import { iniciarViagensAoVivo } from './modules/viagens/tempo-real.js'
import { criarServicoViagens } from './modules/viagens/viagens.js'

/* Sobe o servidor: aplica as migrations pendentes e abre a porta. */

const db = criarDb(config.dbFile)
const aplicadas = await migrarParaUltima(db)
if (aplicadas.length) console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`)

// Ordens › Viagens: o mesmo serviço atende a tela e escuta o rastreador.
const viagens = criarServicoViagens(db)
const servidor = criarApp(db, { viagens }).listen(config.port, () => {
  console.log(`iERP API em http://localhost:${config.port}/api (banco: ${config.dbFile})`)
})
// Integrações (MoonShot…): fila de avisos e leitura do painel de andamento.
const pararSincronizacao = iniciarSincronizacao(db)
// Rastreador de GPS: escuta ao vivo + conferência a cada minuto.
const pararViagens = iniciarViagensAoVivo(viagens)

const encerrar = () => {
  pararSincronizacao()
  pararViagens()
  servidor.close(() => void db.destroy().then(() => process.exit(0)))
}
process.on('SIGINT', encerrar)
process.on('SIGTERM', encerrar)
