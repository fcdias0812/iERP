import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { Button } from './button'
import { Progress } from './progress'
import { RelativeTime } from './metadata'

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
  /** Tipos aceitos (atributo `accept`), ex.: ".pdf,image/*". */
  accept?: string
  multiple?: boolean
  /** Tamanho máximo por arquivo, em bytes (arquivos maiores são rejeitados com aviso). */
  maxSize?: number
  disabled?: boolean
  invalid?: boolean
  id?: string
  'aria-describedby'?: string
}

/**
 * Área de upload: arrastar e soltar OU clicar/Enter para escolher.
 * O botão real é um <input type="file"> acessível pelo teclado.
 */
export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  maxSize,
  disabled,
  invalid,
  id,
  'aria-describedby': describedBy,
}: FileDropzoneProps) {
  const { t } = useTranslation()
  const [dragging, setDragging] = React.useState(false)
  const [rejected, setRejected] = React.useState<string[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handle = (list: FileList | null) => {
    if (!list) return
    const files = Array.from(list)
    const tooBig = maxSize ? files.filter((f) => f.size > maxSize) : []
    setRejected(tooBig.map((f) => f.name))
    const ok = files.filter((f) => !tooBig.includes(f))
    if (ok.length) onFiles(ok)
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) handle(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-input bg-card px-6 py-8 text-center transition-colors duration-150 hover:border-border-strong hover:bg-accent has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
          dragging && 'border-primary bg-selected',
          invalid && 'border-danger-border',
          disabled && 'cursor-not-allowed bg-muted text-disabled-foreground hover:bg-muted',
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-info-subtle text-info-subtle-foreground">
          <Upload className="size-5" aria-hidden />
        </span>
        <span className="type-body">
          <span className="font-medium text-link">{t('upload.choose')}</span> {t('upload.orDrag')}
        </span>
        {(accept || maxSize) && (
          <span className="type-caption text-muted-foreground">
            {[accept, maxSize ? t('upload.maxSize', { size: formatBytes(maxSize) }) : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            handle(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      {rejected.length > 0 && (
        <p role="alert" className="type-caption text-danger-subtle-foreground">
          {t('upload.tooBig', { files: rejected.join(', ') })}
        </p>
      )}
    </div>
  )
}

export interface Attachment {
  id: string
  name: string
  size: number
  uploadedBy?: string
  uploadedAt?: string
  /** 0–100 enquanto envia. */
  progress?: number
}

/** Lista de anexos com baixar/remover e progresso de envio. */
export function AttachmentList({
  items,
  onRemove,
  onDownload,
}: {
  items: Attachment[]
  onRemove?: (id: string) => void
  onDownload?: (id: string) => void
}) {
  const { t } = useTranslation()
  if (!items.length) return <p className="type-body text-muted-foreground">{t('upload.none')}</p>
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((a) => {
        const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(a.name)
        const Icon = isImage ? ImageIcon : FileText
        const uploading = a.progress !== undefined && a.progress < 100
        return (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate type-body font-medium">{a.name}</p>
              {uploading ? (
                <div className="mt-1 flex items-center gap-2">
                  <Progress
                    value={a.progress}
                    className="h-1.5"
                    aria-label={t('upload.uploading', { name: a.name })}
                  />
                  <span className="type-caption text-muted-foreground num">{a.progress}%</span>
                </div>
              ) : (
                <p className="type-caption text-muted-foreground">
                  {formatBytes(a.size)}
                  {a.uploadedBy && ` · ${a.uploadedBy}`}
                  {a.uploadedAt && (
                    <>
                      {' · '}
                      <RelativeTime value={a.uploadedAt} />
                    </>
                  )}
                </p>
              )}
            </div>
            {!uploading && onDownload && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('upload.download', { name: a.name })}
                onClick={() => onDownload(a.id)}
              >
                <Download aria-hidden />
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('upload.remove', { name: a.name })}
                onClick={() => onRemove(a.id)}
              >
                <Trash2 aria-hidden />
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
