import { useEffect } from 'react'
import { useUiStore } from '@/stores/ui-store'
import i18n from '@/i18n'
import { loadCjkFont } from '@/styles/fonts'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Sincroniza tema, densidade e idioma da store com o <html>. Não renderiza nada. */
export function ThemeController() {
  const theme = useUiStore((s) => s.theme)
  const density = useUiStore((s) => s.density)
  const language = useUiStore((s) => s.language)

  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && darkQuery().matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme !== 'system') return
    const mq = darkQuery()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    if (density === 'compact') document.documentElement.dataset.density = 'compact'
    else delete document.documentElement.dataset.density
  }, [density])

  useEffect(() => {
    document.documentElement.lang = language
    if (language === 'zh-TW') void loadCjkFont()
    // Título da aba com o nome do sistema no idioma atual (chave `app.name`).
    const setTitle = () => (document.title = `Re-Teck · ${i18n.t('app.name')}`)
    if (i18n.language !== language) void i18n.changeLanguage(language).then(setTitle)
    else setTitle()
  }, [language])

  return null
}
