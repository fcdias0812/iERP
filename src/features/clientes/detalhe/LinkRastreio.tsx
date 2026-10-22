import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, ExternalLink, Link2, Link2Off, RefreshCw } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/sonner'
import { urlRastreioPublico } from '@/services/clientes'
import type { Cliente } from '@/services/types'
import { useLinkRastreio } from '../use-clientes'

/*
 * Visão geral do cliente › Link de acompanhamento (pedido do usuário, 22/10/2026 — o
 * "Rastreabilidade dos lotes" do iERP 1.0): um link fixo por cliente, que abre a página pública
 * com os lotes dele. Copiar e abrir: quem vê o cliente; gerar, trocar e desativar: quem edita.
 */
export function LinkRastreio({ c }: { c: Cliente }) {
  const { t } = useTranslation()
  const { gerar, desativar } = useLinkRastreio(c.id)
  const [confirmar, setConfirmar] = useState<'trocar' | 'desativar' | null>(null)
  const url = c.rastreioToken ? urlRastreioPublico(c.rastreioToken) : null

  const copiar = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('clientes.rastreio.copiado'))
    } catch {
      toast.error(t('clientes.rastreio.naoCopiou'))
    }
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>{t('clientes.rastreio.titulo')}</CardTitle>
        <CardDescription>{t('clientes.rastreio.descricao')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {url ? (
          <p className="flex min-w-0 items-center gap-2 rounded-md border bg-muted px-3 py-2">
            <Link2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate font-mono type-body" title={url}>
              {url}
            </span>
          </p>
        ) : (
          <p className="type-body text-muted-foreground">{t('clientes.rastreio.semLink')}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {url ? (
            <>
              <Button variant="secondary" onClick={() => void copiar()}>
                <Copy aria-hidden />
                {t('clientes.rastreio.copiar')}
              </Button>
              <Button variant="secondary" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  {t('clientes.rastreio.abrir')}
                </a>
              </Button>
              <Can permission="clientes.editar" fallback="disable">
                <Button
                  variant="secondary"
                  loading={gerar.isPending}
                  onClick={() => setConfirmar('trocar')}
                >
                  <RefreshCw aria-hidden />
                  {t('clientes.rastreio.trocar')}
                </Button>
              </Can>
              <Can permission="clientes.editar" fallback="disable">
                <Button
                  variant="secondary"
                  loading={desativar.isPending}
                  onClick={() => setConfirmar('desativar')}
                >
                  <Link2Off aria-hidden />
                  {t('clientes.rastreio.desativar')}
                </Button>
              </Can>
            </>
          ) : (
            <Can permission="clientes.editar" fallback="disable">
              <Button loading={gerar.isPending} onClick={() => gerar.mutate()}>
                <Link2 aria-hidden />
                {t('clientes.rastreio.gerar')}
              </Button>
            </Can>
          )}
        </div>
      </CardContent>
      <ConfirmDialog
        open={Boolean(confirmar)}
        onOpenChange={(o) => !o && setConfirmar(null)}
        title={confirmar ? t(`clientes.rastreio.confirm.${confirmar}.title`) : ''}
        description={confirmar ? t(`clientes.rastreio.confirm.${confirmar}.body`) : ''}
        confirmLabel={confirmar ? t(`clientes.rastreio.${confirmar}`) : ''}
        variant={confirmar === 'desativar' ? 'destructive' : 'default'}
        onConfirm={async () => {
          if (confirmar === 'trocar') await gerar.mutateAsync()
          if (confirmar === 'desativar') await desativar.mutateAsync()
        }}
      />
    </Card>
  )
}
