import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog'
import { Input } from './input'
import { Label } from './label'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  /** Texto do botão de confirmar. */
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  /** `destructive` = vermelho (excluir, irreversível); `success` = Aprovar/Concluir. */
  variant?: 'default' | 'destructive' | 'success'
  /**
   * Confirmação forte: a pessoa precisa digitar exatamente este texto (o nome
   * do item) para liberar o botão. Use em exclusões irreversíveis.
   */
  confirmText?: string
}

/** Confirmação padrão. Para exclusão irreversível, passe `variant="destructive"` e `confirmText`. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  variant = 'default',
  confirmText,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [typed, setTyped] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const inputId = React.useId()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const blocked = confirmText !== undefined && typed.trim() !== confirmText

  const change = (next: boolean) => {
    if (!next) setTyped('')
    onOpenChange(next)
  }

  const confirm = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (blocked) return
    setBusy(true)
    try {
      await onConfirm()
      change(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent
        // Com confirmação forte, o foco começa no campo de digitar; senão, em "Cancelar" (padrão seguro).
        onOpenAutoFocus={
          confirmText !== undefined
            ? (e) => {
                e.preventDefault()
                inputRef.current?.focus()
              }
            : undefined
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {variant === 'destructive' && (
              <TriangleAlert className="size-5 text-danger-subtle-foreground" aria-hidden />
            )}
            {title}
          </AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {confirmText !== undefined && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId} className="font-normal">
              <span>
                {t('confirm.typeToConfirm')}{' '}
                <strong className="font-mono font-semibold">{confirmText}</strong>
              </span>
            </Label>
            <Input
              ref={inputRef}
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel ?? t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            onClick={confirm}
            disabled={blocked || busy}
            aria-busy={busy || undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
