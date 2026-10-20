import { useTranslation } from 'react-i18next'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { EMPTY, formatDateTime, formatNumber, formatTime } from '@/lib/format'
import type { ViagemDetalhe } from '@/services/types'
import { distanciaDoTrajeto, kmh } from './formato'
import { VELOCIDADES, type Replay } from './use-replay'

/*
 * O resumo da viagem escolhida (abaixo do mapa): motorista, horários, distância, as paradas que o
 * motorista reportou (com a foto, se tiver) e — nas terminadas — o REPLAY do trajeto no mapa.
 */

export function PainelViagem({ d, replay }: { d: ViagemDetalhe; replay?: Replay }) {
  const { t } = useTranslation()
  // Na rua, a distância é a do trajeto até agora (a final é gravada ao arquivar).
  const metros = d.distanciaMetros ?? (d.trajeto.length > 1 ? distanciaDoTrajeto(d.trajeto) : null)
  const km = metros !== null ? formatNumber(metros / 1000, { maximumFractionDigits: 1 }) : null
  const ponto =
    replay?.indice !== null && replay?.indice !== undefined ? d.trajeto[replay.indice] : null
  const linhas: [string, string][] = [
    [t('viagens.painel.motorista'), d.motoristaNome ?? EMPTY],
    [t('viagens.painel.placa'), d.placa ?? EMPTY],
    [t('viagens.painel.iniciada'), formatDateTime(d.iniciadaEm)],
    [t('viagens.painel.chegou'), formatDateTime(d.chegouEm)],
    [t('viagens.painel.terminada'), formatDateTime(d.terminadaEm)],
    [
      t('viagens.painel.finalizadaPor'),
      d.finalizadaPor ? t(`viagens.finalizadaPor.${d.finalizadaPor}`) : EMPTY,
    ],
    [t('viagens.painel.distancia'), km ? `${km} km` : EMPTY],
    [t('viagens.painel.pontos'), formatNumber(d.trajeto.length || d.totalPontos)],
  ]
  return (
    <div className="flex flex-col gap-4">
      {d.rastreadorIndisponivel && (
        <Alert tone="warning" title={t('viagens.painel.rastreadorIndisponivel')} />
      )}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex flex-col">
            <dt className="type-caption text-muted-foreground">{rotulo}</dt>
            <dd className="type-body num">{valor}</dd>
          </div>
        ))}
      </dl>

      {replay && d.trajeto.length > 1 && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            {replay.tocando ? (
              <Button size="sm" onClick={replay.pausar}>
                <Pause aria-hidden />
                {t('viagens.replay.pausar')}
              </Button>
            ) : (
              <Button size="sm" onClick={replay.tocar}>
                <Play aria-hidden />
                {t('viagens.replay.tocar')}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={replay.reiniciar}>
              <RotateCcw aria-hidden />
              {t('viagens.replay.reiniciar')}
            </Button>
            <ButtonGroup aria-label={t('viagens.replay.velocidade')}>
              {VELOCIDADES.map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={replay.velocidade === v ? 'default' : 'secondary'}
                  aria-pressed={replay.velocidade === v}
                  onClick={() => replay.setVelocidade(v)}
                >
                  {`${v}×`}
                </Button>
              ))}
            </ButtonGroup>
            <span className="type-caption text-muted-foreground num" aria-live="polite">
              {ponto
                ? t('viagens.replay.momento', {
                    hora: formatTime(ponto.em),
                    kmh: kmh(ponto.velocidade) ?? EMPTY,
                  })
                : t('viagens.replay.inicio')}
            </span>
          </div>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t('viagens.replay.posicao')}</span>
            <input
              type="range"
              min={0}
              max={d.trajeto.length - 1}
              value={replay.indice ?? d.trajeto.length - 1}
              onChange={(e) => {
                replay.pausar()
                replay.setIndice(Number(e.target.value))
              }}
              className="w-full accent-primary"
            />
          </label>
        </div>
      )}

      <section aria-labelledby="paradas-titulo" className="flex flex-col gap-2">
        <h3 id="paradas-titulo" className="type-label">
          {t('viagens.painel.paradas', { n: d.paradas.length })}
        </h3>
        {d.paradas.length === 0 ? (
          <p className="type-caption text-muted-foreground">{t('viagens.painel.semParadas')}</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {d.paradas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 type-caption">
                <span className="text-muted-foreground num">{formatDateTime(p.em)}</span>
                <span>{p.motivo}</span>
                {p.fotoUrl && (
                  <a
                    href={p.fotoUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline"
                  >
                    {t('viagens.painel.verFoto')}
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
