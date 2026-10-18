import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { useIdiomaTexto } from '@/hooks/use-traducao'
import type { Language } from '@/stores/ui-store'
import { Avatar, AvatarFallback } from './avatar'
import { Button } from './button'
import { SeletorIdiomaTexto } from './localized-text'
import { RelativeTime } from './metadata'
import { Textarea } from './textarea'
import { initials } from '@/stores/session-store'

export interface Comment {
  id: string
  author: string
  at: string
  /** Texto ou conteúdo pronto (ex.: <TextoTraduzido> para comentários traduzidos). */
  body: React.ReactNode
}

interface CommentsProps {
  comments: Comment[]
  /**
   * Envia um comentário novo. Sem esta função, a lista fica só leitura.
   * Com `detectLanguage`, recebe também o idioma em que a pessoa escreveu.
   */
  onSubmit?: (body: string, language?: Language) => void | Promise<void>
  currentUser: string
  maxLength?: number
  /** Mostra "Escrito em: <idioma> (detectado)" — para comentários traduzidos automaticamente. */
  detectLanguage?: boolean
}

/** Lista de comentários + caixa para escrever (Ctrl+Enter envia). */
export function Comments({
  comments,
  onSubmit,
  currentUser,
  maxLength = 1000,
  detectLanguage = false,
}: CommentsProps) {
  const { t } = useTranslation()
  const [body, setBody] = React.useState('')
  const language = useIdiomaTexto(body)
  const [sending, setSending] = React.useState(false)
  const id = React.useId()

  const send = async () => {
    const text = body.trim()
    if (!text || !onSubmit) return
    setSending(true)
    try {
      await onSubmit(text, detectLanguage ? language.idioma : undefined)
      setBody('')
      language.limpar()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="type-body text-muted-foreground">{t('comments.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar size="sm" className="mt-0.5 size-7">
                <AvatarFallback className="text-12">{initials(c.author)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2">
                <p className="flex flex-wrap items-baseline gap-x-2 type-caption">
                  <span className="type-label">{c.author}</span>
                  <RelativeTime value={c.at} className="text-muted-foreground" />
                </p>
                <div className="mt-1 type-body whitespace-pre-line">{c.body}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {onSubmit && (
        <div className="flex gap-3">
          <Avatar size="sm" className="mt-0.5 size-7">
            <AvatarFallback className="text-12">{initials(currentUser)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor={id} className="sr-only">
              {t('comments.label')}
            </label>
            <Textarea
              id={id}
              value={body}
              maxLength={maxLength}
              placeholder={t('comments.placeholder')}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="type-caption text-muted-foreground num">
                  {body.length}/{maxLength}
                </span>
                {detectLanguage && (
                  <SeletorIdiomaTexto
                    texto={body}
                    idioma={language.idioma}
                    detectado={language.detectado}
                    onChange={language.definir}
                  />
                )}
              </span>
              <Button size="sm" onClick={send} loading={sending} disabled={!body.trim()}>
                <Send aria-hidden />
                {t('comments.send')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
