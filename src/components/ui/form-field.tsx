import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translateError } from '@/lib/zod-i18n'
import { Label } from './label'

/** Props que o FormField entrega ao controle (id e ligações de acessibilidade). */
export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-required'?: true
  required?: boolean
  disabled?: boolean
}

interface FormFieldProps {
  label: string
  /** Mostra "*" (com texto acessível "obrigatório") e marca o controle. */
  required?: boolean
  /** Texto de ajuda abaixo do campo. */
  help?: React.ReactNode
  /** Mensagem de erro (texto ou chave `validation.*` do Zod). */
  error?: string
  /** Contador "12/120" quando o campo tem limite. */
  counter?: { value: number; max: number }
  disabled?: boolean
  /** Esconde o rótulo visualmente (continua para leitores de tela). Evite. */
  hideLabel?: boolean
  className?: string
  /** O controle, recebendo id + aria-*: `{(p) => <Input {...p} />}` */
  children: (props: FieldControlProps) => React.ReactNode
}

/**
 * Moldura de TODO campo: rótulo, indicador de obrigatório, ajuda, erro
 * (`aria-describedby` + `aria-invalid`) e contador. O controle vem pelo render prop.
 */
export function FormField({
  label,
  required,
  help,
  error,
  counter,
  disabled,
  hideLabel,
  className,
  children,
}: FormFieldProps) {
  const { t } = useTranslation()
  const id = React.useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const counterId = `${id}-counter`
  const message = translateError(error)
  const describedBy =
    [message ? errorId : null, help ? helpId : null, counter ? counterId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div
      data-slot="form-field"
      data-disabled={disabled || undefined}
      className={cn('group flex min-w-0 flex-col gap-1.5', className)}
    >
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
        {required && (
          <>
            <span aria-hidden className="text-danger-subtle-foreground">
              *
            </span>
            <span className="sr-only">({t('field.required')})</span>
          </>
        )}
      </Label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': message ? true : undefined,
        'aria-required': required ? true : undefined,
        required,
        disabled,
      })}
      {(message || help || counter) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {message && (
              <p
                id={errorId}
                className="flex items-start gap-1 type-caption text-danger-subtle-foreground"
              >
                <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                {message}
              </p>
            )}
            {help && (
              <p id={helpId} className="type-caption text-muted-foreground">
                {help}
              </p>
            )}
          </div>
          {counter && (
            <p
              id={counterId}
              className={cn(
                'shrink-0 type-caption num',
                counter.value > counter.max
                  ? 'text-danger-subtle-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <span className="sr-only">{t('field.counter')} </span>
              {counter.value}/{counter.max}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Grupo de campos com título (seções de formulário, checkboxes, radios). */
export function FieldSet({
  legend,
  description,
  children,
  className,
}: {
  legend: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-3', className)}>
      <legend className="type-label">{legend}</legend>
      {description && <p className="-mt-2 type-caption text-muted-foreground">{description}</p>}
      {children}
    </fieldset>
  )
}
