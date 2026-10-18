import { Ban, CircleCheck, CircleMinus, LockOpen, type LucideIcon } from 'lucide-react'
import type { Role } from '@/config/permissions'
import type { AcaoUsuario, UsuarioStatus } from '@/services/types'

/*
 * Como cada ação do fluxo do usuário aparece na tela: ícone, cor (regra das cores),
 * permissão exigida e se pede confirmação/motivo. Quais ações valem AGORA vem da
 * API (`acoesPermitidas`); a tela só confere o perfil.
 * Bloquear e inativar são reversíveis: cinza (secondary), não vermelho.
 */
export interface AcaoMeta {
  icon: LucideIcon
  variant: 'default' | 'secondary' | 'success' | 'destructive'
  permission: string
  /** Confirmação antes de executar. */
  confirm?: 'simple' | 'destructive'
  /** Exige motivo (texto). */
  motivo?: boolean
  /** Ordem dos botões (maior = mais à direita = principal). */
  peso: number
}

export const ACOES: Record<AcaoUsuario, AcaoMeta> = {
  inativar: {
    icon: CircleMinus,
    variant: 'secondary',
    permission: 'admin.editar',
    confirm: 'simple',
    peso: 1,
  },
  bloquear: {
    icon: Ban,
    variant: 'secondary',
    permission: 'admin.editar',
    motivo: true,
    peso: 2,
  },
  desbloquear: {
    icon: LockOpen,
    variant: 'default',
    permission: 'admin.editar',
    confirm: 'simple',
    peso: 5,
  },
  reativar: {
    icon: CircleCheck,
    variant: 'default',
    permission: 'admin.editar',
    confirm: 'simple',
    peso: 5,
  },
}

/** Perfis de acesso (mesmos papéis de src/config/permissions.ts). */
export const PERFIS = ['admin', 'operacao', 'leitura'] as const satisfies readonly Role[]
export const STATUS_USUARIO: UsuarioStatus[] = ['ativo', 'bloqueado', 'inativo']
