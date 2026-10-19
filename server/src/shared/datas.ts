/*
 * Datas: o banco guarda instantes em UTC (ISO 8601). Os filtros por DIA da tela usam o
 * fuso da empresa (America/Sao_Paulo) — "até 18/10" inclui o dia 18 inteiro no horário de SP.
 */
export const FUSO_EMPRESA = 'America/Sao_Paulo'

const DIA = /^\d{4}-\d{2}-\d{2}$/

export const ehDia = (v: unknown): v is string => typeof v === 'string' && DIA.test(v)

/** Diferença do fuso para UTC, em minutos, no instante informado (ex.: -180). */
function offsetMinutos(instante: Date, fuso: string): number {
  const nome = new Intl.DateTimeFormat('en-US', { timeZone: fuso, timeZoneName: 'longOffset' })
    .formatToParts(instante)
    .find((p) => p.type === 'timeZoneName')?.value
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(nome ?? '')
  if (!m) return 0
  const min = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -min : min
}

/** Início do dia `yyyy-mm-dd` no fuso da empresa, como ISO UTC. */
export function inicioDoDia(dia: string, fuso = FUSO_EMPRESA): string {
  const utc = Date.parse(`${dia}T00:00:00Z`)
  const off = offsetMinutos(new Date(utc + 12 * 3_600_000), fuso)
  return new Date(utc - off * 60_000).toISOString()
}

/** Dia seguinte (`yyyy-mm-dd`). */
export function diaSeguinte(dia: string): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
}

/** Dia (`yyyy-mm-dd`) do instante no fuso da empresa — "hoje" em São Paulo. */
export function diaNoFuso(instante: Date = new Date(), fuso = FUSO_EMPRESA): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante)
}

/** Soma dias a um `yyyy-mm-dd`. */
export function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}
