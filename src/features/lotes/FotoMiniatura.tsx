import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** Miniatura de foto (pallet, ocorrência) que abre a foto grande num diálogo. */
export function FotoMiniatura({
  src,
  titulo,
  className,
}: {
  src: string
  /** Nome da foto (título do diálogo e nome acessível do botão). */
  titulo: string
  className?: string
}) {
  const { t } = useTranslation()
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={t('lotes.fotos.ampliar', { nome: titulo })}
        title={titulo}
        className={cn(
          'size-12 shrink-0 cursor-zoom-in overflow-hidden rounded-sm border bg-muted',
          className,
        )}
        onClick={(e) => {
          // Dentro de uma linha clicável, não abre a linha.
          e.stopPropagation()
          setAberta(true)
        }}
      >
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      </button>
      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-all">{titulo}</DialogTitle>
          </DialogHeader>
          <img src={src} alt={titulo} className="max-h-[70vh] w-full rounded-md object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}
