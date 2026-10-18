import {
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

/**
 * Tons de estado — base da regra das cores. Um tom, um significado.
 * O `statusMap` (status de negócio → tom + ícone + rótulo) é construído
 * sobre estes tons; nenhum componente usa cor fora daqui.
 */
export type StatusTone = 'info' | 'success' | 'warning' | 'alert' | 'danger' | 'inactive'

export const STATUS_TONES: StatusTone[] = [
  'info',
  'success',
  'warning',
  'alert',
  'danger',
  'inactive',
]

interface ToneStyle {
  /** Ícone padrão do tom (cor nunca é o único sinal). */
  icon: LucideIcon
  /** Fundo tingido + texto e borda no tom forte (avisos e selos). */
  subtle: string
  /** Fundo sólido + texto de contraste (selo forte). */
  solid: string
  /** Só o texto/ícone no tom forte (sobre card). */
  text: string
  /** Borda no tom forte. */
  border: string
}

export const toneStyles: Record<StatusTone, ToneStyle> = {
  info: {
    icon: Info,
    subtle: 'bg-info-subtle text-info-subtle-foreground border-info-border',
    solid: 'bg-info text-info-foreground',
    text: 'text-info-subtle-foreground',
    border: 'border-info-border',
  },
  success: {
    icon: CircleCheck,
    subtle: 'bg-success-subtle text-success-subtle-foreground border-success-border',
    solid: 'bg-success text-success-foreground',
    text: 'text-success-subtle-foreground',
    border: 'border-success-border',
  },
  warning: {
    icon: Clock,
    subtle: 'bg-warning-subtle text-warning-subtle-foreground border-warning-border',
    solid: 'bg-warning text-warning-foreground',
    text: 'text-warning-subtle-foreground',
    border: 'border-warning-border',
  },
  alert: {
    icon: TriangleAlert,
    subtle: 'bg-alert-subtle text-alert-subtle-foreground border-alert-border',
    solid: 'bg-alert text-alert-foreground',
    text: 'text-alert-subtle-foreground',
    border: 'border-alert-border',
  },
  danger: {
    icon: CircleX,
    subtle: 'bg-danger-subtle text-danger-subtle-foreground border-danger-border',
    solid: 'bg-danger text-danger-foreground',
    text: 'text-danger-subtle-foreground',
    border: 'border-danger-border',
  },
  inactive: {
    icon: Ban,
    subtle: 'bg-inactive-subtle text-inactive-subtle-foreground border-inactive-border',
    solid: 'bg-inactive text-inactive-foreground',
    text: 'text-inactive-subtle-foreground',
    border: 'border-inactive-border',
  },
}
