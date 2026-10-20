import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useInformacoesDoLote } from '@/features/lotes/informacoes-lote'
import { useLote } from '@/features/ordens/use-ordens'
import { apiErrorMessage } from '@/lib/api-errors'
import { cn } from '@/lib/utils'
import type { DashboardOperacao, Ordem } from '@/services/types'
import { StatusDoLote } from '@/features/lotes/StatusDoLote'

/*
 * Card de uma coleta no Forecast (Operação › Dashboard). Borda TRACEJADA = só a coleta prevista;
 * CONTÍNUA = data de coleta confirmada (pedido do usuário, 19/10/2026). Com o mouse em cima, abre
 * uma janela com todos os detalhes da coleta (local, datas, transporte, serviços, quantidades e
 * pré-cálculo) — dá para selecionar o texto. O card é um link para o lote (teclado e leitor de
 * tela chegam às mesmas informações por ele).
 */

type LoteForecast = DashboardOperacao['forecast'][number]['lotes'][number]

export function CardColeta({ lote, volumes }: { lote: LoteForecast; volumes: string }) {
  const { t } = useTranslation()
  const [aberto, setAberto] = useState(false)
  return (
    <HoverCard open={aberto} onOpenChange={setAberto} openDelay={300} closeDelay={200}>
      <HoverCardTrigger asChild>
        <Link
          to="/operacao/lotes/$id"
          params={{ id: lote.id }}
          data-confirmada={lote.confirmada}
          className={cn(
            'flex flex-col rounded-md border-2 border-border-strong bg-card p-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
            lote.confirmada ? 'border-solid' : 'border-dashed',
          )}
        >
          <span className="truncate type-label">{lote.clienteNome}</span>
          <span className="truncate type-caption text-muted-foreground">
            <span className="font-mono">{lote.siteCodigo}</span> ·{' '}
            <span className="font-mono">{lote.codigo}</span>
          </span>
          <span className="type-caption num">{volumes}</span>
          <span className="sr-only">
            {t(lote.confirmada ? 'status.coleta_confirmada' : 'status.coleta_prevista')}
          </span>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        // Embaixo do card: o Radix desliza a janela na horizontal para caber na tela (ao lado,
        // numa tela estreita, ela saía pela esquerda).
        side="bottom"
        align="start"
        collisionPadding={16}
        aria-label={t('operacao.dashboard.forecast.detalhes')}
        className="flex max-h-[min(75vh,44rem,var(--radix-hover-card-content-available-height))] w-[36rem] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto p-0"
      >
        {/* Só busca o lote quando a janela abre. */}
        {aberto && <Detalhes id={lote.id} confirmada={lote.confirmada} />}
      </HoverCardContent>
    </HoverCard>
  )
}

function Detalhes({ id, confirmada }: { id: string; confirmada: boolean }) {
  const { t } = useTranslation()
  const lote = useLote(id)
  if (lote.isPending)
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy>
        <span className="sr-only">{t('operacao.dashboard.forecast.carregando')}</span>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  if (lote.isError)
    return (
      <p className="p-4 type-body text-danger-subtle-foreground">
        {t('operacao.dashboard.forecast.erro')} {apiErrorMessage(lote.error)}
      </p>
    )
  return <Conteudo o={lote.data} confirmada={confirmada} />
}

function Conteudo({ o, confirmada }: { o: Ordem; confirmada: boolean }) {
  const { t } = useTranslation()
  const info = useInformacoesDoLote(o)
  return (
    <>
      <div className="flex flex-col gap-1 border-b p-4">
        <p className="flex flex-wrap items-center gap-2">
          <span className="type-card-title">{o.clienteNome}</span>
          <span className="font-mono type-caption text-muted-foreground">{o.codigo}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={confirmada ? 'coleta_confirmada' : 'coleta_prevista'} />
          <StatusDoLote lote={o} />
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <Bloco titulo={t('lotes.informacoes.local')}>
          {info.carregandoSite ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <KeyValueList columns={2} items={info.local} />
          )}
        </Bloco>
        <Bloco titulo={t('lotes.informacoes.datas')}>
          <KeyValueList columns={2} items={info.datas} />
        </Bloco>
        <Bloco titulo={t('lotes.informacoes.transporte')}>
          <KeyValueList columns={2} items={info.transporte} />
        </Bloco>
        <Bloco titulo={t('lotes.informacoes.servicosQuantidades')}>
          <p className="mb-3 type-body">
            {info.servicos.length
              ? info.servicos.join(' · ')
              : t('operacao.dashboard.forecast.servicosNenhum')}
          </p>
          <KeyValueList columns={2} items={info.quantidades} />
        </Bloco>
        <Bloco titulo={t('ordens.agendamento.calculo.titulo')}>
          {info.calculo ? (
            <KeyValueList columns={2} items={info.calculo} />
          ) : (
            <p className="type-body text-muted-foreground">{t('lotes.informacoes.semCalculo')}</p>
          )}
        </Bloco>
        <Link
          to="/operacao/lotes/$id"
          params={{ id: o.id }}
          className="inline-flex items-center gap-1 self-start type-body text-link underline-offset-4 hover:underline"
        >
          {t('operacao.dashboard.forecast.abrirLote')}
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      </div>
    </>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="type-label text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  )
}
