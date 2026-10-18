import { useRef } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/**
 * Aviso de alterações não salvas: bloqueia a navegação dentro do app (com
 * confirmação) e o fechamento/recarga da aba (aviso do navegador).
 * Uso no formulário: `const guard = useUnsavedChanges(isDirty)` e renderize `{guard}`.
 * Depois de salvar, zere o "sujo" (ex.: `form.reset(valores)`) antes de navegar.
 */
export function useUnsavedChanges(dirty: boolean) {
  const { t } = useTranslation()
  const leaving = useRef(false)
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  })

  return (
    <ConfirmDialog
      open={blocker.status === 'blocked'}
      onOpenChange={(open) => {
        // Fechou sem confirmar (Cancelar/Esc) → fica na página.
        if (!open && !leaving.current) blocker.reset?.()
        leaving.current = false
      }}
      variant="destructive"
      title={t('patterns.unsaved.title')}
      description={t('patterns.unsaved.description')}
      confirmLabel={t('patterns.unsaved.leave')}
      cancelLabel={t('patterns.unsaved.stay')}
      onConfirm={() => {
        leaving.current = true
        blocker.proceed?.()
      }}
    />
  )
}
