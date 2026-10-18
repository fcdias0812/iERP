import { Toaster as Sonner, toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { LoaderCircle } from 'lucide-react'
import { toneStyles } from '@/lib/status/tones'
import { useUiStore } from '@/stores/ui-store'

/*
 * Toasts (Sonner) tematizados com os tokens: sucesso, info, alerta e erro,
 * cada um com o ícone do tom. Uso: `toast.success('Pedido salvo')`,
 * `toast.error('Não foi possível salvar', { description: '…' })`.
 * Montado uma vez em RootLayout.
 */

const base =
  'pointer-events-auto flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-lg border p-4 shadow-popover'

export function Toaster() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const Icon = (tone: keyof typeof toneStyles) => {
    const C = toneStyles[tone].icon
    return <C className="mt-0.5 size-4" aria-hidden />
  }

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      closeButton
      containerAriaLabel={t('common.notifications')}
      icons={{
        success: Icon('success'),
        info: Icon('info'),
        warning: Icon('warning'),
        error: Icon('danger'),
        loading: <LoaderCircle className="mt-0.5 size-4 animate-spin" aria-hidden />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          // O fundo vem do tipo (default/loading = neutro; demais = tom) para não conflitar.
          toast: base,
          loading: 'bg-popover text-popover-foreground',
          default: 'bg-popover text-popover-foreground',
          success: toneStyles.success.subtle,
          info: toneStyles.info.subtle,
          warning: toneStyles.warning.subtle,
          error: toneStyles.danger.subtle,
          title: 'type-label',
          description: 'type-body',
          content: 'flex min-w-0 flex-1 flex-col gap-0.5',
          icon: 'shrink-0',
          actionButton:
            'ml-auto shrink-0 cursor-pointer rounded-md bg-primary px-2.5 py-1 type-label text-primary-foreground hover:bg-primary-hover',
          cancelButton:
            'shrink-0 cursor-pointer rounded-md border border-border-strong bg-secondary px-2.5 py-1 type-label text-secondary-foreground hover:bg-secondary-hover',
          closeButton:
            'absolute -top-2 -right-2 flex size-5 cursor-pointer items-center justify-center rounded-full border bg-popover text-muted-foreground hover:text-foreground',
        },
      }}
    />
  )
}

export { toast }
