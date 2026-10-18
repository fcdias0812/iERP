import * as React from 'react'
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { FormField, type FieldControlProps } from './form-field'

/*
 * React Hook Form + Zod + FormField, num só componente.
 *
 *   const form = useForm({ resolver: zodResolver(schema), mode: 'onTouched' })
 *   <RhfField control={form.control} name="nome" label="Nome" required>
 *     {({ field, control }) => <Input {...control} {...field} />}
 *   </RhfField>
 *
 * Erros: as mensagens do Zod já vêm como chaves `validation.*` (src/lib/zod-i18n.ts)
 * e são traduzidas no FormField. Validação no campo (ao sair dele) e no envio.
 */

interface RhfFieldProps<TValues extends FieldValues, TName extends FieldPath<TValues>> {
  control: Control<TValues>
  name: TName
  label: string
  required?: boolean
  help?: React.ReactNode
  /** Limite de caracteres: mostra o contador "n/max". */
  maxLength?: number
  disabled?: boolean
  className?: string
  children: (args: {
    field: ControllerRenderProps<TValues, TName>
    fieldState: ControllerFieldState
    /** id + aria-* para espalhar no controle. */
    control: FieldControlProps
  }) => React.ReactNode
}

export function RhfField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  label,
  required,
  help,
  maxLength,
  disabled,
  className,
  children,
}: RhfFieldProps<TValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      disabled={disabled}
      render={({ field, fieldState }) => (
        <FormField
          label={label}
          required={required}
          help={help}
          error={fieldState.error?.message}
          disabled={disabled}
          className={className}
          counter={
            maxLength !== undefined
              ? { value: String(field.value ?? '').length, max: maxLength }
              : undefined
          }
        >
          {(controlProps) => children({ field, fieldState, control: controlProps })}
        </FormField>
      )}
    />
  )
}
