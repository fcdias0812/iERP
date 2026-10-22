import { useTranslation } from 'react-i18next'
import { Unplug } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KpiCard } from '@/components/ui/kpi-card'
import { KeyValueList } from '@/components/ui/metadata'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCnpj, formatDate, formatNumber, formatPhone, formatRelative } from '@/lib/format'
import type { Cliente } from '@/services/types'
import { useLotesResumo } from '../use-clientes'
import { EmailLink } from './comum'
import { LinkRastreio } from './LinkRastreio'

const INDICADORES = ['aChegar', 'emOperacao', 'finalizados'] as const

/**
 * Visão geral do cliente: lotes a chegar / em operação / finalizados, os últimos lotes com
 * atualização, os dados do cliente e o contato principal.
 * Os lotes vêm dos sistemas de produção: sem a integração ligada, mostra "—" e um aviso.
 */
export function AbaVisaoGeral({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const lotes = useLotesResumo(c.id)
  const resumo = lotes.data
  const conectado = Boolean(resumo?.conectado)
  const principal = c.contatos.find((k) => k.principal) ?? c.contatos[0]

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="lotes-kpis" className="flex flex-col gap-3">
        <h2 id="lotes-kpis" className="sr-only">
          {t('clientes.visaoGeral.lotesTitle')}
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {INDICADORES.map((id) => (
            <li key={id}>
              <KpiCard
                className="h-full"
                label={t(`clientes.visaoGeral.kpis.${id}`)}
                value={resumo && conectado ? formatNumber(resumo[id]) : '—'}
                loading={lotes.isPending}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('clientes.visaoGeral.ultimosTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {lotes.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : !conectado ? (
              <EmptyState
                size="sm"
                icon={<Unplug />}
                title={t('clientes.visaoGeral.semIntegracaoTitle')}
                description={t('clientes.visaoGeral.semIntegracaoBody')}
              />
            ) : !resumo?.ultimos.length ? (
              <EmptyState size="sm" title={t('clientes.visaoGeral.semLotes')} />
            ) : (
              <ul className="divide-y">
                {resumo.ultimos.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-mono type-body">{l.codigo}</span>
                    <span className="min-w-0 truncate type-body">{l.status}</span>
                    <span className="type-caption text-muted-foreground">
                      {formatRelative(l.atualizadoEm)}
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
