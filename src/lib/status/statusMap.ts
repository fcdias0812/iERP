import {
  AlarmClock,
  Ban,
  CalendarX,
  CircleCheck,
  CircleCheckBig,
  CircleDot,
  CircleMinus,
  CirclePlay,
  CircleX,
  FileCheck,
  Link2,
  TreePalm,
  Package,
  PackageSearch,
  TriangleAlert,
  Truck,
  UserMinus,
  Wrench,
  Clock,
  Eye,
  HandCoins,
  Hourglass,
  Lock,
  OctagonX,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  PencilLine,
  Receipt,
  type LucideIcon,
} from 'lucide-react'
import type { StatusTone } from './tones'

/*
 * MAPA CENTRAL DE STATUS — status de negócio → tom + ícone + rótulo + ordem no fluxo.
 * Todo selo de status do sistema sai daqui (<StatusBadge status="aprovado" />).
 * Regra das cores: o TOM segue o significado (ver src/lib/status/tones.ts).
 *
 * `flowOrder` é a posição no fluxo: o DataTable ordena a coluna de status por ela
 * (rascunho antes de aprovado, aprovado antes de entregue…), não pelo texto.
 * Para um status novo: adicione aqui + a chave `status.<id>` nos 3 idiomas.
 */

export interface StatusDef {
  tone: StatusTone
  icon: LucideIcon
  flowOrder: number
}

export const STATUS_MAP = {
  rascunho: { tone: 'inactive', icon: PencilLine, flowOrder: 10 },
  novo: { tone: 'info', icon: CircleDot, flowOrder: 20 },
  pendente: { tone: 'warning', icon: Clock, flowOrder: 30 },
  aguardando_aprovacao: { tone: 'warning', icon: Hourglass, flowOrder: 40 },
  em_revisao: { tone: 'warning', icon: Eye, flowOrder: 50 },
  aprovado: { tone: 'success', icon: CircleCheck, flowOrder: 60 },
  em_andamento: { tone: 'info', icon: CirclePlay, flowOrder: 70 },
  em_separacao: { tone: 'info', icon: PackageOpen, flowOrder: 80 },
  faturado: { tone: 'info', icon: Receipt, flowOrder: 90 },
  entregue: { tone: 'success', icon: PackageCheck, flowOrder: 100 },
  concluido: { tone: 'success', icon: CircleCheckBig, flowOrder: 110 },
  pago: { tone: 'success', icon: HandCoins, flowOrder: 120 },
  ativo: { tone: 'success', icon: CircleCheck, flowOrder: 130 },
  em_transito: { tone: 'info', icon: Truck, flowOrder: 85 },
  autorizada: { tone: 'success', icon: FileCheck, flowOrder: 95 },
  conciliado: { tone: 'success', icon: Link2, flowOrder: 125 },
  disponivel: { tone: 'success', icon: PackageSearch, flowOrder: 132 },
  ocupado: { tone: 'info', icon: Package, flowOrder: 134 },
  em_ferias: { tone: 'info', icon: TreePalm, flowOrder: 136 },
  em_manutencao: { tone: 'warning', icon: Wrench, flowOrder: 138 },
  divergente: { tone: 'alert', icon: TriangleAlert, flowOrder: 205 },
  atrasado: { tone: 'alert', icon: AlarmClock, flowOrder: 200 },
  vencido: { tone: 'alert', icon: CalendarX, flowOrder: 210 },
  estoque_baixo: { tone: 'alert', icon: PackageMinus, flowOrder: 220 },
  recusado: { tone: 'danger', icon: CircleX, flowOrder: 300 },
  erro: { tone: 'danger', icon: OctagonX, flowOrder: 310 },
  cancelado: { tone: 'inactive', icon: Ban, flowOrder: 400 },
  bloqueado: { tone: 'inactive', icon: Lock, flowOrder: 410 },
  afastado: { tone: 'inactive', icon: UserMinus, flowOrder: 415 },
  inativo: { tone: 'inactive', icon: CircleMinus, flowOrder: 420 },
} as const satisfies Record<string, StatusDef>

export type StatusId = keyof typeof STATUS_MAP

export const STATUS_IDS = Object.keys(STATUS_MAP) as StatusId[]

export function getStatus(id: StatusId): StatusDef {
  return STATUS_MAP[id]
}

/** Comparador pela ordem do fluxo (usado na ordenação de tabelas). */
export function compareStatus(a: StatusId, b: StatusId): number {
  return STATUS_MAP[a].flowOrder - STATUS_MAP[b].flowOrder
}
