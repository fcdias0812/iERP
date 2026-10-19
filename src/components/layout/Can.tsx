import { cloneElement, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCan, useNomePerfil } from '@/hooks/use-can'

interface CanProps {
  /** Permissão exigida (ex.: 'comercial.criar'). */
  permission: string
  /**
   * Sem permissão:
   *  - `hide` (padrão): o elemento some;
   *  - `disable`: fica desabilitado, com tooltip explicando o motivo.
   */
  fallback?: 'hide' | 'disable'
  children: ReactElement<{ disabled?: boolean; 'aria-disabled'?: boolean }>
}

/**
 * Mostra, esconde ou desabilita uma ação conforme o perfil do usuário.
 * Ex.: `<Can permission="comercial.excluir" fallback="disable"><Button …/></Can>`
 */
export function Can({ permission, fallback = 'hide', children }: CanProps) {
  const { t } = useTranslation()
  const allowed = useCan(permission)
  const perfil = useNomePerfil()

  if (allowed) return children
  if (fallback === 'hide') return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* O span recebe o foco (botão desabilitado não recebe) para o tooltip abrir pelo teclado. */}
        <span tabIndex={0} className="inline-flex rounded-md">
          {cloneElement(children, { disabled: true, 'aria-disabled': true })}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('permissions.denied', { role: perfil })}</TooltipContent>
    </Tooltip>
  )
}
