import type { ConfiguracoesCliente } from '@/services/types'

/*
 * Clientes › Configurações (22/10/2026) — o que o resto do sistema consulta: os sistemas de fora
 * que processam lotes (o mesmo de `server/src/modules/integracao/destinos.ts`) e o "como antes"
 * de um cliente sem configuração (rastreio escolhido em cada coleta, nada exigido).
 */

/** Sistemas de fora que processam os lotes (hoje só o MoonShot). */
export const SISTEMAS_PROCESSAMENTO = ['MOONSHOT'] as const

/** Nome de cada sistema na tela (é nome de produto: não passa pelo i18n). */
export const NOME_SISTEMA: Record<string, string> = { MOONSHOT: 'MoonShot' }

export const CONFIGURACOES_PADRAO: ConfiguracoesCliente = {
  rastrearColeta: false,
  rastreioExcecao: true,
  exigirMotoristaPlaca: false,
  servicosPadrao: null,
  transportadoraPadraoId: null,
  transportadoraPadraoNome: null,
  instrucoes: null,
  exigirEscopoPlanilha: false,
  exigirLacre: false,
  exigirNota: false,
  exigirTara: false,
  exigirFotosGerais: false,
  sistemaProcessamento: null,
  slaDias: null,
  diasParadoEtapa: null,
  antecedenciaDias: null,
  agendamentoBloqueado: false,
  bloqueioMotivo: null,
  documentos: [],
}
