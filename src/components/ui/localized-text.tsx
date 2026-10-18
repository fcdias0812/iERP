import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Languages, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  IDIOMAS,
  isLocalizedText,
  textoNoIdioma,
  type LocalizedText,
  type TextoTraduzivel,
} from '@/lib/localized-text'
import { useIdiomaTexto, useTraducao } from '@/hooks/use-traducao'
import { useUiStore, type Language } from '@/stores/ui-store'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { FormField } from './form-field'
import { Input } from './input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Tag } from './tag'
import { Textarea } from './textarea'

/*
 * Componentes de TEXTO EM VÁRIOS IDIOMAS (ver src/lib/localized-text.ts):
 *  - <TextoTraduzido>        mostra no idioma da tela (com "ver original" quando é tradução);
 *  - <SeletorIdiomaTexto>    abaixo do campo: idioma detectado do que a pessoa escreve;
 *  - <EditorTextoTraduzido>  diálogo para escrever/corrigir o texto e as traduções.
 */

// ---------------------------------------------------------------- exibição

interface TextoTraduzidoProps {
  valor: TextoTraduzivel | null | undefined
  /** Célula de tabela/cartão: só um ícone discreto, sem "ver original". */
  compacto?: boolean
  /** Mostra "Traduzir agora" quando falta a tradução (ex.: persiste com PATCH). */
  onTraduzir?: (v: LocalizedText) => void | Promise<void>
  className?: string
}

