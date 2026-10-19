import { useTranslation } from 'react-i18next'
import { HistoricoTabela } from '@/features/comum/HistoricoTabela'
import type { Ordem } from '@/services/types'
import { useRotulosHistoricoLote } from './historico-lote'

/* Histórico do lote (auditoria em tabela, como o do cliente): agendamento, edições, ocorrências,
 * recebimento e documentos. */

export function AbaHistoricoLote({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const { acoes, campos, formatar } = useRotulosHistoricoLote()
  return (
    <HistoricoTabela
      id="lote-historico"
      titulo={t('lotes.abas.historico')}
      historico={o.historico}
      exportName={`historico-${o.codigo}`}
      acoes={acoes}
      campos={campos}
      formatar={formatar}
    />
  )
}
