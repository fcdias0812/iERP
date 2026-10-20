import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/ui/status-badge'
import { rotuloDoStatus, type LoteComStatus } from './status-do-lote'

/*
 * O status do lote. Processado num sistema de fora (Dell → MoonShot), a etapa "Processo"
 * mostra a fase de lá: "Processamento 2/4 · Leitura das peças" (pedido do usuário, 19/10/2026).
 */

export function StatusDoLote({ lote, size }: { lote: LoteComStatus; size?: 'sm' | 'md' }) {
  const { t } = useTranslation()
  return <StatusBadge status={lote.status} size={size} label={rotuloDoStatus(t, lote)} />
}
