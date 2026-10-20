import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Route as RotaIcone, TrafficCone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import type { StatusViagem, Viagem } from '@/services/types'
import {
  arredondarCaixa,
  gravarCamadas,
  lerCamadas,
  type CaixaMapa,
  type CamadasMapa,
} from './mapa-viagens'
import { PainelViagem } from './PainelViagem'
import { usePoisDaEstrada, useViagem } from './use-viagens'

/*
 * O cartão do MAPA das viagens: as camadas (Trânsito, Postos/balanças, Pontos), os caminhões, o
 * trajeto e as paradas da viagem escolhida e o resumo dela embaixo. O mesmo em Ordens › Viagens
 * (todas as viagens) e na aba Informações do lote (só a viagem dele — pedido do usuário,
 * 20/10/2026).
 */

const MapaViagem = lazy(() => import('./MapaViagem'))

export function CartaoMapa({
  viagens,
  escolhidaId,
  onEscolher,
  temTransito,
  titulo,
  rotulo,
  id,
  className,
  alto = false,
}: {
  viagens: Viagem[]
  escolhidaId: string | null
  /** Sem ela, a viagem escolhida é fixa (o lote): sem "Ver todas" e sem trocar pelo mapa. */
  onEscolher?: (id: string | undefined) => void
  temTransito: boolean
  titulo: string
  /** Nome acessível do mapa. */
  rotulo: string
  id?: string
  className?: string
  alto?: boolean
}) {
  const { t } = useTranslation()
  const [camadas, setCamadas] = useState<CamadasMapa>(lerCamadas)
  const [caixa, setCaixa] = useState<CaixaMapa | null>(null)
  const escolhida = viagens.find((v) => v.id === escolhidaId) ?? null
  const naRua = escolhida?.status === 'em_rota' || escolhida?.status === 'chegou'
  const detalhe = useViagem(escolhida?.id, naRua)
  const d = detalhe.data?.id === escolhida?.id ? detalhe.data : undefined
  const pois = usePoisDaEstrada(camadas.pois ? caixa : null)

  const trocarCamada = (k: keyof CamadasMapa) => {
    const nova = { ...camadas, [k]: !camadas[k] }
    setCamadas(nova)
    gravarCamadas(nova)
  }

  return (
    <Card id={id} className={className}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{titulo}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonGroup aria-label={t('viagens.mapa.camadas')}>
            {temTransito && (
              <Button
                size="sm"
                variant={camadas.transito ? 'default' : 'secondary'}
                aria-pressed={camadas.transito}
                onClick={() => trocarCamada('transito')}
              >
                <TrafficCone aria-hidden />
                {t('viagens.mapa.transito')}
              </Button>
            )}
            <Button
              size="sm"
              variant={camadas.pois ? 'default' : 'secondary'}
              aria-pressed={camadas.pois}
              onClick={() => trocarCamada('pois')}
            >
              <RotaIcone aria-hidden />
              {t('viagens.mapa.pois')}
            </Button>
            <Button
              size="sm"
              variant={camadas.pontos ? 'default' : 'secondary'}
              aria-pressed={camadas.pontos}
              onClick={() => trocarCamada('pontos')}
            >
              <MapPin aria-hidden />
              {t('viagens.mapa.pontos')}
            </Button>
          </ButtonGroup>
          {escolhida && onEscolher && (
            <Button size="sm" variant="ghost" onClick={() => onEscolher(undefined)}>
              <X aria-hidden />
              {t('viagens.mapa.verTodas')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <MapaViagem
            viagens={viagens}
            selecionada={d ?? null}
            selecionadaId={escolhidaId}
            onSelecionar={onEscolher}
            camadas={camadas}
            pois={camadas.pois ? (pois.data ?? []) : []}
            onCaixa={(c) => setCaixa(arredondarCaixa(c))}
            rotulo={rotulo}
            alto={alto}
          />
        </Suspense>
        {camadas.pois && !caixa && (
          <p className="type-caption text-muted-foreground">{t('viagens.mapa.poisZoom')}</p>
        )}
        {camadas.pois && caixa && pois.isError && (
          <p className="type-caption text-muted-foreground">{t('viagens.mapa.poisIndisponivel')}</p>
        )}
        <Legenda />
        {d && <PainelViagem d={d} />}
      </CardContent>
    </Card>
  )
}

function Legenda() {
  const { t } = useTranslation()
  const itens: StatusViagem[] = ['em_rota', 'chegou', 'aguardando_motorista']
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label={t('viagens.mapa.legenda')}>
      {itens.map((s) => (
        <li key={s}>
          <StatusBadge status={`viagem_${s}`} size="sm" />
        </li>
      ))}
      <li>
        <StatusBadge status="viagem_emergencia" size="sm" />
      </li>
    </ul>
  )
}
