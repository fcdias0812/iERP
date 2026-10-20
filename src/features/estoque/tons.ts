import type { Language } from '@/stores/ui-store'
import type { StatusId } from '@/lib/status/statusMap'
import type { StatusDeFora } from '@/services/types'

/*
 * A COR dos estados que vêm dos sistemas de estoque (regra das cores: a cor segue o
 * significado). O rótulo é o de lá (o armazém manda nos 3 idiomas; o cadastro de lá é editável,
 * então código novo cai em "informação" com o rótulo que vier); a cor sai daqui, por código.
 */

/** Os 5 selos genéricos do Estoque (statusMap: estoque_*). */
export type TomEstoque = Extract<
  StatusId,
  'estoque_ok' | 'estoque_atencao' | 'estoque_problema' | 'estoque_encerrado' | 'estoque_info'
>

/** Armazém — estado FÍSICO do palete. */
const FISICO: Record<string, TomEstoque> = {
  FUNCIONANDO: 'estoque_ok',
  FUNCIONAMENTO_PARCIAL: 'estoque_atencao',
  COM_DEFEITO: 'estoque_problema',
  SUCATEADO: 'estoque_encerrado',
  NAO_APLICAVEL: 'estoque_encerrado',
}

/** Armazém — estado de VENDA do palete. */
const VENDA: Record<string, TomEstoque> = {
  VENDAVEL: 'estoque_ok',
  EXPEDIDO: 'estoque_ok',
  RESERVADO: 'estoque_atencao',
  AGUARDANDO_EXPEDICAO: 'estoque_atencao',
  NAO_VENDAVEL: 'estoque_encerrado',
}

export const tomFisico = (codigo: string) => FISICO[codigo] ?? 'estoque_info'
export const tomVenda = (codigo: string) => VENDA[codigo] ?? 'estoque_info'

/** Controle de Notebooks — status 1 a 10 (fixos no código de lá). */
const MAQUINA: Record<number, TomEstoque> = {
  1: 'estoque_info', // Recebido
  2: 'estoque_ok', // Pronto para venda
  3: 'estoque_info', // Anunciado
  4: 'estoque_atencao', // Reservado
  5: 'estoque_encerrado', // Vendido
  6: 'estoque_problema', // Devolvido — em análise
  7: 'estoque_encerrado', // Em uso interno
  8: 'estoque_atencao', // Manutenção
  9: 'estoque_encerrado', // Descartado
  10: 'estoque_atencao', // Reserva interna
}
export const tomMaquina = (codigo: number) => MAQUINA[codigo] ?? 'estoque_info'
/** Códigos de status de máquina que a tela traduz (fora deles, o nome de lá). */
export const STATUS_MAQUINA = Object.keys(MAQUINA).map(Number)

/** O rótulo do estado de lá no idioma da tela (sem tradução lá, o português). */
export function rotuloDeFora(s: StatusDeFora, idioma: Language | string) {
  if (idioma === 'en') return s.rotuloEn ?? s.rotulo
  if (idioma === 'zh-TW') return s.rotuloZh ?? s.rotulo
  return s.rotulo
}

/** Dia de lá (`AAAA-MM-DD`) → instante ao meio-dia UTC (o fuso de SP não volta um dia). */
export const diaParaInstante = (dia: string | null) =>
  dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia}T12:00:00.000Z` : dia
