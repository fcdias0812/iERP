import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useRastreadores } from '@/features/cadastros/use-rastreadores'
import type { Viagem } from '@/services/types'
import { SeletorAparelho } from './SeletorAparelho'
import { useAdicionarRastreio } from './use-viagens'

/*
 * "Adicionar rastreador" no card do caminhão (pedido do usuário, 28/10/2026: "ter a opção de
 * adicionar um ou mais rastreadores/rastreios de celular no mesmo caminhão"). Celular: o motorista
 * (ou o ajudante) abre o mesmo link do caminhão; aparelho de GPS: começa a contar na hora.
 */
export function AdicionarRastreador({ v }: { v: Viagem }) {
  const { t } = useTranslation()
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Can permission="ordens.viagens.editar" fallback="disable">
        <Button size="sm" variant="secondary" onClick={() => setAberto(true)}>
          <Plus aria-hidden />
          {t('viagens.rastreios.adicionar')}
        </Button>
      </Can>
      {aberto && <Janela v={v} onFechar={() => setAberto(false)} />}
    </>
  )
}

function Janela({ v, onFechar }: { v: Viagem; onFechar: () => void }) {
  const { t } = useTranslation()
  const adicionar = useAdicionarRastreio()
  const lista = useRastreadores()
  const id = useId()
  const [tipo, setTipo] = useState<'celular' | 'aparelho'>('celular')
  const [aparelho, setAparelho] = useState('')
  const pronto = tipo === 'celular' || Boolean(aparelho)
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('viagens.rastreios.titulo')}</DialogTitle>
          <DialogDescription>
            {t('viagens.rastreios.descricao', { code: v.loteCodigo, n: v.numero })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label id={`${id}-tipo`}>{t('viagens.nova.rastreio')}</Label>
          <RadioGroup
            aria-labelledby={`${id}-tipo`}
            value={tipo}
            onValueChange={(x) => setTipo(x as 'celular' | 'aparelho')}
            className="flex flex-wrap gap-4"
          >
            {(['celular', 'aparelho'] as const).map((r) => (
              <label key={r} className="flex items-center gap-2 type-body">
                <RadioGroupItem value={r} />
                {t(`viagens.nova.rastreios.${r}`)}
              </label>
            ))}
          </RadioGroup>
        </div>
        {tipo === 'celular' ? (
          <Alert tone="info" title={t('viagens.rastreios.celularTitulo')}>
            {t('viagens.rastreios.celularTexto')}
          </Alert>
        ) : (
          <SeletorAparelho
            id={`${id}-aparelho`}
            rastreadores={lista.data}
            valor={aparelho}
            onValor={setAparelho}
            loteCodigo={v.loteCodigo}
          />
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onFechar}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!pronto}
            loading={adicionar.isPending}
            onClick={async () => {
              const ok = await adicionar
                .mutateAsync({
                  viagemId: v.id,
                  rastreadorId: tipo === 'aparelho' ? aparelho : null,
                })
                .catch(() => null)
              if (ok) onFechar()
            }}
          >
            {t('viagens.rastreios.confirmar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
