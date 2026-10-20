import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'
import type { ServicoViagens } from './viagens.js'
import { baseDoRastreador } from './rastreador.js'

/*
 * A escuta AO VIVO do rastreador (SignalR, hub `/hub/tracking` — o mesmo canal que o iERP antigo
 * e o painel do rastreador ouvem; o 2.0 é só mais um ouvinte, nada muda para os outros):
 *   TripStarted              → amarra a viagem do lote e grava o código de chegada;
 *   PointAdded               → a posição do caminhão;
 *   TripAwaitingConfirmation → o motorista tocou "Cheguei";
 *   TripEnded                → arquiva o trajeto;
 *   TripEmergency / Acked    → o alarme de emergência e a ciência;
 *   StopReported / ChatMessageReceived → a próxima leitura da tela vai ao rastreador.
 *
 * Ao lado, a CONFERÊNCIA a cada minuto (a rede para o evento perdido: o rastreador hiberna e a
 * conexão cai em silêncio — lição do iERP antigo). Sem rastreador cadastrado, nada liga; ao
 * cadastrar, a próxima rodada conecta.
 */

const CONFERENCIA_MS = 60_000
const RELIGAR_MS = 30_000

export function iniciarViagensAoVivo(servico: ServicoViagens) {
  let conexao: HubConnection | null = null
  let urlConectada: string | null = null
  let parado = false
  let ocupado = false
  let religar: NodeJS.Timeout | null = null

  const seguro = (nome: string, f: (dados: unknown) => Promise<unknown>) => (dados: unknown) =>
    void f(dados).catch((e: unknown) => console.error(`[viagens] ${nome}:`, e))

  async function conectar(url: string) {
    const c = new HubConnectionBuilder()
      .withUrl(`${baseDoRastreador(url)}/hub/tracking`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()
    c.on('TripStarted', seguro('TripStarted', servico.tempoReal.viagemIniciada))
    c.on('PointAdded', seguro('PointAdded', servico.tempoReal.ponto))
    c.on(
      'TripAwaitingConfirmation',
      seguro('TripAwaitingConfirmation', servico.tempoReal.aguardandoConfirmacao),
    )
    c.on('TripEnded', seguro('TripEnded', servico.tempoReal.viagemTerminada))
    c.on('TripEmergency', seguro('TripEmergency', servico.tempoReal.emergencia))
    c.on('StopReported', seguro('StopReported', servico.tempoReal.novidade('parada')))
    c.on('ChatMessageReceived', seguro('ChatMessageReceived', servico.tempoReal.novidade('chat')))
    c.on('TripEmergencyAcked', seguro('TripEmergencyAcked', servico.tempoReal.emergenciaCiente))
    c.onreconnected(() => void conferir())
    // O reconectar automático desiste depois de ~4 tentativas: recomeça do zero.
    c.onclose(() => {
      if (conexao !== c || parado) return
      conexao = null
      urlConectada = null
      agendarReligar()
    })
    await c.start()
    conexao = c
    urlConectada = url
    console.log('[viagens] conectado ao rastreador (ao vivo)')
  }

  function agendarReligar() {
    if (religar || parado) return
    religar = setTimeout(() => {
      religar = null
      void garantirConexao()
    }, RELIGAR_MS)
  }

  async function garantirConexao() {
    if (parado) return
    const cfg = await servico.config().catch(() => null)
    // Endereço trocado (ou rastreador desligado): fecha a conexão velha.
    if (conexao && (!cfg || cfg.url !== urlConectada)) {
      const velha = conexao
      conexao = null
      urlConectada = null
      await velha.stop().catch(() => undefined)
    }
    if (!cfg || conexao) return
    try {
      await conectar(cfg.url)
      void conferir()
    } catch (e) {
      console.error(
        '[viagens] rastreador fora do ar, nova tentativa em 30 s:',
        e instanceof Error ? e.message : e,
      )
      agendarReligar()
    }
  }

  async function conferir() {
    if (ocupado || parado) return
    ocupado = true
    try {
      await servico.sincronizar()
    } catch (e) {
      console.error('[viagens] conferência:', e)
    } finally {
      ocupado = false
    }
  }

  const relogio = setInterval(() => {
    void garantirConexao()
    void conferir()
  }, CONFERENCIA_MS)
  void garantirConexao()
  void conferir()

  return () => {
    parado = true
    clearInterval(relogio)
    if (religar) clearTimeout(religar)
    void conexao?.stop()
  }
}
