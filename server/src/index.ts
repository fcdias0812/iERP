import { criarApp } from './app.js'
import { config } from './config.js'
import { criarDb } from './db/database.js'
import { migrarParaUltima } from './db/migrate.js'
import { iniciarSincronizacao } from './modules/integracao/sincronizacao.js'
import { criarServicoEstoque, iniciarEstoqueAoFundo } from './modules/estoque/estoque.js'
import { iniciarViagensAoVivo } from './modules/viagens/tempo-real.js'
import { criarLeitorGps } from './modules/viagens/gps-caminhao.js'
import { criarServicoViagens } from './modules/viagens/viagens.js'

/* Sobe o servidor: aplica as migrations pendentes e abre a porta. */

const db = criarDb(config.dbFile)
const aplicadas = await migrarParaUltima(db)
if (aplicadas.length) console.log(`Migrations aplicadas: ${aplicadas.join(', ')}`)

// Ordens › Viagens: o mesmo serviço atende a tela e escuta o rastreador.
const viagens = criarServicoViagens(db)
// O servidor de GPS dos aparelhos dos caminhões (lido por pull a cada 5 min, como no 1.0).
const gps = criarLeitorGps(db)
// Estoque: o mesmo serviço atende as telas e a leitura de fundo do histórico.
const estoque = criarServicoEstoque(db)
const servidor = criarApp(db, { viagens, estoque, gps }).listen(config.port, () => {
  console.log(`iERP API em http://localhost:${config.port}/api (banco: ${config.dbFile})`)
})
// Integrações (MoonShot…): fila de avisos e leitura do painel de andamento.
const pararSincronizacao = iniciarSincronizacao(db)
// Rastreador de GPS: escuta ao vivo + conferência a cada minuto.
const pararViagens = iniciarViagensAoVivo(viagens)
// Estoque › Histórico: lê os três sistemas a cada 5 minutos e registra o que mudou.
const pararEstoque = iniciarEstoqueAoFundo(estoque)
const pararGps = gps.iniciar()

const encerrar = () => {
  pararSincronizacao()
  pararViagens()
  pararEstoque()
  pararGps()
  servidor.close(() => void db.destroy().then(() => process.exit(0)))
}
process.on('SIGINT', encerrar)
process.on('SIGTERM', encerrar)
