import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCw, Sparkles } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NOVIDADES, VERSAO_ATUAL } from '@/config/novidades'
import { formatDate } from '@/lib/format'
import { reiniciarNaVersaoNova, useAtualizacaoStore } from '@/stores/atualizacao-store'
import { useUiStore } from '@/stores/ui-store'

/*
 * Novidades da barra do topo (pedido do usuário, 27/10/2026): o que mudou em cada atualização,
 * da mais nova para a mais antiga. A bolinha acende enquanto a pessoa não abriu a versão atual
 * (guardado no navegador, junto das preferências). Versão NOVA publicada e a pessoa ainda não
 * reiniciou (28/10/2026): no lugar da bolinha, um "?" chamativo, e lá dentro o convite para
 * reiniciar (as novidades da versão nova só aparecem depois de recarregar).
 */
export function NovidadesButton() {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const vista = useUiStore((s) => s.novidadesVistas)
  const marcarVista = useUiStore((s) => s.setNovidadesVistas)
  const [aberta, setAberta] = useState(false)
  const nova = vista !== VERSAO_ATUAL
  const reiniciar = Boolean(useAtualizacaoStore((s) => s.nova))
  const rotulo = reiniciar
    ? t('atualizacao.botao')
    : nova
      ? t('novidades.botaoNova')
      : t('novidades.titulo')

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={rotulo}
            onClick={() => {
              setAberta(true)
              marcarVista(VERSAO_ATUAL)
            }}
          >
            <Sparkles aria-hidden />
            {reiniciar ? (
              <span
                aria-hidden
                className="font-bold absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-alert type-caption text-alert-foreground ring-2 ring-card"
              >
                ?
              </span>
            ) : (
              nova && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-card"
                />
              )
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{rotulo}</TooltipContent>
      </Tooltip>
      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('novidades.titulo')}</DialogTitle>
            <DialogDescription>
              {t('novidades.descricao', { versao: VERSAO_ATUAL })}
            </DialogDescription>
          </DialogHeader>
          {reiniciar && (
            <Alert
              tone="alert"
              title={t('atualizacao.precisaReiniciar')}
              action={
                <Button size="sm" onClick={reiniciarNaVersaoNova}>
                  <RotateCw aria-hidden />
                  {t('atualizacao.reiniciar')}
                </Button>
              }
            >
              {t('atualizacao.precisaReiniciarTexto')}
            </Alert>
          )}
          <ol className="flex flex-col gap-6">
            {NOVIDADES.map((n, i) => (
              <li key={n.versao}>
                <section aria-labelledby={`novidade-${n.versao}`} className="flex flex-col gap-2">
                  <h3
                    id={`novidade-${n.versao}`}
                    className="flex flex-wrap items-center gap-2 type-card-title"
                  >
                    {t('novidades.versao', { versao: n.versao })}
                    <span className="type-caption font-normal text-muted-foreground num">
                      {formatDate(n.data)}
                    </span>
                    {i === 0 && <Badge variant="info">{t('novidades.atual')}</Badge>}
                  </h3>
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 type-body">
                    {n.itens[idioma].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  )
}
