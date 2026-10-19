/*
 * Período carregado nos históricos grandes (Histórico do módulo, Auditoria): 30 dias, 90 dias
 * (padrão), 12 meses ou tudo — mantém a tela leve.
 */

export const PERIODOS = ['30', '90', '365', 'tudo'] as const
export type Periodo = (typeof PERIODOS)[number]

/** Início do período (ISO), contado a partir de agora. */
export function desdeDo(periodo: Periodo): string | null {
  if (periodo === 'tudo') return null
  const d = new Date()
  d.setDate(d.getDate() - Number(periodo))
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
