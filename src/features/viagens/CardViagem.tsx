import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Copy, ExternalLink, Flag, MessageSquare, Satellite, Siren, Smartphone } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { toast } from '@/components/ui/sonner'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Viagem } from '@/services/types'
import { AdicionarRastreador } from './AdicionarRastreador'
import { kmh } from './formato'
import { UsarRastreador } from './UsarRastreador'

/*
 * O card de um CAMINHÃO (Ordens › Viagens e aba Informações do lote): lote, situação, motorista e
 * placa, última posição, o CÓDIGO DE CHEGADA (falado no destino — nunca vai no link) e as ações:
 * copiar o link do motorista, copiar o código, conversar, finalizar e dar ciência da emergência.
 * Um caminhão pode levar mais de um rastreador (28/10/2026): o 1º fica em cima; os outros aparecem
 * numa lista no próprio card, cada um com a sua situação e as suas ações, e "Adicionar rastreador"
 * põe mais um. Lote de fora (Gerenciamento/MSDC): só para ver.
 */

async function copiar(texto: string, ok: string, falhou: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(ok)
  } catch {
    toast.error(falhou)
  }
}

const aberta = (v: Viagem) => v.status !== 'finalizada' && v.status !== 'cancelada'
const naRua = (v: Viagem) => v.status === 'em_rota' || v.status === 'chegou'
const emergencia = (v: Viagem) => Boolean(v.emergencia && !v.emergencia.cienteEm)

