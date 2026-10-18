import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Stepper } from '@/components/ui/stepper'
import { toast } from '@/components/ui/sonner'
import { useUnsavedChanges } from './use-unsaved-changes'

export interface WizardStep {
  id: string
  label: string
  description?: string
  /** Valida a etapa antes de avançar (ex.: `() => form.trigger(['cliente'])`). */
  validate?: () => boolean | Promise<boolean>
  content: React.ReactNode
}

interface WizardPageProps {
  title: string
  description?: string
  /** Etapas; a ÚLTIMA deve ser a revisão. */
  steps: WizardStep[]
  onFinish: () => void | Promise<void>
  onCancel: () => void
  dirty: boolean
  finishLabel?: string
}

/**
 * PADRÃO ASSISTENTE (WIZARD): etapas com stepper, voltar/avançar com validação
 * por etapa e revisão final. Etapas já feitas podem ser reabertas pelo stepper.
 */
export function WizardPage({
  title,
  description,
  steps,
  onFinish,
  onCancel,
  dirty,
  finishLabel,
}: WizardPageProps) {
  const { t } = useTranslation()
  const [current, setCurrent] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [finished, setFinished] = React.useState(false)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const guard = useUnsavedChanges(dirty && !finished)
  const step = steps[current]!
  const last = current === steps.length - 1

  // Ao trocar de etapa, o foco vai para o título dela (leitores de tela anunciam).
  const go = (i: number) => {
    setCurrent(i)
    window.requestAnimationFrame(() => headingRef.current?.focus())
  }

  const next = async () => {
    setBusy(true)
    try {
      const ok = step.validate ? await step.validate() : true
      if (!ok) {
        toast.error(t('patterns.wizard.fixStep'))
        return
      }
      if (last) {
        setFinished(true)
        await onFinish()
      } else go(current + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <nav
        aria-label={t('patterns.wizard.steps')}
        className="rounded-lg border bg-card p-4 shadow-card"
      >
        <Stepper steps={steps} current={current} onStepClick={go} />
      </nav>
      <section
        aria-labelledby="wizard-step-title"
        className="rounded-lg border bg-card p-4 shadow-card lg:p-6"
      >
        <div className="mb-5 space-y-1">
          <p className="type-overline text-muted-foreground">
            {t('patterns.wizard.stepOf', { n: current + 1, total: steps.length })}
          </p>
          <h2
            id="wizard-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="type-section-title outline-none"
          >
            {step.label}
          </h2>
          {step.description && (
            <p className="type-body text-muted-foreground">{step.description}</p>
          )}
        </div>
        {step.content}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => go(current - 1)}
            disabled={current === 0 || busy}
          >
            <ArrowLeft aria-hidden />
            {t('common.back')}
          </Button>
          <Button variant={last ? 'success' : 'default'} onClick={() => void next()} loading={busy}>
            {last ? (
              <>
                {!busy && <Check aria-hidden />}
                {finishLabel ?? t('common.finish')}
              </>
            ) : (
              <>
                {t('common.next')}
                <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
      {guard}
    </div>
  )
}
