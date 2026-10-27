import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Satellite } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRastreadores, useUsarRastreador } from '@/features/cadastros/use-rastreadores'
import type { Viagem } from '@/services/types'

/*
 * "Usar rastreador" (como no 1.0): o caminhão que ainda espera o motorista vai pelo APARELHO de
 * GPS. Só aparelhos ativos; o que está noutra viagem aparece desabilitado ("ocupado com LOT…").
 * Se só um estiver livre, ele já vem escolhido.
 */
export function UsarRastreador({ v }: { v: Viagem }) {
  const { t } = useTranslation()
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Can permission="ordens.viagens.editar" fallback="disable">
        <Button size="sm" variant="secondary" onClick={() => setAberto(true)}>
          <Satellite aria-hidden />
          {t('viagens.rastreador.usar')}
        </Button>
      </Can>
      {aberto && <Janela v={v} onFechar={() => setAberto(false)} />}
    </>
  )
}

function Janela({ v, onFechar }: { v: Viagem; onFechar: () => void }) {
  const { t } = useTranslation()
  const lista = useRastreadores()
  const usar = useUsarRastreador()
  const ativos = (lista.data ?? []).filter((r) => r.status === 'ativo')
  const livres = ativos.filter((r) => !r.viagem)
  const [escolhido, setEscolhido] = useState<string>(() =>
    livres.length === 1 ? livres[0]!.id : '',
  )
  const atual = ativos.find((r) => r.id === escolhido)
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('viagens.rastreador.titulo')}</DialogTitle>
          <DialogDescription>
            {t('viagens.rastreador.descricao', { code: v.loteCodigo, n: v.numero })}
          </DialogDescription>
        </DialogHeader>
        {ativos.length ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usar-rastreador">{t('viagens.rastreador.campo')}</Label>
            <Select value={escolhido} onValueChange={setEscolhido}>
              <SelectTrigger id="usar-rastreador">
                <SelectValue placeholder={t('field.selectOne')} />
              </SelectTrigger>
              <SelectContent>
                {ativos.map((r) => (
                  <SelectItem key={r.id} value={r.id} disabled={Boolean(r.viagem)}>
                    {[
                      r.deviceId,
                      r.placa,
                      r.viagem
                        ? t('viagens.rastreador.ocupado', { code: r.viagem.loteCodigo })
                        : t(`status.rastreador_${r.estado}`),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {atual && atual.estado !== 'online' && (
              <Alert tone="warning" title={t('viagens.rastreador.avisoEstado')}>
                {t(`status.rastreador_${atual.estado}`)}
              </Alert>
            )}
          </div>
        ) : (
          <Alert tone="info" title={t('viagens.rastreador.nenhum')}>
            {t('viagens.rastreador.nenhumTexto')}
          </Alert>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onFechar}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!escolhido}
            loading={usar.isPending}
            onClick={async () => {
              const ok = await usar
                .mutateAsync({ viagemId: v.id, rastreadorId: escolhido })
                .catch(() => null)
              if (ok) onFechar()
            }}
          >
            {t('viagens.rastreador.confirmar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
