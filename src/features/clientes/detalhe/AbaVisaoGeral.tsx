import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { CalendarClock } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KpiCard } from '@/components/ui/kpi-card'
import { KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { SeletorPeriodo } from '@/features/historico/SeletorPeriodo'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatCnpj, formatDate, formatNumber, formatPhone, formatRelative } from '@/lib/format'
import type { Cliente, PainelCliente, PeriodoPainel } from '@/services/types'
import { usePainelCliente } from '../use-clientes'
import { EmailLink } from './comum'
import { LinkRastreio } from './LinkRastreio'
import {
  CartaoPrazo,
  GraficoEtapas,
  GraficoMateriais,
  GraficoMeses,
  GraficoOcorrencias,
} from './PainelGraficos'

/**
 * Visão geral do cliente = o PAINEL dele (pedido do usuário, 27/10/2026): números de agora e do
 * período escolhido, lotes por etapa, coletas e kg por mês, kg por material, prazo (SLA) e
 * ocorrências; embaixo, os últimos lotes, o contato principal, os dados e o link de
 * acompanhamento. Os lotes de qualquer origem contam; a mesma coleta conta uma vez.
 */
export function AbaVisaoGeral({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const [periodo, setPeriodo] = useState<PeriodoPainel>('365')
  const painel = usePainelCliente(c.id, periodo)
  const p = painel.data
  const principal = c.contatos.find((k) => k.principal) ?? c.contatos[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="flex items-center gap-2 type-body text-muted-foreground">
          <CalendarClock aria-hidden className="size-4" />
          {p?.agora.proximaColeta
            ? t('clientes.painel.proximaColeta', { dia: formatDate(p.agora.proximaColeta) })
            : t('clientes.painel.semProximaColeta')}
        </p>
        <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
      </div>

      {painel.isError && (
        <Alert tone="danger" title={t('clientes.painel.erro')}>
          {apiErrorMessage(painel.error)}
        </Alert>
      )}

      <Numeros p={p} carregando={painel.isPending} />

      {painel.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : p ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GraficoMeses p={p} />
          <GraficoEtapas p={p} />
          <GraficoMateriais p={p} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <CartaoPrazo p={p} />
            <GraficoOcorrencias p={p} />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('clientes.visaoGeral.ultimosTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {painel.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : !p?.ultimos.length ? (
              <EmptyState size="sm" title={t('clientes.visaoGeral.semLotes')} />
            ) : (
              <ul className="divide-y">
                {p.ultimos.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2">
                    <Link
                      to="/ordens/lotes/$id"
                      params={{ id: l.id }}
                      className="font-mono type-body text-link underline-offset-4 hover:underline"
                    >
                      {l.codigo}
                    </Link>
                    <StatusBadge status={l.status} size="sm" />
                    <span
                      className="ml-auto type-caption text-muted-foreground"
                      title={formatDate(l.alteradoEm)}
                    >
                      {formatRelative(l.alteradoEm)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('clientes.detail.mainContact')}</CardTitle>
          </CardHeader>
          <CardContent>
            {principal ? (
              <KeyValueList
                items={[
                  { label: t('clientes.form.contactName'), value: principal.nome, full: true },
                  {
                    label: t('clientes.form.email'),
                    value: <EmailLink email={principal.email} />,
                    full: true,
                  },
                  {
                    label: t('clientes.form.phone'),
                    value: <span className="num">{formatPhone(principal.telefone)}</span>,
                    full: true,
                  },
                ]}
              />
            ) : (
              <EmptyState size="sm" title={t('clientes.detail.noContacts')} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t('clientes.detail.general')}</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValueList
              items={[
                { label: t('clientes.cols.nome'), value: c.nome },
                {
                  label: t('clientes.cols.cnpj'),
                  value: <span className="font-mono">{formatCnpj(c.cnpj)}</span>,
                },
                {
                  label: t('clientes.cols.codigo'),
                  value: <span className="font-mono">{c.codigo}</span>,
                },
                { label: t('clientes.cols.status'), value: t(`status.${c.status}`) },
                { label: t('clientes.cols.criadoEm'), value: formatDate(c.criadoEm) },
              ]}
            />
          </CardContent>
        </Card>

        <LinkRastreio c={c} />
      </div>
    </div>
  )
}

/** Os números: de agora (a chegar, em operação) e do período escolhido. */
function Numeros({ p, carregando }: { p: PainelCliente | undefined; carregando: boolean }) {
  const { t } = useTranslation()
  const n = (v: number | undefined) => (v === undefined ? '—' : formatNumber(v))
  const cards = [
    { id: 'aChegar', valor: n(p?.agora.aChegar) },
    { id: 'emOperacao', valor: n(p?.agora.emOperacao) },
    { id: 'lotesPeriodo', valor: n(p?.numeros.lotes) },
    { id: 'concluidos', valor: n(p?.numeros.concluidos) },
    {
      id: 'kgRecebidos',
      valor: p ? `${formatNumber(p.numeros.kgRecebidos, { maximumFractionDigits: 1 })} kg` : '—',
    },
    { id: 'palletsRecebidos', valor: n(p?.numeros.palletsRecebidos) },
  ] as const
  return (
    <section aria-labelledby="painel-numeros">
      <h2 id="painel-numeros" className="sr-only">
        {t('clientes.painel.numerosTitulo')}
      </h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((k) => (
          <li key={k.id}>
            <KpiCard
              className="h-full"
              label={t(`clientes.painel.kpis.${k.id}`)}
              value={k.valor}
              loading={carregando}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
