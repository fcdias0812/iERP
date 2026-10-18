import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from './locales/pt-BR.json'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'
import { useUiStore } from '@/stores/ui-store'

export const defaultNS = 'translation'
export const resources = {
  'pt-BR': { translation: ptBR },
  en: { translation: en },
  'zh-TW': { translation: zhTW },
} as const

/**
 * Idiomas: pt-BR (padrão), en, zh-TW. Nenhum texto fixo em componente —
 * tudo passa por t('chave'). O pt-BR é a fonte; os outros arquivos
 * precisam ter as mesmas chaves.
 */
void i18n.use(initReactI18next).init({
  resources,
  lng: useUiStore.getState().language,
  fallbackLng: 'pt-BR',
  defaultNS,
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
