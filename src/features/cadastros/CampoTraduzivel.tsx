import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditorTextoTraduzido, SeletorIdiomaTexto } from '@/components/ui/localized-text'
import { IDIOMAS, textoOriginal, type LocalizedText } from '@/lib/localized-text'
import type { Language } from '@/stores/ui-store'

/*
 * Embaixo de um campo traduzível (nome do material, descrição da área): o idioma detectado do
 * que a pessoa escreve e, quando o registro já tem as traduções, a lista delas com "Revisar
 * traduções" (corrigir à mão — as corrigidas deixam de ser "automáticas").
 */
export function RodapeTraduzivel({
  rotulo,
  texto,
  idioma,
  detectado,
  onIdioma,
  traduzido,
  onRevisar,
  multilinha,
  maxLength,
}: {
  rotulo: string
  /** O que está escrito no campo agora. */
  texto: string
  idioma: Language
  detectado: boolean
  onIdioma: (l: Language) => void
  /** Traduções já guardadas (registro existente), ou null. */
  traduzido: LocalizedText | null
  onRevisar: (v: LocalizedText) => void
  multilinha?: boolean
  maxLength?: number
}) {
  const { t } = useTranslation()
  const [editor, setEditor] = useState(false)
  // As traduções guardadas só valem enquanto o texto original não mudou.
  const vale = traduzido && textoOriginal(traduzido).trim() === texto.trim()
  return (
    <div className="flex flex-col gap-1.5">
      <SeletorIdiomaTexto texto={texto} idioma={idioma} detectado={detectado} onChange={onIdioma} />
      {vale ? (
        <div className="flex flex-col gap-1 rounded-md border border-dashed p-2">
          <ul className="flex flex-col gap-0.5 type-caption text-muted-foreground">
            {IDIOMAS.filter((l) => l !== traduzido.origem).map((l) => (
              <li key={l}>
                <span className="font-medium">{t(`languages.${l}`)}:</span>{' '}
                <span lang={l}>{traduzido.textos[l] || '—'}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto self-start px-0 type-caption"
            onClick={() => setEditor(true)}
          >
            <Languages aria-hidden />
            {t('cadastros.revisarTraducoes')}
          </Button>
          <EditorTextoTraduzido
            open={editor}
            onOpenChange={setEditor}
            rotulo={rotulo}
            valor={traduzido}
            multilinha={multilinha}
            maxLength={maxLength}
            onSalvar={(v) => {
              onRevisar(v)
              setEditor(false)
            }}
          />
        </div>
      ) : (
        texto.trim() && (
          <p className="type-caption text-muted-foreground">{t('cadastros.traduzAoSalvar')}</p>
        )
      )}
    </div>
  )
}
