import {
  AlarmClock,
  Ban,
  CalendarCheck,
  CalendarClock,
  Cog,
  CircleDashed,
  FileClock,
  ScanSearch,
  CalendarX,
  CircleCheck,
  CircleCheckBig,
  CircleDot,
  CircleHelp,
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
  MessageSquareWarning,
  OctagonX,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  Scale,
  PencilLine,
  Receipt,
  MapPinCheck,
  Siren,
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
  // Ocorrência do lote (alerta leve: alguém precisa olhar).
  registrada: { tone: 'warning', icon: MessageSquareWarning, flowOrder: 32 },
  // Inspeção visual do recebimento.
  inspecao_bom: { tone: 'success', icon: CircleCheck, flowOrder: 61 },
  inspecao_outro: { tone: 'warning', icon: CircleHelp, flowOrder: 202 },
  inspecao_avaria: { tone: 'alert', icon: TriangleAlert, flowOrder: 203 },
  // Balanço de massa do lote (sistema de fora): sem medição, parcial, fechou, fora da tolerância.
  balanco_aguardando: { tone: 'inactive', icon: CircleDashed, flowOrder: 426 },
  balanco_parcial: { tone: 'info', icon: Hourglass, flowOrder: 69 },
  balanco_fechado: { tone: 'success', icon: Scale, flowOrder: 111 },
  balanco_fora: { tone: 'alert', icon: TriangleAlert, flowOrder: 206 },
  // Container (bigbag) do sistema de fora.
  container_aberto: { tone: 'info', icon: PackageOpen, flowOrder: 81 },
  container_fechado: { tone: 'success', icon: PackageCheck, flowOrder: 101 },
  container_embarcado: { tone: 'success', icon: Truck, flowOrder: 102 },
  aguardando_aprovacao: { tone: 'warning', icon: Hourglass, flowOrder: 40 },
  em_revisao: { tone: 'warning', icon: Eye, flowOrder: 50 },
  aprovado: { tone: 'success', icon: CircleCheck, flowOrder: 60 },
  agendado: { tone: 'info', icon: CalendarClock, flowOrder: 65 },
  // Data da coleta do lote: só a prevista ou já confirmada (Forecast do dashboard).
  coleta_prevista: { tone: 'info', icon: CalendarClock, flowOrder: 63 },
  coleta_confirmada: { tone: 'success', icon: CalendarCheck, flowOrder: 64 },
  inspecao: { tone: 'info', icon: ScanSearch, flowOrder: 66 },
  processo: { tone: 'info', icon: Cog, flowOrder: 67 },
  aguardando_cod: { tone: 'warning', icon: FileClock, flowOrder: 68 },
  no_prazo: { tone: 'success', icon: CircleCheck, flowOrder: 126 },
  sem_sla: { tone: 'inactive', icon: CircleDashed, flowOrder: 425 },
  em_andamento: { tone: 'info', icon: CirclePlay, flowOrder: 70 },
  em_separacao: { tone: 'info', icon: PackageOpen, flowOrder: 80 },
  faturado: { tone: 'info', icon: Receipt, flowOrder: 90 },
  entregue: { tone: 'success', icon: PackageCheck, flowOrder: 100 },
  concluido: { tone: 'success', icon: CircleCheckBig, flowOrder: 110 },
  pago: { tone: 'success', icon: HandCoins, flowOrder: 120 },
  ativo: { tone: 'success', icon: CircleCheck, flowOrder: 130 },
  em_transito: { tone: 'info', icon: Truck, flowOrder: 85 },
  // Viagem do lote no rastreador de GPS (Ordens › Viagens).
  viagem_aguardando_motorista: { tone: 'info', icon: Clock, flowOrder: 86 },
  viagem_em_rota: { tone: 'info', icon: Truck, flowOrder: 87 },
  viagem_chegou: { tone: 'warning', icon: MapPinCheck, flowOrder: 88 },
  viagem_finalizada: { tone: 'success', icon: CircleCheckBig, flowOrder: 112 },
  viagem_cancelada: { tone: 'inactive', icon: Ban, flowOrder: 401 },
  viagem_emergencia: { tone: 'danger', icon: Siren, flowOrder: 305 },
  // Estados que vêm dos sistemas de estoque (o rótulo é o de lá; a cor, pelo significado).
  estoque_ok: { tone: 'success', icon: CircleCheck, flowOrder: 140 },
  estoque_info: { tone: 'info', icon: CircleDot, flowOrder: 141 },
  estoque_atencao: { tone: 'warning', icon: Clock, flowOrder: 142 },
  estoque_problema: { tone: 'alert', icon: TriangleAlert, flowOrder: 143 },
  estoque_encerrado: { tone: 'inactive', icon: CircleMinus, flowOrder: 430 },
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
