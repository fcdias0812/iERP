import FullCalendar from '@fullcalendar/react'
import classicTheme from '@fullcalendar/react/themes/classic'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import ptBrLocale from '@fullcalendar/react/locales/pt-br'
import zhTwLocale from '@fullcalendar/react/locales/zh-tw'
import type { EventDropInfo, EventInput } from '@fullcalendar/react'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@/styles/fullcalendar.css'
import { useTranslation } from 'react-i18next'
import { TIME_ZONE } from '@/lib/format'
import type { StatusTone } from '@/lib/status/tones'

/*
 * Calendário mês/semana/dia (FullCalendar 7, plugins MIT).
 * Pesado: carregue com React.lazy. Cores pelos tokens
 * (src/styles/fullcalendar.css); evento com `tone` usa a cor do significado.
 */

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  allDay?: boolean
  /** Tom pelo significado (padrão: info). */
  tone?: StatusTone
}

const TONE_BG: Record<StatusTone, [string, string]> = {
  info: ['var(--info)', 'var(--info-foreground)'],
  success: ['var(--success)', 'var(--success-foreground)'],
  warning: ['var(--warning)', 'var(--warning-foreground)'],
  alert: ['var(--alert)', 'var(--alert-foreground)'],
  danger: ['var(--danger)', 'var(--danger-foreground)'],
  inactive: ['var(--inactive)', 'var(--inactive-foreground)'],
}

const LOCALES = { 'pt-BR': ptBrLocale, 'zh-TW': zhTwLocale } as const

interface EventCalendarProps {
  events: CalendarEvent[]
  onEventMove?: (id: string, start: string, end?: string) => void
  onEventClick?: (id: string) => void
  initialView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
  height?: number | 'auto'
}

export default function EventCalendar({
  events,
  onEventMove,
  onEventClick,
  initialView = 'dayGridMonth',
  height = 'auto',
}: EventCalendarProps) {
  const { t, i18n } = useTranslation()
  const locale = LOCALES[i18n.language as keyof typeof LOCALES]

  const input: EventInput[] = events.map((e) => {
    const [bg, fg] = TONE_BG[e.tone ?? 'info']
    return {
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      backgroundColor: bg,
      borderColor: bg,
      textColor: fg,
    }
  })

  return (
    <div className="fc-reteck">
      <FullCalendar
        plugins={[classicTheme, dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={initialView}
        locale={locale}
        // A dica (aria-label) contém o texto visível do botão — rótulo no nome (WCAG 2.5.3).
        todayText={t('calendar.today')}
        todayHint={(unidade: string) => t('calendar.todayHint', { unit: unidade })}
        timeZone={TIME_ZONE}
        height={height}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={input}
        editable={Boolean(onEventMove)}
        eventDrop={(info: EventDropInfo) =>
          onEventMove?.(info.event.id, info.event.startStr, info.event.endStr || undefined)
        }
        eventClick={(info) => onEventClick?.(info.event.id)}
        nowIndicator
        dayMaxEvents
      />
    </div>
  )
}
