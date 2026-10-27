import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { useViagensDoLote } from './use-viagens'

/*
 * No painel de recebimento: o lote tem caminhões rastreados? Mostra o código de chegada de cada
 * um (é o que o motorista digita no app ao chegar). Desde 22/10/2026 receber o lote NÃO encerra
 * as viagens ("cada uma por si"): cada uma termina pelo código ou pelo botão Finalizar.
 */
export function CodigoDeChegada({ ordemId }: { ordemId: string }) {
  const { t } = useTranslation()
  const abertas = (useViagensDoLote(ordemId).data ?? []).filter(
    (v) => !v.somenteLeitura && v.status !== 'finalizada' && v.status !== 'cancelada',
  )
  if (!abertas.length) return null
  return (
    <Alert tone="info" title={t('viagens.recebimento.titulo')} className="sm:col-span-2">
      <ul className="flex flex-col gap-0.5">
        {abertas.map((v) => (
          <li key={v.id}>
            {t('viagens.card.caminhao', { n: v.numero })}
            {v.placa ? ` · ${v.placa}` : ''}
            {v.codigoChegada && (
              <>
                {' · '}
                {t('viagens.card.codigoChegada')}{' '}
                <span className="font-mono type-label num">{v.codigoChegada}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1">{t('viagens.recebimento.naoEncerra')}</p>
    </Alert>
  )
}
