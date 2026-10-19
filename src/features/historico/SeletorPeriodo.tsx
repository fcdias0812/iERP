import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PERIODOS, type Periodo } from './periodo'

/** Escolha do período carregado (ver `periodo.ts`). */
export function SeletorPeriodo({
  periodo,
  onChange,
}: {
  periodo: Periodo
  onChange: (p: Periodo) => void
}) {
  const { t } = useTranslation()
  const periodoId = useId()
  return (
    <>
      {/* Celular: lista de escolha (os 4 botões não cabem lado a lado). */}
      <div className="flex flex-col gap-1.5 sm:hidden">
        <Label htmlFor={periodoId}>{t('historicoModulo.periodo')}</Label>
        <Select value={periodo} onValueChange={(v) => onChange(v as Periodo)}>
          <SelectTrigger id={periodoId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`historicoModulo.periodos.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ButtonGroup aria-label={t('historicoModulo.periodo')} className="hidden sm:inline-flex">
        {PERIODOS.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={periodo === p ? 'default' : 'secondary'}
            aria-pressed={periodo === p}
            onClick={() => onChange(p)}
          >
            {t(`historicoModulo.periodos.${p}`)}
          </Button>
        ))}
      </ButtonGroup>
    </>
  )
}
