import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { useViagemDoLote } from './use-viagens'

/*
 * No painel de recebimento: o lote tem viagem rastreada? Mostra o código de chegada (é o que o
 * motorista digita no app ao chegar) e avisa que receber o lote ENCERRA a viagem (decisão do
 * usuário, 20/10/2026).
 */
export function CodigoDeChegada({ ordemId }: { ordemId: string }) {
  const { t } = useTranslation()
  const v = useViagemDoLote(ordemId).data
  if (!v || v.somenteLeitura || v.status === 'finalizada' || v.status === 'cancelada') return null
  return (
    <Alert tone="info" title={t('viagens.recebimento.titulo')} className="sm:col-span-2">
      {v.codigoChegada && (
        <>
          {t('viagens.card.codigoChegada')}{' '}
          <span className="font-mono type-label num">{v.codigoChegada}</span>.{' '}
        </>
      )}
      {v.status === 'aguardando_motorista'
        ? t('viagens.recebimento.semViagem')
        : t('viagens.recebimento.encerra')}
    </Alert>
  )
}
