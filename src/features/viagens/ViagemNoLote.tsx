import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Can } from '@/components/layout/Can'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RhfField } from '@/components/ui/form'
import { MaskedInput } from '@/components/ui/masked-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { NENHUM } from '@/features/ordens/agendamento-schema'
import { useOpcoesMotoristas } from '@/features/transportadoras/use-transportadoras'
import { useCan } from '@/hooks/use-can'
import { isValidPlate } from '@/lib/validators/br'
import { z } from '@/lib/zod-i18n'
import type { Viagem } from '@/services/types'
import { porCaminhao } from './agrupar'
import { CardViagem } from './CardViagem'
import { CartaoMapa } from './CartaoMapa'
import { ChatViagemSheet } from './ChatViagemSheet'
import {
  useAdicionarCaminhao,
  useCienteEmergencia,
  useFinalizarViagem,
  useViagens,
} from './use-viagens'

/*
 * As viagens do lote na aba INFORMAÇÕES (pedido do usuário, 20/10/2026): um card por caminhão
 * (22/10/2026: "vários caminhões podem ir fazer essa viagem ao mesmo tempo") — código de chegada,
 * link do motorista, conversa, finalizar — e o mapa com todos. Lote agendado: botão "Adicionar
 * caminhão". Terminada, a viagem sai daqui (o replay fica em Ordens › Viagens).
 * Lê a mesma lista de Viagens (atualiza a cada 5 s).
 */
export function ViagemNoLote({
  ordemId,
  juntados = SEM_JUNTADOS,
  podeAdicionar = false,
}: {
  ordemId: string
  /** Os lotes juntados a este (a mesma coleta): as viagens deles aparecem aqui também. */
  juntados?: string[]
  /** Lote agendado aqui: mostra "Adicionar caminhão". */
  podeAdicionar?: boolean
}) {
  const pode = useCan('ordens.viagens.ver')
  return pode ? (
    <Viagens ordemId={ordemId} juntados={juntados} podeAdicionar={podeAdicionar} />
  ) : null
}

const SEM_JUNTADOS: string[] = []

function Viagens({
  ordemId,
  juntados,
  podeAdicionar,
}: {
  ordemId: string
  juntados: string[]
  podeAdicionar: boolean
}) {
  const { t } = useTranslation()
  const abertas = useViagens('abertas')
  const encerrar = useFinalizarViagem()
  const ciente = useCienteEmergencia()
  const [chat, setChat] = useState<Viagem | null>(null)
  const [finalizar, setFinalizar] = useState<Viagem | null>(null)
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const viagens = (abertas.data?.viagens ?? [])
    .filter((x) => x.ordemId === ordemId || juntados.includes(x.ordemId))
    .sort((a, b) => a.numero - b.numero)
  if (!viagens.length && !podeAdicionar) return null
  const marcada = viagens.find((v) => v.id === escolhida) ?? viagens[0]
  // Um card por caminhão, com os rastreadores dele (28/10/2026).
  const caminhoes = porCaminhao(viagens)
  return (
    <section
      aria-labelledby="lote-info-viagem"
      className="grid grid-cols-1 items-start gap-4 lg:col-span-2 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"
    >
      <h2 id="lote-info-viagem" className="sr-only">
        {t('viagens.doLote.titulo')}
      </h2>
      <div className="flex flex-col gap-3">
        {caminhoes.map(([v, ...outros]) => (
          <CardViagem
            key={v!.id}
            v={v!}
            outros={outros}
            semAbrirLote
            escolhida={caminhoes.length > 1 && [v!, ...outros].some((x) => x.id === marcada?.id)}
            onEscolher={caminhoes.length > 1 ? () => setEscolhida(v!.id) : undefined}
            onChat={setChat}
            onFinalizar={setFinalizar}
            onCiente={(x) => ciente.mutate(x.id)}
          />
        ))}
        {podeAdicionar && (
          <Can permission="ordens.lotes.editar" fallback="disable">
            <Button variant="secondary" className="self-start" onClick={() => setAdicionando(true)}>
              <Plus aria-hidden />
              {t('viagens.caminhao.adicionar')}
            </Button>
          </Can>
        )}
      </div>
      {viagens.length > 0 && (
        <CartaoMapa
          viagens={viagens}
          escolhidaId={marcada?.id ?? null}
          temTransito={abertas.data?.temTransito ?? false}
          titulo={t('viagens.doLote.titulo')}
          rotulo={t('viagens.mapa.daViagem', { code: viagens[0]!.loteCodigo })}
        />
      )}
      <ChatViagemSheet viagem={chat} onFechar={() => setChat(null)} />
      {adicionando && <AdicionarCaminhao ordemId={ordemId} onClose={() => setAdicionando(false)} />}
      <ConfirmDialog
        open={Boolean(finalizar)}
        onOpenChange={(o) => !o && setFinalizar(null)}
        title={finalizar ? t('viagens.finalizar.titulo', { code: finalizar.loteCodigo }) : ''}
        description={
          finalizar?.status === 'em_rota'
            ? t('viagens.finalizar.avisoEmRota')
            : t('viagens.finalizar.texto')
        }
        confirmLabel={t('viagens.finalizar.botao')}
        onConfirm={async () => {
          if (finalizar) await encerrar.mutateAsync(finalizar.id).catch(() => undefined)
          setFinalizar(null)
        }}
      />
    </section>
  )
}

const schema = z
  .object({ motoristaId: z.string(), placa: z.string() })
  .refine((v) => !v.placa || isValidPlate(v.placa), {
    path: ['placa'],
    message: 'validation.plate',
  })
type Form = z.input<typeof schema>

/** Painel "Adicionar caminhão": motorista e placa (o link e o código saem sozinhos). */
function AdicionarCaminhao({ ordemId, onClose }: { ordemId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const adicionar = useAdicionarCaminhao(ordemId)
  const motoristas = useOpcoesMotoristas()
  const ativos = (motoristas.data ?? []).filter((m) => m.status === 'ativo')
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { motoristaId: NENHUM, placa: '' },
  })
  const enviar = form.handleSubmit(async (v) => {
    const ok = await adicionar
      .mutateAsync({
        motoristaId: v.motoristaId === NENHUM ? null : v.motoristaId,
        placa: v.placa ? v.placa.toUpperCase() : null,
      })
      .catch(() => null)
    if (ok) {
      form.reset(v)
      onClose()
    }
  })
  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={t('viagens.caminhao.titulo')}
      descricao={t('viagens.caminhao.descricao')}
      formId="form-caminhao"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao="ordens.lotes.editar"
      dados={
        <form
          id="form-caminhao"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <CadastroSecao titulo={t('viagens.caminhao.titulo')}>
            <RhfField
              control={form.control}
              name="motoristaId"
              label={t('ordens.agendamento.campos.motorista')}
            >
              {({ field, control }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>
                      {t('ordens.agendamento.ajuda.nenhumMotorista')}
                    </SelectItem>
                    {ativos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.transportadoraNome ? `${m.nome} · ${m.transportadoraNome}` : m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </RhfField>
            <RhfField
              control={form.control}
              name="placa"
              label={t('ordens.agendamento.campos.placa')}
            >
              {({ field, control }) => (
                <MaskedInput
                  {...control}
                  kind="plate"
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              )}
            </RhfField>
          </CadastroSecao>
        </form>
      }
    />
  )
}
