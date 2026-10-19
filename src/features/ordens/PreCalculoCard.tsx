import { useTranslation } from 'react-i18next'
import { Calculator, RefreshCw } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatNumber } from '@/lib/format'
import type { AvisoCalculo, CalculoOs } from '@/services/types'

/*
 * Card do PRÉ-CÁLCULO, ao lado do formulário do Agendamento: o que levar, caminhão,
 * capacidade, viagens e pessoas. Fica sempre à vista (vazio, explica o que faz).
 */

const TIPOS = ['truck', 'carreta', 'van'] as const

export function PreCalculoCard({
  calculo,
  erro,
  calculando,
  desatualizado,
  semDoca,
  onCalcular,
}: {
  calculo: CalculoOs | null
  erro: unknown
  calculando: boolean
  /** Os dados mudaram depois do último cálculo. */
  desatualizado: boolean
  semDoca: boolean
  onCalcular: () => void
}) {
  const { t } = useTranslation()
  const tipo = (x: string) =>
    (TIPOS as readonly string[]).includes(x) ? t(`veiculos.tipos.${x as 'van'}`) : x
  const simNao = (v: boolean) => (v ? t('dataTable.yes') : t('dataTable.no'))
  const aviso = (a: AvisoCalculo) =>
    a.codigo === 'sem_servico'
      ? t('ordens.agendamento.calculo.avisos.sem_servico')
      : a.codigo === 'nenhum_cabe'
        ? t('ordens.agendamento.calculo.avisos.nenhum_cabe', { tipo: tipo(a.tipo) })
        : t('ordens.agendamento.calculo.avisos.rebaixado', {
            desejado: tipo(a.desejado),
            final: tipo(a.final),
          })

  const linhas: [string, string][] = calculo
    ? [
        [
          t('ordens.agendamento.calculo.totalVolumes'),
          `${t('ordens.agendamento.calculo.volumesN', { n: formatNumber(calculo.totalVolumes) })} (${t('ordens.agendamento.calculo.boxesNaoContam')})`,
        ],
        [
          t('ordens.agendamento.calculo.caminhao'),
          calculo.veiculo.comprimento
            ? `${tipo(calculo.veiculo.tipo)} · ${formatNumber(calculo.veiculo.comprimento, { maximumFractionDigits: 2 })} m`
            : tipo(calculo.veiculo.tipo),
        ],
        [
          t('ordens.agendamento.calculo.capacidade'),
          t('ordens.agendamento.calculo.volumesN', {
            n: formatNumber(calculo.veiculo.capacidade),
          }),
        ],
        [t('ordens.agendamento.calculo.viagens'), formatNumber(calculo.viagens)],
        [t('ordens.agendamento.calculo.pessoas'), formatNumber(calculo.totalPessoas)],
        [t('ordens.agendamento.calculo.plataforma'), simNao(calculo.caminhaoPlataforma)],
        [t('ordens.agendamento.calculo.shredder'), simNao(calculo.levarShredder)],
        [t('ordens.agendamento.calculo.gaylord'), simNao(calculo.levarGaylordReteck)],
        [
          t('ordens.agendamento.calculo.palletVazio'),
          calculo.levarPalletsVazios
            ? t('ordens.agendamento.calculo.simQtd', {
                n: formatNumber(calculo.qtdPalletsVazios),
              })
            : t('dataTable.no'),
        ],
      ]
    : []

  return (
    <Card role="region" aria-labelledby="pre-calculo-titulo" className="xl:sticky xl:top-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle id="pre-calculo-titulo" className="flex items-center gap-2">
          <Calculator className="size-4 text-muted-foreground" aria-hidden />
          {t('ordens.agendamento.calculo.titulo')}
        </CardTitle>
        {calculo && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onCalcular}
            loading={calculando}
          >
            {!calculando && <RefreshCw aria-hidden />}
            {t('ordens.agendamento.recalcular')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4" aria-live="polite">
        {erro ? (
          <Alert tone="danger" title={t('ordens.agendamento.calculo.erro')}>
            {apiErrorMessage(erro)}
          </Alert>
        ) : null}
        {!calculo ? (
          <>
            <p className="type-body text-muted-foreground">
              {t('ordens.agendamento.calculo.vazio')}
            </p>
            {semDoca && (
              <p className="type-caption text-muted-foreground">
                {t('ordens.agendamento.calculo.faltaDoca')}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={onCalcular}
              loading={calculando}
              className="self-start"
            >
              {!calculando && <Calculator aria-hidden />}
              {t('ordens.agendamento.preCalcular')}
            </Button>
          </>
        ) : (
          <>
            {desatualizado && (
              <Alert tone="warning" title={t('ordens.agendamento.calculo.desatualizado')} />
            )}
            <dl className="divide-y">
              {linhas.map(([rotulo, valor]) => (
                <div key={rotulo} className="flex items-baseline justify-between gap-3 py-2">
                  <dt className="type-body text-muted-foreground">{rotulo}</dt>
                  <dd className="text-right type-body font-medium num">{valor}</dd>
                </div>
              ))}
            </dl>
            {calculo.avisos.length > 0 && (
              <Alert tone="alert" title={calculo.avisos.map(aviso).join(' · ')} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
