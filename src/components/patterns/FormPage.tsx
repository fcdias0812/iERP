import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useHotkey, isMac } from '@/hooks/use-hotkey'
import { useUnsavedChanges } from './use-unsaved-changes'

interface FormPageProps {
  title: string
  description?: string
  status?: ReactNode
  /** Envio do formulário (ex.: `form.handleSubmit(salvar)`). */
  onSubmit: () => void
  onCancel: () => void
  /** Há alterações não salvas? (`form.formState.isDirty`) — ativa o aviso ao sair. */
  dirty: boolean
  submitting?: boolean
  submitLabel?: string
  /** Seções do formulário (<FormSection />). */
  children: ReactNode
}

/**
 * PADRÃO CADASTRO/EDIÇÃO: formulário em seções, rodapé fixo com Cancelar/Salvar,
 * Ctrl+S (⌘S) salva, aviso de alterações não salvas ao sair.
 * Validação no campo e no envio: React Hook Form + Zod com <RhfField>.
 */
export function FormPage({
  title,
  description,
  status,
  onSubmit,
  onCancel,
  dirty,
  submitting,
  submitLabel,
  children,
}: FormPageProps) {
  const { t } = useTranslation()
  const guard = useUnsavedChanges(dirty && !submitting)
  useHotkey({ key: 's', mod: true }, () => onSubmit())

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex flex-col gap-6"
    >
      <PageHeader title={title} description={description} status={status} />
      <p className="-mt-3 type-caption text-muted-foreground">
        <span aria-hidden className="text-danger-subtle-foreground">
          *
        </span>{' '}
        {t('patterns.form.requiredHint')}
      </p>
      <div className="flex flex-col gap-6">{children}</div>
      {/* Rodapé fixo: sempre à vista, mesmo em formulários longos. */}
      <div className="sticky bottom-0 z-10 -mx-(--page-px) flex flex-wrap items-center justify-end gap-2 border-t bg-card px-(--page-px) py-3 shadow-popover">
        <span
          className={cn(
            'mr-auto hidden type-caption text-muted-foreground sm:inline',
            !dirty && 'invisible',
          )}
        >
          {t('patterns.form.unsavedHint')}
        </span>
        <span className="hidden items-center gap-1 type-caption text-muted-foreground md:flex">
          <Kbd>{isMac() ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>S</Kbd>
        </span>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          loading={submitting}
          aria-keyshortcuts={isMac() ? 'Meta+S' : 'Control+S'}
        >
          {!submitting && <Save aria-hidden />}
          {submitLabel ?? t('common.save')}
        </Button>
      </div>
      {guard}
    </form>
  )
}

/** Seção de formulário: título e descrição à esquerda, campos à direita (empilha no celular). */
export function FormSection({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string
  description?: string
  children: ReactNode
  columns?: 1 | 2 | 3
}) {
  return (
    <section className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 shadow-card lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8 lg:p-6">
      <div className="space-y-1">
        <h2 className="type-card-title">{title}</h2>
        {description && <p className="type-body text-muted-foreground">{description}</p>}
      </div>
      <div
        className={cn(
          'grid grid-cols-1 content-start gap-x-4 gap-y-5',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'sm:grid-cols-2 xl:grid-cols-3',
        )}
      >
        {children}
      </div>
    </section>
  )
}
