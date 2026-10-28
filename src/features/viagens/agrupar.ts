import { TIME_ZONE } from '@/lib/format'
import type { StatusViagem, Viagem } from '@/services/types'

/*
 * Os cards de Ordens › Viagens separados por DIA DA COLETA e CLIENTE (como no iERP antigo:
 * "o que sai amanhã, e para quem?"). Quatro jeitos, escolhidos na tela e lembrados no aparelho:
 *   diaCliente (padrão) · dia · cliente · nenhum.
 * Regras: dia mais próximo primeiro, sem data no fim; clientes em ordem alfabética; dentro do
 * grupo, emergência sem ciência primeiro, depois quem chegou, quem está na rua e quem espera.
 */

export const MODOS = ['diaCliente', 'dia', 'cliente', 'nenhum'] as const
export type ModoAgrupar = (typeof MODOS)[number]
export const MODO_PADRAO: ModoAgrupar = 'diaCliente'

const CHAVE = 'ierp.viagens.agrupar.v1'

export function lerModo(): ModoAgrupar {
  try {
    const salvo = globalThis.localStorage?.getItem(CHAVE)
    return (MODOS as readonly string[]).includes(salvo ?? '') ? (salvo as ModoAgrupar) : MODO_PADRAO
  } catch {
    return MODO_PADRAO
  }
}

export function gravarModo(modo: ModoAgrupar) {
  try {
    if (modo === MODO_PADRAO) globalThis.localStorage?.removeItem(CHAVE)
    else globalThis.localStorage?.setItem(CHAVE, modo)
  } catch {
    // Sem armazenamento (janela privada): vale só nesta visita.
  }
}

/** Dia (`AAAA-MM-DD`) do instante no fuso da empresa. */
export function diaSp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** "hoje" | "amanha" | "ontem" | null — o dia comparado a hoje em São Paulo. */
export function diaRelativo(
  dia: string | null,
  agora = new Date(),
): 'hoje' | 'amanha' | 'ontem' | null {
  if (!dia) return null
  const hoje = diaSp(agora.toISOString())!
  const mais = (n: number) =>
    new Date(Date.parse(`${hoje}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
  if (dia === hoje) return 'hoje'
  if (dia === mais(1)) return 'amanha'
  if (dia === mais(-1)) return 'ontem'
  return null
}

const ORDEM_STATUS: Record<StatusViagem, number> = {
  chegou: 0,
  em_rota: 1,
  aguardando_motorista: 2,
  finalizada: 3,
  cancelada: 4,
}

const porNome = (a: string, b: string) =>
  a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true })

/**
 * Um card por CAMINHÃO (28/10/2026: "Se no agendamento tiver apenas um caminhão, lá em viagens irá
 * ter apenas um card referenciando aquele caminhão"): os rastreadores do mesmo caminhão (mesmo
 * lote e número) ficam juntos — o mais urgente primeiro (é ele que o card mostra em cima).
 */
export function porCaminhao(viagens: Viagem[]): Viagem[][] {
  const grupos = new Map<string, Viagem[]>()
  for (const v of viagens) {
    const chave = `${v.ordemId}#${v.numero}`
    grupos.set(chave, [...(grupos.get(chave) ?? []), v])
  }
  return [...grupos.values()].map((g) => [...g].sort(compararViagens))
}

export function compararViagens(a: Viagem, b: Viagem) {
  const ea = a.emergencia && !a.emergencia.cienteEm ? 0 : 1
  const eb = b.emergencia && !b.emergencia.cienteEm ? 0 : 1
  if (ea !== eb) return ea - eb
  if (ORDEM_STATUS[a.status] !== ORDEM_STATUS[b.status])
    return ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]
  return porNome(a.loteCodigo, b.loteCodigo)
}

export interface GrupoViagens {
  chave: string
  /** `AAAA-MM-DD`, null = sem data; undefined = o modo não usa o dia. */
  dia: string | null | undefined
  cliente: string | null | undefined
  itens: Viagem[]
}

export function agruparViagens(lista: Viagem[], modo: ModoAgrupar): GrupoViagens[] {
  const itens = [...lista].sort(compararViagens)
  if (modo === 'nenhum')
    return itens.length ? [{ chave: 'todas', dia: undefined, cliente: undefined, itens }] : []
  const usaDia = modo !== 'cliente'
  const usaCliente = modo !== 'dia'
  const grupos = new Map<string, GrupoViagens>()
  for (const v of itens) {
    const dia = usaDia ? diaSp(v.dataColeta) : undefined
    const cliente = usaCliente ? v.clienteNome || null : undefined
    const chave = `${dia ?? ''}|${cliente ?? ''}`
    const g = grupos.get(chave) ?? { chave, dia, cliente, itens: [] }
    g.itens.push(v)
    grupos.set(chave, g)
  }
  return [...grupos.values()].sort((a, b) => {
    if (usaDia && a.dia !== b.dia) {
      if (!a.dia) return 1
      if (!b.dia) return -1
      return a.dia < b.dia ? -1 : 1
    }
    if (usaCliente && a.cliente !== b.cliente) {
      if (!a.cliente) return 1
      if (!b.cliente) return -1
      return porNome(a.cliente, b.cliente)
    }
    return 0
  })
}
