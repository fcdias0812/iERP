import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Copy, ExternalLink, Flag, MessageSquare, Siren } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { toast } from '@/components/ui/sonner'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Viagem } from '@/services/types'
import { kmh } from './formato'

/*
 * O card de uma viagem (Ordens › Viagens): lote, situação, motorista e placa, última posição,
 * o CÓDIGO DE CHEGADA (falado no destino — nunca vai no link) e as ações: copiar o link do
 * motorista, copiar o código, conversar, finalizar e dar ciência da emergência. Lote de fora
 * (Gerenciamento/MSDC): só para ver.
 */

async function copiar(texto: string, ok: string, falhou: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(ok)
  } catch {
    toast.error(falhou)
  }
}

export function CardViagem({
  v,
  escolhida = false,
  onEscolher,
  semAbrirLote = false,
  onChat,
  onFinalizar,
  onCiente,
}: {
  v: Viagem
  escolhida?: boolean
  /** Escolher no mapa (Ordens › Viagens). Sem ela, o cabeçalho é só texto (dentro do lote). */
  onEscolher?: () => void
  /** Dentro do próprio lote, o link "Abrir lote" sai. */
  semAbrirLote?: boolean
  onChat: () => void
  onFinalizar: () => void
  onCiente: () => void
}) {
  const { t } = useTranslation()
  const naRua = v.status === 'em_rota' || v.status === 'chegou'
  const sos = v.emergencia && !v.emergencia.cienteEm
  const cabecalho = (
    <>
      <span className="font-mono type-label">{v.loteCodigo}</span>
      <span className="type-caption text-muted-foreground">
        {[v.motoristaNome ?? t('viagens.card.motoristaADefinir'), v.placa]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </>
  )
  return (
    <article
      aria-label={t('viagens.card.rotulo', { code: v.loteCodigo })}
      className={cn(
        'flex flex-col gap-2 rounded-md border bg-card p-3',
        escolhida && 'border-primary ring-1 ring-primary',
        sos && 'border-danger-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {onEscolher ? (
          <button
            type="button"
            onClick={onEscolher}
            aria-pressed={escolhida}
            className="flex min-w-0 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {cabecalho}
          </button>
        ) : (
          <div className="flex min-w-0 flex-col items-start">{cabecalho}</div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {sos && <StatusBadge status="viagem_emergencia" variant="solid" />}
          <StatusBadge status={`viagem_${v.status}`} />
        </div>
      </div>

      <p className="type-caption text-muted-foreground">
        {[v.clienteNome, v.siteCodigo].filter(Boolean).join(' · ')}
        {v.somenteLeitura && (
          <>
            {' · '}
            <span className="text-foreground">
              {t('viagens.card.deFora', {
                sistema: t(`viagens.origens.${v.origem}`, { defaultValue: v.origem }),
              })}
            </span>
          </>
        )}
      </p>

      {v.posicao && (
        <p className="type-caption num" title={formatDateTime(v.posicao.em)}>
          {t('viagens.card.posicao', { quando: formatRelative(v.posicao.em) })}
          {v.posicao.velocidade !== null &&
            ` · ${t('viagens.card.velocidade', { kmh: kmh(v.posicao.velocidade) })}`}
        </p>
      )}

      {sos && (
        <div className="flex flex-col gap-2 rounded-sm border border-danger-border bg-danger-subtle p-2 text-danger-subtle-foreground">
          <p className="flex items-center gap-2 type-label">
            <Siren className="size-4 shrink-0" aria-hidden />
            {t('viagens.emergencia.tipo', {
              tipo: t(`viagens.emergencias.${v.emergencia!.tipo ?? 'outra'}`, {
                defaultValue: v.emergencia!.tipo ?? '',
              }),
            })}
            <span className="type-caption">· {formatDateTime(v.emergencia!.em)}</span>
          </p>
          {!v.somenteLeitura && (
            <Can permission="ordens.viagens.editar" fallback="disable">
              <Button size="sm" variant="destructive" onClick={onCiente}>
                {t('viagens.emergencia.ciente')}
              </Button>
            </Can>
          )}
        </div>
      )}

      {v.codigoChegada && v.status !== 'finalizada' && v.status !== 'cancelada' && (
        <p className="type-caption">
          {t('viagens.card.codigoChegada')}{' '}
          <span className="font-mono type-label num">{v.codigoChegada}</span>{' '}
          <span className="text-muted-foreground">{t('viagens.card.codigoAviso')}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {v.linkMotorista && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void copiar(
                v.linkMotorista!,
                t('viagens.card.linkCopiado'),
                t('viagens.card.copiaFalhou'),
              )
            }
          >
            <Copy aria-hidden />
            {t('viagens.card.copiarLink')}
          </Button>
        )}
        {v.codigoChegada && v.status !== 'finalizada' && v.status !== 'cancelada' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void copiar(
                v.codigoChegada!,
                t('viagens.card.codigoCopiado'),
                t('viagens.card.copiaFalhou'),
              )
            }
          >
            <Copy aria-hidden />
            {t('viagens.card.copiarCodigo')}
          </Button>
        )}
        {v.tripId !== null && (
          <Button size="sm" variant="secondary" onClick={onChat}>
            <MessageSquare aria-hidden />
            {t('viagens.chat.abrir')}
          </Button>
        )}
        {naRua && !v.somenteLeitura && (
          <Can permission="ordens.viagens.editar" fallback="disable">
            <Button size="sm" variant="secondary" onClick={onFinalizar}>
              <Flag aria-hidden />
              {t('viagens.finalizar.botao')}
            </Button>
          </Can>
        )}
        {!semAbrirLote && (
          <Button size="sm" variant="ghost" asChild>
            <Link to="/ordens/lotes/$id" params={{ id: v.ordemId }}>
              <ExternalLink aria-hidden />
              {t('viagens.card.abrirLote')}
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
