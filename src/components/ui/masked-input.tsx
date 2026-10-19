import * as React from 'react'
import { IMask, IMaskInput } from 'react-imask'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { fieldBase } from './input'

/*
 * Campos com máscara (react-imask). O valor entregue em `onValueChange` é o
 * valor LIMPO (sem pontuação; número para moeda/%/número). Valide com
 * src/lib/validators/br.ts.
 */

type BaseProps = Omit<React.ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type'>

/* ------------------------------------------------------------ documentos e formatos BR */

const upper = (ch: string) => ch.toUpperCase()

export const MASKS = {
  cpf: { mask: '000.000.000-00', inputMode: 'numeric', placeholder: '000.000.000-00' },
  // CNPJ alfanumérico (desde jul/2026): 12 posições letras/números + 2 dígitos.
  cnpj: {
    mask: 'XX.XXX.XXX/XXXX-00',
    definitions: { X: /[0-9A-Za-z]/ },
    prepareChar: upper,
    inputMode: 'text',
    placeholder: '00.000.000/0000-00',
  },
  cep: { mask: '00000-000', inputMode: 'numeric', placeholder: '00000-000' },
  phone: {
    mask: [{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }],
    inputMode: 'tel',
    placeholder: '(00) 00000-0000',
  },
  // Placa antiga (ABC-1234) ou Mercosul (ABC-1D23).
  plate: {
    mask: 'AAA-0X00',
    definitions: { A: /[A-Za-z]/, X: /[0-9A-Za-z]/ },
    prepareChar: upper,
    inputMode: 'text',
    placeholder: 'ABC-1D23',
  },
} as const

export type MaskKind = keyof typeof MASKS

interface MaskedInputProps extends BaseProps {
  kind: MaskKind
  value?: string
  /** Valor sem máscara (só dígitos/letras). */
  onValueChange?: (unmasked: string) => void
}

/** CPF, CNPJ (inclusive alfanumérico), CEP, telefone e placa. */
export function MaskedInput({
  kind,
  value,
  onValueChange,
  className,
  placeholder,
  ...props
}: MaskedInputProps) {
  const {
    mask,
    inputMode,
    placeholder: ph,
    ...opts
  } = MASKS[kind] as (typeof MASKS)[MaskKind] & {
    definitions?: Record<string, RegExp>
    prepareChar?: (c: string) => string
  }
  return (
    <IMaskInput
      {...(opts as object)}
      {...(props as object)}
      mask={mask as never}
      unmask
      value={value ?? ''}
      inputMode={inputMode}
      placeholder={placeholder ?? ph}
      onAccept={(v: string) => onValueChange?.(v)}
      className={cn(fieldBase, 'font-mono num', className)}
    />
  )
}

/* ------------------------------------------------------------ números */

function separators(lang: string) {
  const parts = new Intl.NumberFormat(lang).formatToParts(12345.6)
  return {
    thousands: parts.find((p) => p.type === 'group')?.value ?? '.',
    radix: parts.find((p) => p.type === 'decimal')?.value ?? ',',
  }
}

interface NumberInputProps extends BaseProps {
  value?: number | null
  onValueChange?: (value: number | null) => void
  /** Casas decimais (padrão 0). */
  scale?: number
  min?: number
  max?: number
  /** Texto fixo à esquerda (ex.: "R$") ou à direita (ex.: "%", "kg"). */
  prefix?: string
  suffix?: string
}

/** Número com separadores do idioma; entrega `number | null`. Base de moeda e porcentagem. */
export function NumberInput({
  value,
  onValueChange,
  scale = 0,
  min,
  max,
  prefix,
  suffix,
  className,
  disabled,
  readOnly,
  ...props
}: NumberInputProps) {
  const { i18n } = useTranslation()
  const { thousands, radix } = separators(i18n.language)
  return (
    <div
      className={cn(
        fieldBase,
        'items-center gap-2 px-0 focus-within:border-ring has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring has-[input[aria-invalid=true]]:border-danger-border',
        // A caixa é uma <div>, que o CSS sempre trata como `:read-only`: sem isto, o
        // `read-only:bg-muted` do fieldBase pintava todo campo numérico de cinza (parecia desabilitado).
        disabled || readOnly
          ? 'bg-muted'
          : 'read-only:bg-card read-only:hover:border-border-strong',
        className,
      )}
    >
      {prefix && (
        <span className="pl-(--control-px) type-body text-muted-foreground" aria-hidden>
          {prefix}
        </span>
      )}
      <IMaskInput
        {...(props as object)}
        key={`${thousands}${radix}`}
        mask={Number as never}
        scale={scale}
        thousandsSeparator={thousands}
        radix={radix}
        mapToRadix={['.', ',']}
        normalizeZeros
        padFractionalZeros={scale > 0}
        min={min}
        max={max}
        unmask="typed"
        value={(value ?? '') as never}
        disabled={disabled}
        readOnly={readOnly}
        inputMode={scale > 0 ? 'decimal' : 'numeric'}
        onAccept={(v: unknown) => {
          const n = typeof v === 'number' && !Number.isNaN(v) ? v : null
          if (n !== (value ?? null)) onValueChange?.(n)
        }}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-right num outline-none disabled:cursor-not-allowed',
          !prefix && 'pl-(--control-px)',
          !suffix && 'pr-(--control-px)',
        )}
      />
      {suffix && (
        <span className="pr-(--control-px) type-body text-muted-foreground" aria-hidden>
          {suffix}
        </span>
      )}
    </div>
  )
}

/** Moeda em reais (R$), 2 casas. */
export function CurrencyInput(props: Omit<NumberInputProps, 'scale' | 'prefix'>) {
  return <NumberInput scale={2} prefix="R$" {...props} />
}

/** Porcentagem (valor de 0 a 100), 2 casas. */
export function PercentInput(props: Omit<NumberInputProps, 'suffix'>) {
  return <NumberInput scale={2} suffix="%" min={0} max={100} {...props} />
}

/* ------------------------------------------------------------ hora */

interface TimeInputProps extends BaseProps {
  /** "HH:mm" */
  value?: string
  onValueChange?: (value: string) => void
}

/** Hora 24h (HH:mm). */
export function TimeInput({ value, onValueChange, className, ...props }: TimeInputProps) {
  return (
    <IMaskInput
      {...(props as object)}
      mask="HH:MM"
      blocks={{
        HH: { mask: IMask.MaskedRange, from: 0, to: 23, maxLength: 2 },
        MM: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 },
      }}
      value={value ?? ''}
      inputMode="numeric"
      placeholder="00:00"
      onAccept={(v: string) => onValueChange?.(v)}
      className={cn(fieldBase, 'w-28 num', className)}
    />
  )
}
