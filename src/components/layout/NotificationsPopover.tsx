import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateTime, formatRelative } from '@/lib/format'
import { toneStyles } from '@/lib/status/tones'
import { listarNotificacoes, marcarNotificacoesLidas, sistemaKeys } from '@/services/sistema'
import type { Notificacao } from '@/services/types'

/** Tipo de notificação da API → texto (chave i18n). */
const TEXTOS = {
  usuario_criado: 'notifications.items.userCreated',
  usuario_bloqueado: 'notifications.items.userBlocked',
} as const

/** Notificações da API (atualiza a cada minuto) e marcação de lidas com atualização otimista. */
function useNotificacoes() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: sistemaKeys.notificacoes,
    queryFn: listarNotificacoes,
    refetchInterval: 60_000,
  })
  const marcar = useMutation({
    mutationFn: (ids?: string[]) => marcarNotificacoesLidas(ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: sistemaKeys.notificacoes })
      const antes = qc.getQueryData<Notificacao[]>(sistemaKeys.notificacoes)
      qc.setQueryData<Notificacao[]>(sistemaKeys.notificacoes, (l) =>
        l?.map((n) => (!ids || ids.includes(n.id) ? { ...n, lida: true } : n)),
      )
      return { antes }
    },
    onError: (_e, _ids, ctx) => qc.setQueryData(sistemaKeys.notificacoes, ctx?.antes),
    onSettled: () => void qc.invalidateQueries({ queryKey: sistemaKeys.notificacoes }),
  })
  return {
    items: query.data ?? [],
    markRead: (id: string) => marcar.mutate([id]),
    markAllRead: () => marcar.mutate(undefined),
  }
}

/** Sino da navbar: contador de não lidas + painel com a lista. */
export function NotificationsPopover() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { items, markRead, markAllRead } = useNotificacoes()
  const navigate = useNavigate()
  const unread = items.filter((n) => !n.lida).length

  const openItem = (id: string, to?: string) => {
    if (!items.find((n) => n.id === id)?.lida) markRead(id)
    setOpen(false)
    if (to) void navigate({ to: '/$', params: { _splat: to.replace(/^\//, '') } })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={t('notifications.trigger', { count: unread })}
            >
              <Bell aria-hidden />
              {unread > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-12 leading-none font-semibold text-primary-foreground num"
                  aria-hidden
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('notifications.title')}</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="type-card-title">{t('notifications.title')}</h2>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => markAllRead()}
            disabled={!unread}
          >
            {t('notifications.markAllRead')}
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
            <BellOff className="size-6" aria-hidden />
            <p className="type-body">{t('notifications.empty')}</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <ul className="divide-y">
              {items.map((n) => {
                const tone = toneStyles[n.tom]
                const Icon = tone.icon
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n.id, n.rota)}
                      className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-accent"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border',
                          tone.subtle,
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block type-body',
                            n.lida ? 'text-muted-foreground' : 'font-medium text-foreground',
                          )}
                        >
                          {t(TEXTOS[n.tipo], n.parametros)}
                        </span>
                        <time
                          dateTime={n.em}
                          title={formatDateTime(n.em)}
                          className="block type-caption text-muted-foreground"
                        >
                          {formatRelative(n.em)}
                        </time>
                      </span>
                      {!n.lida && (
                        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary">
                          <span className="sr-only">{t('notifications.unread')}</span>
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
