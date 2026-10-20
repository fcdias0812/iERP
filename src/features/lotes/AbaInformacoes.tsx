import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { EMPTY } from '@/lib/format'
import type { Ordem } from '@/services/types'
import { useInformacoesDoLote } from './informacoes-lote'
import { DadosDeFora } from './LoteDeFora'

/*
 * Informações do lote (primeira aba): tudo o que foi agendado — cliente e local da coleta
 * (endereço, horário e restrições da doca vêm do cadastro do site), datas, transporte,
 * serviços, quantidades, pré-cálculo, escopo e observações. Os arquivos ficam na aba Documentos.
 */
export function AbaInformacoes({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const info = useInformacoesDoLote(o)
  const campo = (k: string) => t(`ordens.agendamento.campos.${k as 'cliente'}`)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DadosDeFora o={o} />
      {o.status !== 'agendado' && !o.externo && (
        <Alert tone="info" title={t('lotes.editar.travadoTitle')} className="lg:col-span-2">
          {t('lotes.editar.travadoBody')}
        </Alert>
      )}
      <Secao id="lote-info-local" titulo={t('lotes.informacoes.local')} className="lg:col-span-2">
        {info.carregandoSite ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <KeyValueList columns={3} items={info.local} />
        )}
      </Secao>

      <Secao id="lote-info-datas" titulo={t('lotes.informacoes.datas')}>
        <KeyValueList columns={2} items={info.datas} />
      </Secao>

      <Secao id="lote-info-transporte" titulo={t('lotes.informacoes.transporte')}>
        <KeyValueList columns={2} items={info.transporte} />
      </Secao>

      <Secao id="lote-info-servicos" titulo={t('lotes.informacoes.servicosQuantidades')}>
        <div className="flex flex-col gap-4">
          {info.servicos.length ? (
            <ul
              aria-label={t('ordens.agendamento.secoes.servicos')}
              className="flex flex-col gap-1"
            >
              {info.servicos.map((s) => (
                <li key={s} className="type-body">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body text-muted-foreground">{EMPTY}</p>
          )}
          <KeyValueList columns={2} items={info.quantidades} />
        </div>
      </Secao>

      <Secao id="lote-info-calculo" titulo={t('ordens.agendamento.calculo.titulo')}>
        {info.calculo ? (
          <KeyValueList columns={2} items={info.calculo} />
        ) : (
          <p className="type-body text-muted-foreground">{t('lotes.informacoes.semCalculo')}</p>
        )}
      </Secao>

      <Secao id="lote-info-escopo" titulo={campo('escopo')}>
        <p className="type-body whitespace-pre-line">{o.escopo || EMPTY}</p>
      </Secao>
      <Secao id="lote-info-observacoes" titulo={campo('observacoes')}>
        <p className="type-body whitespace-pre-line">{o.observacoes || EMPTY}</p>
      </Secao>
    </div>
  )
}

function Secao({
  id,
  titulo,
  className,
  children,
}: {
  id: string
  titulo: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card role="region" aria-labelledby={id} className={className}>
      <CardHeader>
        <CardTitle id={id}>{titulo}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
