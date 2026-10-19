import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FotoRecebimento } from '@/services/types'
import type { ValorFotos } from './recebimento-schema'

/*
 * Fotos de um item (lacre, nota fiscal, pallet ou gerais): "Tirar foto" abre a câmera traseira
 * no celular (atributo `capture="environment"`; no computador abre a escolha de arquivo) e
 * "Escolher arquivo" abre a galeria do celular ou as pastas do computador. Mostra as fotos que
 * já existem (com remover) e as novas (prévia local).
 */

const ACEITAS = '.jpg,.jpeg,.png,.webp'
const MAX_BYTES = 25 * 1024 * 1024

export function CampoFotos({
  id,
  rotulo,
  valor,
  onChange,
  urlDe,
  max,
  invalido,
  describedBy,
}: {
  id: string
  /** Nome do item (vai no nome acessível dos botões: "Tirar foto — Lacre 1"). */
  rotulo: string
  valor: ValorFotos
  onChange: (v: ValorFotos) => void
  urlDe: (foto: FotoRecebimento) => string
  max: number
  invalido?: boolean
  describedBy?: string
}) {
  const { t } = useTranslation()
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const total = valor.manter.length + valor.novas.length
  const cheio = total >= max

  // Prévia das fotos novas (o endereço temporário é liberado ao trocar/sair).
  const previas = useMemo(() => valor.novas.map((f) => URL.createObjectURL(f)), [valor.novas])
  useEffect(() => () => previas.forEach((u) => URL.revokeObjectURL(u)), [previas])

  const adicionar = (lista: FileList | null) => {
    const arquivos = [...(lista ?? [])].filter((f) => f.size <= MAX_BYTES)
    if (!arquivos.length) return
    onChange({ ...valor, novas: [...valor.novas, ...arquivos].slice(0, max - valor.manter.length) })
  }

  return (
    <div
      id={id}
      className={cn(
        'flex flex-col gap-2 rounded-md',
        invalido && 'outline-2 outline-offset-2 outline-destructive',
      )}
      aria-describedby={describedBy}
    >
      {total > 0 && (
        <ul
          aria-label={t('recebimento.fotos.lista', { item: rotulo })}
          className="flex flex-wrap gap-2"
        >
          {valor.manter.map((f) => (
            <li key={f.id} className="relative">
              <img src={urlDe(f)} alt={f.nome} className="size-20 rounded-sm border object-cover" />
              <Remover
                nome={f.nome}
                onClick={() =>
                  onChange({ ...valor, manter: valor.manter.filter((x) => x.id !== f.id) })
                }
              />
            </li>
          ))}
          {valor.novas.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative">
              <img
                src={previas[i]}
                alt={f.name}
                className="size-20 rounded-sm border object-cover"
              />
              <Remover
                nome={f.name}
                onClick={() => onChange({ ...valor, novas: valor.novas.filter((_, j) => j !== i) })}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          disabled={cheio}
          onClick={() => camera.current?.click()}
        >
          <Camera aria-hidden />
          {t('recebimento.fotos.tirar')}
          <span className="sr-only"> — {rotulo}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={cheio}
          onClick={() => galeria.current?.click()}
        >
          <ImagePlus aria-hidden />
          {t('recebimento.fotos.escolher')}
          <span className="sr-only"> — {rotulo}</span>
        </Button>
      </div>
      {cheio && (
        <p className="type-caption text-muted-foreground">
          {t('recebimento.fotos.limite', { n: max })}
        </p>
      )}
      {/* Entradas escondidas: os botões acima é que abrem. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-campo-fotos="camera"
        onChange={(e) => {
          adicionar(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={galeria}
        type="file"
        accept={ACEITAS}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-campo-fotos="galeria"
        onChange={(e) => {
          adicionar(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function Remover({ nome, onClick }: { nome: string; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      className="absolute -top-2 -right-2 rounded-full shadow-card"
      aria-label={t('recebimento.fotos.remover', { nome })}
      onClick={onClick}
    >
      <X aria-hidden />
    </Button>
  )
}
