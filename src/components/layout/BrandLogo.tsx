import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import logoFull from '@/assets/brand/logo-full.png'
import logoFullDark from '@/assets/brand/logo-full-dark.png'
import logoGlobe from '@/assets/brand/logo-globe.png'
import logoLogin from '@/assets/brand/logo-full-login.png'
import logoLoginDark from '@/assets/brand/logo-full-login-dark.png'

interface BrandLogoProps {
  /**
   * `full` = globo + letreiro; `globe` = só o globo; `responsive` = globo no celular e completa
   * a partir de sm; `login` = completa em alta resolução (telas de entrada).
   */
  variant?: 'full' | 'globe' | 'responsive' | 'login'
  className?: string
}

/**
 * Logo da Re-Teck. A troca claro/escuro é feita por CSS (classe .dark),
 * então funciona também com o tema "Sistema" sem piscar.
 */
export function BrandLogo({ variant = 'full', className }: BrandLogoProps) {
  const { t } = useTranslation()
  const alt = t('brand.logoAlt')
  const full = (
    <>
      <img src={logoFull} alt={alt} className={cn('h-full w-auto dark:hidden')} />
      <img src={logoFullDark} alt={alt} className={cn('hidden h-full w-auto dark:block')} />
    </>
  )
  const globe = <img src={logoGlobe} alt={alt} className="h-full w-auto" />

  return (
    <span className={cn('inline-flex h-8 shrink-0 items-center', className)}>
      {variant === 'full' && full}
      {variant === 'globe' && globe}
      {variant === 'login' && (
        <>
          <img src={logoLogin} alt={alt} className="h-full w-auto dark:hidden" />
          <img src={logoLoginDark} alt={alt} className="hidden h-full w-auto dark:block" />
        </>
      )}
      {variant === 'responsive' && (
        <>
          <span className="inline-flex h-full sm:hidden">{globe}</span>
          <span className="hidden h-full sm:inline-flex">{full}</span>
        </>
      )}
    </span>
  )
}
