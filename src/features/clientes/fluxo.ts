import { CircleCheck, CircleMinus, type LucideIcon } from 'lucide-react'
import type { AcaoCliente, ClienteStatus } from '@/services/types'

/*
 * Ações do fluxo do cliente: ícone, cor (regra das cores) e permissão. Quais valem AGORA vem
 * da API (`acoesPermitidas`); a tela só confere o perfil. Inativar é reversível: cinza.
 * Cliente não é excluído — inativado, o cadastro e o histórico ficam.
 */
export interface AcaoMeta {
  icon: LucideIcon
  variant: 'default' | 'secondary'
  permission: string
  /** Ordem dos botões (maior = mais à direita = principal). */
  peso: number
}

export const ACOES: Record<AcaoCliente, AcaoMeta> = {
  inativar: { icon: CircleMinus, variant: 'secondary', permission: 'clientes.editar', peso: 1 },
  reativar: { icon: CircleCheck, variant: 'default', permission: 'clientes.editar', peso: 5 },
}

export const STATUS_CLIENTE: ClienteStatus[] = ['ativo', 'inativo']

/** Máximo de contatos por cliente (o servidor confere o mesmo limite). */
export const MAX_CONTATOS = 20
