import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Step {
  id: string
  label: string
  description?: string
}

interface StepperProps {
  steps: Step[]
  /** Índice da etapa atual (0…n-1). */
  current: number
  /** Permite clicar nas etapas já concluídas para voltar. */
  onStepClick?: (index: number) => void
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

/**
 * Etapas de um assistente (wizard). Concluída = ✓ (azul-petróleo, ação feita),
 * atual = destacada, futura = neutra. A atual tem `aria-current="step"`.
 */
export function Stepper({
  steps,
  current,
  onStepClick,
  orientation = 'horizontal',
  className,
}: StepperProps) {
  const { t } = useTranslation()
  const vertical = orientation === 'vertical'

  return (
    <ol
      className={cn(
        'flex',
        vertical ? 'flex-col gap-0' : 'flex-col gap-3 sm:flex-row sm:items-start sm:gap-0',
        className,
      )}
    >
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        const clickable = done && onStepClick
        const state = done
          ? t('stepper.done')
          : active
            ? t('stepper.current')
            : t('stepper.upcoming')
        const content = (
          <>
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border type-label num transition-colors duration-150',
                done && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary bg-selected text-selected-foreground',
                !done && !active && 'border-input bg-card text-muted-foreground',
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className="min-w-0 text-left">
              <span
                className={cn(
                  'block type-label',
                  active || done ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
              {step.description && (
                <span className="block type-caption text-muted-foreground">{step.description}</span>
              )}
              <span className="sr-only"> — {state}</span>
            </span>
          </>
        )
        return (
          <li
            key={step.id}
            aria-current={active ? 'step' : undefined}
            className={cn('relative flex', vertical ? 'pb-6 last:pb-0' : 'sm:flex-1')}
          >
            {/* Conector até a próxima etapa */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute',
                  vertical
                    ? 'top-8 bottom-1 left-3.5 w-px'
                    : 'hidden sm:top-3.5 sm:right-2 sm:left-10 sm:block sm:h-px',
                  done ? 'bg-primary' : 'bg-border-strong',
                )}
              />
            )}
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className="relative z-10 flex cursor-pointer items-start gap-3 rounded-md pr-3 hover:[&>span:last-child>span:first-child]:underline"
              >
                {content}
              </button>
            ) : (
              <div className="relative z-10 flex items-start gap-3 pr-3">{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