export function TextoTraduzido({ valor, compacto, onTraduzir, className }: TextoTraduzidoProps) {
  const { t } = useTranslation()
  const idioma = useUiStore((s) => s.language)
  const [verOriginal, setVerOriginal] = React.useState(false)
  const [traduzindo, setTraduzindo] = React.useState(false)

  if (!isLocalizedText(valor)) return <span className={className}>{valor ?? ''}</span>

  const atual = textoNoIdioma(valor, verOriginal ? valor.origem : idioma)
  const nomeOrigem = t(`languages.${valor.origem}`)
  const especial = atual.automatico || atual.pendente || verOriginal

  if (compacto) {
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
        <span className="truncate">{atual.texto}</span>
        {atual.automatico && (
          <span title={t('traducao.automatica', { idioma: nomeOrigem })} className="shrink-0">
            <Languages className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">{t('traducao.automatica', { idioma: nomeOrigem })}</span>
          </span>
        )}
      </span>
    )
  }

  const traduzirAgora = async () => {
    if (!onTraduzir) return
    setTraduzindo(true)
    try {
      await onTraduzir(valor)
    } finally {
      setTraduzindo(false)
    }
  }

  return (
    <span className={cn('inline-flex flex-col gap-0.5', className)}>
      <span lang={atual.idioma} className="whitespace-pre-line">
        {atual.texto}
      </span>
      {especial && (
        <span className="inline-flex flex-wrap items-center gap-x-2 type-caption text-muted-foreground">
          <Languages className="size-3.5 shrink-0" aria-hidden />
          {atual.pendente
            ? t('traducao.pendente', { idioma: t(`languages.${idioma}`) })
            : verOriginal
              ? t('traducao.original', { idioma: nomeOrigem })
              : t('traducao.automatica', { idioma: nomeOrigem })}
          {!atual.pendente && (
            <button
              type="button"
              className="cursor-pointer text-link underline-offset-4 hover:underline"
              onClick={() => setVerOriginal((v) => !v)}
            >
              {verOriginal ? t('traducao.verTraducao') : t('traducao.verOriginal')}
            </button>
          )}
          {atual.pendente && onTraduzir && (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 type-caption"
              loading={traduzindo}
              onClick={() => void traduzirAgora()}
            >
              <RefreshCw aria-hidden />
              {t('traducao.traduzirAgora')}
            </Button>
          )}
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------- idioma do texto digitado

interface SeletorIdiomaTextoProps {
  texto: string
  idioma: Language
  detectado: boolean
  onChange: (idioma: Language) => void
  className?: string
}

/** "Escrito em: Português (detectado)" — a pessoa pode corrigir se a detecção errar. */
export function SeletorIdiomaTexto({
  texto,
  idioma,
  detectado,
  onChange,
  className,
}: SeletorIdiomaTextoProps) {
  const { t } = useTranslation()
  const id = React.useId()
  if (!texto.trim()) return null
  return (
    <div className={cn('flex items-center gap-2 type-caption text-muted-foreground', className)}>
      <Languages className="size-3.5 shrink-0" aria-hidden />
      <label htmlFor={id}>{t('traducao.escritoEm')}</label>
      <Select value={idioma} onValueChange={(v) => onChange(v as Language)}>
        <SelectTrigger id={id} className="h-control-sm w-auto gap-1.5 px-2 type-caption">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {IDIOMAS.map((l) => (
            <SelectItem key={l} value={l}>
              {t(`languages.${l}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {detectado && <span>{t('traducao.detectado')}</span>}
    </div>
  )
}

// ---------------------------------------------------------------- editor

interface EditorTextoTraduzidoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nome do campo (vai no título: "Editar Nome"). */
  rotulo: string
  valor: TextoTraduzivel | null | undefined
  multilinha?: boolean
  maxLength?: number
  onSalvar: (v: LocalizedText) => Promise<void> | void
}

/**
 * Escreve no idioma que preferir; ao salvar, traduz para os outros dois.
 * As traduções podem ser corrigidas à mão (deixam de ser "automáticas").
 */
export function EditorTextoTraduzido(props: EditorTextoTraduzidoProps) {
  const { open, onOpenChange, rotulo } = props
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('traducao.editarTitulo', { campo: rotulo })}</DialogTitle>
          <DialogDescription>{t('traducao.editarDescricao')}</DialogDescription>
        </DialogHeader>
        {/* Monta o formulário só aberto: cada abertura parte do valor salvo. */}
        {open && <FormularioTraducao {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function FormularioTraducao({
  onOpenChange,
  valor,
  multilinha,
  maxLength = 200,
  onSalvar,
}: EditorTextoTraduzidoProps) {
  const { t } = useTranslation()
  const inicial = isLocalizedText(valor) ? valor : null
  const [original, setOriginal] = React.useState(
    inicial ? (inicial.textos[inicial.origem] ?? '') : ((valor as string | null) ?? ''),
  )
  const idiomaTexto = useIdiomaTexto(original, inicial?.origem)
  const origem = idiomaTexto.idioma
  /** A pessoa escolheu o idioma à mão: não detecta mais ao digitar. */
  const [idiomaManual, setIdiomaManual] = React.useState(false)

  const [textos, setTextos] = React.useState<Partial<Record<Language, string>>>(
    inicial?.textos ?? {},
  )
  const [automaticos, setAutomaticos] = React.useState<Language[]>(inicial?.automaticos ?? [])
  /** O original mudou desde a última tradução: ao salvar, traduz de novo. */
  const [desatualizado, setDesatualizado] = React.useState(!inicial)
  const [erro, setErro] = React.useState<string>()
  const { traduzindo, traduzir } = useTraducao()
  const [salvando, setSalvando] = React.useState(false)

  const outros = IDIOMAS.filter((l) => l !== origem)
  const Campo = multilinha ? Textarea : Input

  const gerar = async () => {
    const v = await traduzir(original, origem)
    setTextos(v.textos)
    setAutomaticos(v.automaticos ?? [])
    setDesatualizado(false)
    return v
  }

  const salvar = async () => {
    if (!original.trim()) {
      setErro('validation.required')
      return
    }
    setSalvando(true)
    try {
      let v: LocalizedText
      if (desatualizado) v = await gerar()
      else
        v = {
          origem,
          textos: { ...textos, [origem]: original.trim() },
          automaticos: automaticos.filter((l) => l !== origem),
        }
      await onSalvar(v)
      onOpenChange(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <FormField
          label={t('traducao.textoOriginal')}
          required
          error={erro}
          counter={{ value: original.length, max: maxLength }}
        >
          {(p) => (
            <Campo
              {...p}
              value={original}
              maxLength={maxLength}
              onChange={(e) => {
                setOriginal(e.target.value)
                setDesatualizado(true)
                setErro(undefined)
                // Texto reescrito: volta a detectar o idioma (pode ter mudado de língua).
                if (!idiomaManual) idiomaTexto.limpar()
              }}
            />
          )}
        </FormField>
        <SeletorIdiomaTexto
          texto={original}
          idioma={origem}
          detectado={idiomaTexto.detectado}
          onChange={(l) => {
            idiomaTexto.definir(l)
            setIdiomaManual(true)
            setDesatualizado(true)
          }}
        />

        <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
          <legend className="px-1 type-label">{t('traducao.traducoes')}</legend>
          {desatualizado && (
            <p className="type-caption text-muted-foreground">{t('traducao.seraoGeradas')}</p>
          )}
          {outros.map((l) => (
            <FormField
              key={l}
              label={t(`languages.${l}`)}
              help={
                !textos[l] ? (
                  t('traducao.semTraducao')
                ) : automaticos.includes(l) ? (
                  <Tag className="mt-0.5">{t('traducao.automaticaTag')}</Tag>
                ) : undefined
              }
              disabled={desatualizado}
            >
              {(p) => (
                <Campo
                  {...p}
                  lang={l}
                  value={desatualizado ? '' : (textos[l] ?? '')}
                  maxLength={maxLength * 3}
                  placeholder={desatualizado ? t('traducao.seraoGeradasCurto') : undefined}
                  onChange={(e) => {
                    setTextos((s) => ({ ...s, [l]: e.target.value }))
                    setAutomaticos((a) => a.filter((x) => x !== l))
                  }}
                />
              )}
            </FormField>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={traduzindo && !salvando}
              disabled={!original.trim() || salvando}
              onClick={() => void gerar()}
            >
              <RefreshCw aria-hidden />
              {t('traducao.traduzirDeNovo')}
            </Button>
          </div>
        </fieldset>
        <p className="sr-only" aria-live="polite">
          {traduzindo ? t('traducao.traduzindo') : ''}
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
          {t('common.cancel')}
        </Button>
        <Button loading={salvando} onClick={() => void salvar()}>
          {salvando && traduzindo ? t('traducao.traduzindo') : t('common.save')}
        </Button>
      </DialogFooter>
    </>
  )
}
