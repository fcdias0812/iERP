import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Rastreador } from '@/services/types'

/*
 * Escolher o APARELHO de GPS (Nova viagem e Adicionar rastreador — 28/10/2026). Só os ativos. O que
 * está noutra viagem aparece com o lote dela e pode ser escolhido: o mesmo aparelho vale em dois
 * lotes do mesmo cliente no mesmo dia (o servidor recusa os outros casos).
 */
export function SeletorAparelho({
  id,
  rastreadores,
  valor,
  onValor,
  loteCodigo,
}: {
  id: string
  rastreadores: Rastreador[] | undefined
  valor: string
  onValor: (id: string) => void
  /** Lote do caminhão (o aviso de "em uso" ignora o próprio). */
  loteCodigo?: string
}) {
  const { t } = useTranslation()
  const ativos = (rastreadores ?? []).filter((r) => r.status === 'ativo')
  const escolhido = ativos.find((r) => r.id === valor)
  if (!ativos.length)
    return (
      <Alert tone="info" title={t('viagens.rastreador.nenhum')}>
        {t('viagens.rastreador.nenhumTexto')}
      </Alert>
    )
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t('viagens.rastreador.campo')}</Label>
      <Select value={valor} onValueChange={onValor}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={t('field.selectOne')} />
        </SelectTrigger>
        <SelectContent>
          {ativos.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {[
                r.deviceId,
                r.placa,
                r.viagem && r.viagem.loteCodigo !== loteCodigo
                  ? t('viagens.rastreador.ocupado', { code: r.viagem.loteCodigo })
                  : t(`status.rastreador_${r.estado}`),
              ]
                .filter(Boolean)
                .join(' · ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {escolhido?.viagem && escolhido.viagem.loteCodigo !== loteCodigo && (
        <p className="type-caption text-muted-foreground">
          {t('viagens.rastreios.aparelhoEmUso', { code: escolhido.viagem.loteCodigo })}
        </p>
      )}
      {escolhido && escolhido.estado !== 'online' && (
        <Alert tone="warning" title={t('viagens.rastreador.avisoEstado')}>
          {t(`status.rastreador_${escolhido.estado}`)}
        </Alert>
      )}
    </div>
  )
}