export function CardViagem({
  v,
  outros = SEM_OUTROS,
  escolhida = false,
  onEscolher,
  semAbrirLote = false,
  onChat,
  onFinalizar,
  onCiente,
}: {
  /** O rastreador de cima (o mais urgente do caminhão). */
  v: Viagem
  /** Os outros rastreadores do MESMO caminhão. */
  outros?: Viagem[]
  escolhida?: boolean
  /** Escolher no mapa (Ordens › Viagens). Sem ela, o cabeçalho é só texto (dentro do lote). */
  onEscolher?: () => void
  /** Dentro do próprio lote, o link "Abrir lote" sai. */
  semAbrirLote?: boolean
  onChat: (v: Viagem) => void
  onFinalizar: (v: Viagem) => void
  onCiente: (v: Viagem) => void
}) {
  const { t } = useTranslation()
  const sos = emergencia(v)
  const varios = outros.length > 0
  const cabecalho = (
    <>
      <span className="type-label">
        <span className="font-mono">{v.loteCodigo}</span>
        {!v.somenteLeitura && (
          <span className="text-muted-foreground">
            {' · '}
            {t('viagens.card.caminhao', { n: v.numero })}
          </span>
        )}
      </span>
      <span className="type-caption text-muted-foreground">
        {[v.motoristaNome ?? t('viagens.card.motoristaADefinir'), v.placa]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </>
  )
  return (
    <article
      aria-label={
        v.numero > 1
          ? t('viagens.card.rotuloCaminhao', { code: v.loteCodigo, n: v.numero })
          : t('viagens.card.rotulo', { code: v.loteCodigo })
      }
      className={cn(
        'flex flex-col gap-2 rounded-md border bg-card p-3',
        escolhida && 'border-primary ring-1 ring-primary',
        (sos || outros.some(emergencia)) && 'border-danger-border',
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

      {varios && (
        <p className="type-caption">
          {t('viagens.rastreios.n', { n: outros.length + 1 })}
          {' · '}
          <span className="text-muted-foreground">{t('viagens.rastreios.primeiro')}</span>
        </p>
      )}

      {/* Código da viagem no app, quando não é o do lote (LOT-…-V2 — 29/10/2026). */}
      {!v.somenteLeitura && v.origemGps === 'celular' && v.codigoRastreio !== v.loteCodigo && (
        <p className="type-caption">
          {t('viagens.card.codigoApp')} <span className="font-mono">{v.codigoRastreio}</span>
        </p>
      )}

      {v.origemGps === 'aparelho' ? (
        <p className="flex items-center gap-1.5 type-caption">
          <Satellite aria-hidden className="size-3.5 text-muted-foreground" />
          {t('viagens.rastreador.pelo')} <span className="font-mono">{v.rastreadorAparelho}</span>
        </p>
      ) : (
        varios && (
          <p className="flex items-center gap-1.5 type-caption">
            <Smartphone aria-hidden className="size-3.5 text-muted-foreground" />
            {t('viagens.rastreios.celular')}
          </p>
        )
      )}

      {v.posicao && (
        <p className="type-caption num" title={formatDateTime(v.posicao.em)}>
          {t('viagens.card.posicao', { quando: formatRelative(v.posicao.em) })}
          {v.posicao.velocidade !== null &&
            ` · ${t('viagens.card.velocidade', { kmh: kmh(v.posicao.velocidade) })}`}
        </p>
      )}

      {sos && <AvisoEmergencia v={v} onCiente={() => onCiente(v)} />}

      {v.codigoChegada && aberta(v) && (
        <p className="type-caption">
          {t('viagens.card.codigoChegada')}{' '}
          <span className="font-mono type-label num">{v.codigoChegada}</span>{' '}
          <span className="text-muted-foreground">{t('viagens.card.codigoAviso')}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <AcoesDoRastreio
          v={v}
          comCodigo
          onChat={() => onChat(v)}
          onFinalizar={() => onFinalizar(v)}
        />
      </div>

      {varios && (
        <ul
          aria-label={t('viagens.rastreios.outros')}
          className="flex flex-col divide-y rounded-md border"
        >
          {outros.map((r, i) => (
            <li key={r.id} className="flex flex-col gap-1.5 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 type-caption">
                  {r.origemGps === 'aparelho' ? (
                    <Satellite aria-hidden className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Smartphone aria-hidden className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="type-label">{t('viagens.rastreios.rotulo', { n: i + 2 })}</span>
                  {r.origemGps === 'aparelho' ? (
                    <span className="font-mono">{r.rastreadorAparelho}</span>
                  ) : (
                    t('viagens.rastreios.celular')
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {emergencia(r) && (
                    <StatusBadge status="viagem_emergencia" variant="solid" size="sm" />
                  )}
                  <StatusBadge status={`viagem_${r.status}`} size="sm" />
                </span>
              </div>
              {r.posicao && (
                <p className="type-caption num" title={formatDateTime(r.posicao.em)}>
                  {t('viagens.card.posicao', { quando: formatRelative(r.posicao.em) })}
                </p>
              )}
              {emergencia(r) && <AvisoEmergencia v={r} onCiente={() => onCiente(r)} />}
              <div className="flex flex-wrap gap-2">
                <AcoesDoRastreio
                  v={r}
                  onChat={() => onChat(r)}
                  onFinalizar={() => onFinalizar(r)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {(!v.somenteLeitura && aberta(v)) || !semAbrirLote ? (
        <div className="flex flex-wrap gap-2">
          {!v.somenteLeitura && aberta(v) && <AdicionarRastreador v={v} />}
          {!semAbrirLote && (
            <Button size="sm" variant="ghost" asChild>
              <Link to="/ordens/lotes/$id" params={{ id: v.ordemId }}>
                <ExternalLink aria-hidden />
                {t('viagens.card.abrirLote')}
              </Link>
            </Button>
          )}
        </div>
      ) : null}
    </article>
  )
}

const SEM_OUTROS: Viagem[] = []

function AvisoEmergencia({ v, onCiente }: { v: Viagem; onCiente: () => void }) {
  const { t } = useTranslation()
  return (
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
  )
}

/** As ações de UM rastreador: link do motorista, código, conversa, aparelho de GPS, finalizar. */
function AcoesDoRastreio({
  v,
  comCodigo = false,
  onChat,
  onFinalizar,
}: {
  v: Viagem
  /** O código de chegada é do caminhão: o botão de copiar fica só em cima. */
  comCodigo?: boolean
  onChat: () => void
  onFinalizar: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
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
      {comCodigo && v.codigoChegada && aberta(v) && (
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
      {!v.somenteLeitura && v.origemGps === 'celular' && v.status === 'aguardando_motorista' && (
        <UsarRastreador v={v} />
      )}
      {naRua(v) && !v.somenteLeitura && (
        <Can permission="ordens.viagens.editar" fallback="disable">
          <Button size="sm" variant="secondary" onClick={onFinalizar}>
            <Flag aria-hidden />
            {t('viagens.finalizar.botao')}
          </Button>
        </Can>
      )}
    </>
  )
}
