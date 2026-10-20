import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyValueList } from '@/components/ui/metadata'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Ordem } from '@/services/types'

/*
 * O lote num sistema de fora (Dell → MoonShot — pedido do usuário, 19/10/2026): a fase de lá e
 * o pedido de DEVOLUÇÃO ao recebimento (o sistema de fora achou erro no que a doca registrou;
 * corrigido o recebimento aqui, ele destrava sozinho).
 */

/** Nome do sistema para a tela (o código viaja no contrato). */
const nomeDoSistema = (t: (k: string) => string, codigo: string | undefined) =>
  codigo ? t(`integracao.sistemas.${codigo}`) : t('integracao.sistemas.MOONSHOT')

export function AvisoDevolucao({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  if (!o.devolucao) return null
  const sistema = nomeDoSistema(t as (k: string) => string, o.processamento?.sistema)
  return (
    <Alert tone="alert" title={t('lotes.devolucao.titulo', { sistema })}>
      <p>
        {t('lotes.devolucao.motivo')}: {o.devolucao.motivo ?? '—'}
      </p>
      <p className="type-caption">
        {t('lotes.devolucao.pedidoPor', {
          quem: o.devolucao.pedidoPor ?? sistema,
          quando: formatDateTime(o.devolucao.em),
        })}{' '}
        {t('lotes.devolucao.oQueFazer', { sistema })}
      </p>
    </Alert>
  )
}

export function CardProcessamento({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const p = o.processamento
  if (!p) return null
  const sistema = nomeDoSistema(t as (k: string) => string, p.sistema)
  // Lote do Gerenciamento de Projetos: é o andamento LÁ (criado, recebido e concluído lá).
  const deFora = Boolean(o.externo)
  const fase =
    p.indice != null
      ? `${p.indice}/${p.total ?? '?'}${p.etapa ? ` · ${p.etapa}` : ''}`
      : (p.etapa ?? null)
  return (
    <Card role="region" aria-labelledby="lote-processamento">
      <CardHeader>
        <CardTitle id="lote-processamento">
          {deFora
            ? t('lotes.deFora.andamento', { sistema })
            : t('lotes.processamento.titulo', { sistema })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {o.status === 'inspecao' && !deFora && (
          <p className="type-body text-muted-foreground">
            {t('lotes.processamento.aguardando', { sistema })}
          </p>
        )}
        <KeyValueList
          columns={3}
          items={[
            { label: t('lotes.processamento.fase'), value: fase },
            {
              label: t('lotes.processamento.desde'),
              value: p.desde ? formatDate(p.desde) : null,
            },
            {
              label: t('lotes.processamento.atualizado'),
              value: p.atualizadoEm ? formatDateTime(p.atualizadoEm) : null,
            },
          ]}
        />
        {p.url && (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 self-start type-body text-link underline-offset-4 hover:underline"
          >
            {t('lotes.processamento.abrir', { sistema })}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </CardContent>
    </Card>
  )
}
