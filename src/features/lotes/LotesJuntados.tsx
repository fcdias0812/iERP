import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatNumber } from '@/lib/format'
import type { Ordem } from '@/services/types'
import { ExcluirLote } from './ExcluirLote'

/*
 * A MESMA COLETA (pedido do usuário, 22/10/2026): os lotes juntados a este (mesmo cliente,
 * endereço e data). As quantidades, serviços, documentos e viagens já aparecem somados no lote;
 * aqui fica cada pedido, com o escopo dele e o botão para o lote no sistema de lá (Gerenciamento,
 * MSDC — "por isso o botão para ver diretamente o lote no sistema").
 */
export function LotesJuntados({ o, permissaoExcluir }: { o: Ordem; permissaoExcluir: string }) {
  const { t } = useTranslation()
  if (!o.juntados.length) return null
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{t('lotes.juntados.titulo', { n: o.juntados.length + 1 })}</CardTitle>
        <CardDescription>{t('lotes.juntados.descricao', { code: o.codigo })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {o.juntados.map((j) => {
            const sistema = t(`integracao.sistemas.${j.origem}`, { defaultValue: j.origem })
            return (
              <li key={j.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono type-label">{j.codigo}</span>
                  <StatusBadge status={j.status} size="sm" />
                  <span className="type-caption text-muted-foreground">
                    {[
                      j.origem === 'IERP' ? t('lotes.juntados.daqui') : sistema,
                      j.referenciaCliente,
                      t('lotes.juntados.volumes', { n: formatNumber(j.totalVolumes) }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {j.url && (
                    <Button size="sm" variant="secondary" className="ml-auto" asChild>
                      <a href={j.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink aria-hidden />
                        {t('lotes.deFora.abrir', { sistema })}
                      </a>
                    </Button>
                  )}
                  {/* O juntado daqui, ainda agendado, sai sozinho (27/10/2026: "um por um"). */}
                  {j.origem === 'IERP' && j.status === 'agendado' && !o.externo && (
                    <span className="ml-auto">
                      <ExcluirLote
                        id={j.id}
                        codigo={j.codigo}
                        cliente={o.clienteNome}
                        permissao={permissaoExcluir}
                        compacto
                      />
                    </span>
                  )}
                </div>
                {j.escopo && (
                  <p className="type-caption whitespace-pre-line text-muted-foreground">
                    {j.escopo}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

/**
 * O botão para o lote NO OUTRO SISTEMA (pedido do usuário, 22/10/2026): Gerenciamento e MSDC
 * sempre (o lote nasce e termina lá); MoonShot só depois do recebimento (antes ele só existe aqui).
 */
export function AbrirNoSistema({ o }: { o: Ordem }) {
  const { t } = useTranslation()
  const externo = o.externo?.url
    ? { url: o.externo.url, sistema: o.externo.sistema }
    : o.processamento?.url && o.status !== 'agendado'
      ? { url: o.processamento.url, sistema: o.processamento.sistema }
      : null
  if (!externo) return null
  const sistema = t(`integracao.sistemas.${externo.sistema}`, { defaultValue: externo.sistema })
  return (
    <Button variant="secondary" asChild>
      <a href={externo.url} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden />
        {t('lotes.deFora.abrir', { sistema })}
      </a>
    </Button>
  )
}
