import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api-errors'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Viagem } from '@/services/types'
import { useChatViagem, useEnviarChat } from './use-viagens'

/*
 * Conversa com o motorista (o chat do app, pelo rastreador). Atualiza a cada 5 s. O texto vai
 * como foi escrito (é conversa com uma pessoa — não passa pela tradução automática). Só se
 * escreve nas viagens daqui que estão na rua; a de um lote de fora e a terminada, só leitura.
 */

export function ChatViagemSheet({
  viagem,
  onFechar,
}: {
  viagem: Viagem | null
  onFechar: () => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet open={Boolean(viagem)} onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent className="w-full sm:max-w-md">
        {viagem && <Conversa viagem={viagem} />}
        {!viagem && <SheetTitle className="sr-only">{t('viagens.chat.titulo')}</SheetTitle>}
      </SheetContent>
    </Sheet>
  )
}

function Conversa({ viagem }: { viagem: Viagem }) {
  const { t } = useTranslation()
  const chat = useChatViagem(viagem.id)
  const enviar = useEnviarChat(viagem.id)
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  const podeEscrever =
    !viagem.somenteLeitura && (viagem.status === 'em_rota' || viagem.status === 'chegou')
  const total = chat.data?.length ?? 0

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [total])

  const mandar = () => {
    const limpo = texto.trim()
    if (!limpo) return
    enviar.mutate(limpo, { onSuccess: () => setTexto('') })
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t('viagens.chat.titulo')}</SheetTitle>
        <SheetDescription>
          {[viagem.loteCodigo, viagem.motoristaNome, viagem.placa].filter(Boolean).join(' · ')}
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4" aria-live="polite">
        {chat.isPending && <Skeleton className="h-24 w-full" />}
        {chat.isError && (
          <Alert tone="danger" title={t('viagens.chat.erro')}>
            {apiErrorMessage(chat.error)}
          </Alert>
        )}
        {chat.data?.length === 0 && (
          <p className="type-caption text-muted-foreground">{t('viagens.chat.vazio')}</p>
        )}
        <ol className="flex flex-col gap-2">
          {chat.data?.map((m) => (
            <li
              key={m.id}
              className={cn(
                'flex max-w-[85%] flex-col gap-1 rounded-md border p-2',
                m.remetente === 'operador' ? 'self-end bg-info-subtle' : 'self-start bg-card',
              )}
            >
              <span className="type-caption text-muted-foreground">
                {t(`viagens.chat.remetentes.${m.remetente}`)} · {formatDateTime(m.em)}
              </span>
              {m.texto && <span className="type-body whitespace-pre-wrap">{m.texto}</span>}
              {m.midiaUrl && (
                <a
                  href={m.midiaUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="type-caption text-primary underline"
                >
                  {t('viagens.chat.verAnexo')}
                </a>
              )}
            </li>
          ))}
        </ol>
        <div ref={fim} />
      </div>
      {podeEscrever && (
        <Can permission="ordens.viagens.editar">
          <form
            className="flex flex-col gap-2 border-t p-4"
            onSubmit={(e) => {
              e.preventDefault()
              mandar()
            }}
          >
            <label htmlFor="chat-viagem-texto" className="sr-only">
              {t('viagens.chat.mensagem')}
            </label>
            <Textarea
              id="chat-viagem-texto"
              value={texto}
              maxLength={1000}
              rows={3}
              placeholder={t('viagens.chat.placeholder')}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  mandar()
                }
              }}
            />
            <Button type="submit" loading={enviar.isPending} disabled={!texto.trim()}>
              {!enviar.isPending && <Send aria-hidden />}
              {t('viagens.chat.enviar')}
            </Button>
          </form>
        </Can>
      )}
    </>
  )
}
