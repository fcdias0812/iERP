import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Printer, TriangleAlert } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate, formatNumber } from '@/lib/format'
import { useImprimirEtiquetas, type EtiquetaPallet } from './etiquetas-pallet'

/*
 * As etiquetas de pallet na tela (27/10/2026, como no iERP 1.0): a janela que COBRA a impressão
 * antes de concluir o recebimento novo e o "imprimir de novo" do menu Gerar do lote.
 */

const kg = (n: number | null) =>
  n === null ? '—' : `${formatNumber(n, { maximumFractionDigits: 3 })} kg`

/**
 * Recebimento novo: chegaram N pallets, saem N etiquetas. Concluir só é liberado DEPOIS de abrir a
 * impressão (o sistema não sabe se o papel saiu; garante que a impressão foi pedida). Nada foi
 * gravado ainda: Voltar fecha a janela e o formulário continua como estava.
 */
export function EtiquetasDoRecebimento({
  loteId,
  etiquetas,
  salvando,
  onConcluir,
  onVoltar,
}: {
  loteId: string
  etiquetas: EtiquetaPallet[]
  salvando: boolean
  onConcluir: () => void
  onVoltar: () => void
}) {
  const { t } = useTranslation()
  const imprimir = useImprimirEtiquetas()
  const [abriu, setAbriu] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  const primeira = etiquetas[0]!
  const n = etiquetas.length

  const abrir = async () => {
    const ok = await imprimir(etiquetas, loteId)
    setBloqueado(!ok)
    if (ok) setAbriu(true)
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !salvando && onVoltar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer aria-hidden className="size-5 text-primary" />
            {t('recebimento.etiquetas.titulo')}
          </DialogTitle>
          <DialogDescription>{t('recebimento.etiquetas.explica', { n })}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono type-label">{primeira.lote}</span>
          <span className="type-body">{primeira.cliente}</span>
          <span className="type-caption text-muted-foreground num">
            {formatDate(primeira.data)}
          </span>
        </div>

        <ul
          aria-label={t('recebimento.etiquetas.lista')}
          className="max-h-60 divide-y overflow-y-auto rounded-md border"
        >
          {etiquetas.map((e) => (
            <li key={e.posicao} className="flex items-center justify-between px-3 py-2 type-body">
              <span>
                {t('recebimento.etiquetas.pallet')}{' '}
                <span className="num">
                  {e.posicao}/{e.total}
                </span>
              </span>
              <span className="font-medium num">{kg(e.bruto)}</span>
            </li>
          ))}
        </ul>

        {bloqueado && (
          <Alert tone="danger" title={t('recebimento.etiquetas.bloqueadoTitulo')}>
            {t('recebimento.etiquetas.bloqueado')}
          </Alert>
        )}

        {abriu ? (
          <p className="flex items-center gap-2 type-body">
            <CircleCheck aria-hidden className="size-4 shrink-0 text-success-subtle-foreground" />
            {t('recebimento.etiquetas.aberta')}
          </p>
        ) : (
          <p className="flex items-center gap-2 type-body">
            <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning-subtle-foreground" />
            {t('recebimento.etiquetas.semImprimir')}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onVoltar} disabled={salvando}>
            {t('recebimento.etiquetas.voltar')}
          </Button>
          {abriu && (
            <Button variant="secondary" onClick={() => void abrir()} disabled={salvando}>
              <Printer aria-hidden />
              {t('recebimento.etiquetas.deNovo')}
            </Button>
          )}
          {abriu ? (
            <Button
              variant="success"
              onClick={onConcluir}
              disabled={salvando}
              aria-busy={salvando || undefined}
            >
              {t('recebimento.etiquetas.concluir')}
            </Button>
          ) : (
            <Button onClick={() => void abrir()}>
              <Printer aria-hidden />
              {t('recebimento.etiquetas.imprimir', { n })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
