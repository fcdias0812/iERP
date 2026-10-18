import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Search, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './input'

/** Senha com botão mostrar/ocultar (o botão anuncia o estado). */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'>) {
  const { t } = useTranslation()
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        autoComplete="current-password"
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? t('field.hidePassword') : t('field.showPassword')}
        disabled={props.disabled}
        className="absolute inset-y-0 right-1 my-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  )
}

interface SearchInputProps extends Omit<
  React.ComponentProps<'input'>,
  'type' | 'onChange' | 'value'
> {
  value: string
  onValueChange: (value: string) => void
}

/** Busca com lupa e botão limpar (Esc também limpa). */
export function SearchInput({ value, onValueChange, className, ...props }: SearchInputProps) {
  const { t } = useTranslation()
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute inset-y-0 left-2.5 my-auto size-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault()
            onValueChange('')
          }
        }}
        className={cn('pr-9 pl-8 [&::-webkit-search-cancel-button]:hidden', className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label={t('field.clearSearch')}
          className="absolute inset-y-0 right-1 my-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
