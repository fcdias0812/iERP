import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Can } from '@/components/layout/Can'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useCan } from '@/hooks/use-can'
import { formatTime } from '@/lib/format'
import type { Viagem } from '@/services/types'
import { useCienteEmergencia, useViagens } from './use-viagens'

/*
 * EMERGÊNCIA de motorista (assalto, acidente, problema mecânico, emergência médica — o botão de
 * pânico do app): aparece no topo de QUALQUER tela para quem vê Ordens › Viagens, com um aviso
 * sonoro, até alguém dar ciência (a ciência também cala o alarme no rastreador e no iERP antigo).
 */

export function AlertaEmergencias() {
  const pode = useCan('ordens.viagens.ver')
  return pode ? <Alertas /> : null
}

function Alertas() {
  const { t } = useTranslation()
  const abertas = useViagens('abertas')
  const ciente = useCienteEmergencia()
  const pendentes = (abertas.data?.viagens ?? []).filter(
    (v) => v.emergencia && !v.emergencia.cienteEm,
  )
  useAvisoSonoro(pendentes)
  if (!pendentes.length) return null
  return (
    <div className="flex flex-col gap-2">
      {pendentes.map((v) => (
        <Alert
          key={v.id}
          tone="danger"
          variant="banner"
          title={t('viagens.alerta.titulo', {
            tipo: t(`viagens.emergencias.${v.emergencia!.tipo ?? 'outra'}`, {
              defaultValue: v.emergencia!.tipo ?? '',
            }),
            code: v.loteCodigo,
          })}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" asChild>
                <Link to="/ordens/viagens" search={{ viagem: v.id }}>
                  {t('viagens.alerta.ver')}
                </Link>
              </Button>
              {!v.somenteLeitura && (
                <Can permission="ordens.viagens.editar">
                  <Button
                    size="sm"
                    variant="destructive"
                    loading={ciente.isPending && ciente.variables === v.id}
                    onClick={() => ciente.mutate(v.id)}
                  >
                    {t('viagens.emergencia.ciente')}
                  </Button>
                </Can>
              )}
            </div>
          }
        >
          {t('viagens.alerta.texto', {
            motorista: v.motoristaNome ?? t('viagens.card.motoristaADefinir'),
            placa: v.placa ?? '—',
            hora: formatTime(v.emergencia!.em),
          })}
        </Alert>
      ))}
    </div>
  )
}

/** Um bipe curto (Web Audio) para cada emergência nova. O navegador pode bloquear sem clique. */
function useAvisoSonoro(pendentes: Viagem[]) {
  const ouvidas = useRef(new Set<string>())
  const chave = pendentes.map((v) => `${v.id}|${v.emergencia?.em}`).join(',')
  useEffect(() => {
    const novas = chave.split(',').filter((k) => k && !ouvidas.current.has(k))
    if (!novas.length) return
    for (const k of novas) ouvidas.current.add(k)
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const ganho = ctx.createGain()
        osc.type = 'square'
        osc.frequency.value = i % 2 ? 660 : 880
        ganho.gain.value = 0.06
        osc.connect(ganho).connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.35)
        osc.stop(ctx.currentTime + i * 0.35 + 0.25)
      }
      setTimeout(() => void ctx.close(), 1500)
    } catch {
      // Sem áudio: o aviso na tela continua.
    }
  }, [chave])
}
