import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCan } from '@/hooks/use-can'
import { CardViagem } from './CardViagem'
import { CartaoMapa } from './CartaoMapa'
import { ChatViagemSheet } from './ChatViagemSheet'
import { useCienteEmergencia, useFinalizarViagem, useViagens } from './use-viagens'

/*
 * A viagem do lote na aba INFORMAÇÕES (pedido do usuário, 20/10/2026): com rastreio que ainda
 * não começou ou que está na rua, aparece o card da viagem (código de chegada, link do motorista,
 * conversa, finalizar) e o mapa com as camadas, a rota e as paradas — o mesmo de Ordens ›
 * Viagens, só com esta viagem. Terminada, sai daqui (o replay fica em Ordens › Viagens).
 * Lê a mesma lista de Viagens (atualiza a cada 5 s).
 */
export function ViagemNoLote({ ordemId }: { ordemId: string }) {
  const pode = useCan('ordens.viagens.ver')
  return pode ? <Viagem ordemId={ordemId} /> : null
}

function Viagem({ ordemId }: { ordemId: string }) {
  const { t } = useTranslation()
  const abertas = useViagens('abertas')
  const encerrar = useFinalizarViagem()
  const ciente = useCienteEmergencia()
  const [chat, setChat] = useState(false)
  const [finalizar, setFinalizar] = useState(false)
  const v = abertas.data?.viagens.find((x) => x.ordemId === ordemId)
  if (!v) return null
  return (
    <section
      aria-labelledby="lote-info-viagem"
      className="grid grid-cols-1 items-start gap-4 lg:col-span-2 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"
    >
      <h2 id="lote-info-viagem" className="sr-only">
        {t('viagens.doLote.titulo')}
      </h2>
      <CardViagem
        v={v}
        semAbrirLote
        onChat={() => setChat(true)}
        onFinalizar={() => setFinalizar(true)}
        onCiente={() => ciente.mutate(v.id)}
      />
      <CartaoMapa
        viagens={[v]}
        escolhidaId={v.id}
        temTransito={abertas.data?.temTransito ?? false}
        titulo={t('viagens.doLote.titulo')}
        rotulo={t('viagens.mapa.daViagem', { code: v.loteCodigo })}
      />
      <ChatViagemSheet viagem={chat ? v : null} onFechar={() => setChat(false)} />
      <ConfirmDialog
        open={finalizar}
        onOpenChange={setFinalizar}
        title={t('viagens.finalizar.titulo', { code: v.loteCodigo })}
        description={
          v.status === 'em_rota' ? t('viagens.finalizar.avisoEmRota') : t('viagens.finalizar.texto')
        }
        confirmLabel={t('viagens.finalizar.botao')}
        onConfirm={async () => {
          await encerrar.mutateAsync(v.id).catch(() => undefined)
          setFinalizar(false)
        }}
      />
    </section>
  )
}
