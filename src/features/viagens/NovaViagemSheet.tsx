import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { EMPTY_QUERY } from '@/components/data-table/types'
import { AsyncCombobox } from '@/components/ui/async-combobox'
import { RhfField } from '@/components/ui/form'
import { MaskedInput } from '@/components/ui/masked-input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRastreadores } from '@/features/cadastros/use-rastreadores'
import { CadastroSecao, CadastroSheet } from '@/features/comum/CadastroSheet'
import { useOpcoesMotoristas } from '@/features/transportadoras/use-transportadoras'
import { formatDate } from '@/lib/format'
import { isValidPlate } from '@/lib/validators/br'
import { z } from '@/lib/zod-i18n'
import { listarOrdens } from '@/services/ordens'
import type { ViagemDetalhe } from '@/services/types'
import { SeletorAparelho } from './SeletorAparelho'
import { useNovaViagem } from './use-viagens'

/*
 * "Nova viagem" em Ordens › Viagens (pedido do usuário, 28/10/2026: "create a trip from an order"
 * — no modo simples): escolhe a ordem AGENDADA daqui, o caminhão (motorista e placa) e o rastreador
 * (celular do motorista ou aparelho de GPS). Vira mais um card de caminhão — o mesmo "Adicionar
 * caminhão" do lote, só que por aqui. Mais rastreadores no mesmo caminhão: "Adicionar rastreador"
 * no card.
 */

const NENHUM = '__nenhum'

const schema = z
  .object({
    ordemId: z.string().min(1, 'validation.required'),
    motoristaId: z.string(),
    placa: z.string(),
    rastreio: z.enum(['celular', 'aparelho']),
    rastreadorId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.placa && !isValidPlate(v.placa))
      ctx.addIssue({ code: 'custom', path: ['placa'], message: 'validation.plate' })
    if (v.rastreio === 'aparelho' && !v.rastreadorId)
      ctx.addIssue({ code: 'custom', path: ['rastreadorId'], message: 'validation.required' })
  })
type Form = z.input<typeof schema>

/** Ordens agendadas daqui (as de outro sistema são rastreadas por lá). */
async function agendadas(busca: string) {
  const page = await listarOrdens({
    ...EMPTY_QUERY,
    search: busca,
    filters: [{ id: 'status', kind: 'in', values: ['agendado'] }],
    sort: [{ id: 'coletaPrevista', desc: false }],
    pageSize: 20,
  })
  return page.rows
    .filter((o) => !o.externo)
    .map((o) => ({
      value: o.id,
      label: `${o.codigo} · ${o.clienteNome} · ${o.siteCodigo} · ${formatDate(o.dataColeta ?? o.coletaPrevista)}`,
    }))
}

export function NovaViagemSheet({
  onClose,
  onCriada,
}: {
  onClose: () => void
  onCriada: (v: ViagemDetalhe) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const nova = useNovaViagem()
  const motoristas = useOpcoesMotoristas()
  const ativos = (motoristas.data ?? []).filter((m) => m.status === 'ativo')
  const rastreadores = useRastreadores()
  const [rotulo, setRotulo] = useState('')
  // Lista de ordens nova a cada abertura do painel.
  const [chave] = useState(() => `nova-viagem-${Date.now()}`)

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      ordemId: '',
      motoristaId: NENHUM,
      placa: '',
      rastreio: 'celular',
      rastreadorId: '',
    },
  })
  const [rastreio, rastreadorId] = useWatch({
    control: form.control,
    name: ['rastreio', 'rastreadorId'],
  })

  const enviar = form.handleSubmit(async (v) => {
    const criada = await nova
      .mutateAsync({
        ordemId: v.ordemId,
        motoristaId: v.motoristaId === NENHUM ? null : v.motoristaId,
        placa: v.placa || null,
        rastreadorId: v.rastreio === 'aparelho' ? v.rastreadorId : null,
      })
      .catch(() => null)
    if (criada) {
      form.reset(v)
      onCriada(criada)
    }
  })

  return (
    <CadastroSheet
      open
      onClose={onClose}
      titulo={t('viagens.nova.titulo')}
      descricao={t('viagens.nova.descricao')}
      formId="form-nova-viagem"
      salvando={form.formState.isSubmitting}
      sujo={form.formState.isDirty}
      permissao="ordens.viagens.editar"
      dados={
        <form
          id="form-nova-viagem"
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <CadastroSecao titulo={t('viagens.nova.secoes.ordem')}>
            <RhfField
              control={form.control}
              name="ordemId"
              label={t('viagens.nova.ordem')}
              help={t('viagens.nova.ordemAjuda')}
              required
              className="sm:col-span-2"
            >
              {({ field, control }) => (
                <AsyncCombobox
                  {...control}
                  queryKey={chave}
                  loadOptions={agendadas}
                  placeholder={t('viagens.nova.escolhaOrdem')}
                  value={field.value ? { value: field.value, label: rotulo } : null}
                  onValueChange={(o) => {
                    field.onChange(o?.value ?? '')
                    setRotulo(o?.label ?? '')
                    field.onBlur()
                  }}
                />
              )}
            </RhfField>
          </CadastroSecao>

          <CadastroSecao titulo={t('viagens.nova.secoes.caminhao')}>
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

          <CadastroSecao titulo={t('viagens.nova.secoes.rastreador')}>
            <RhfField
              control={form.control}
              name="rastreio"
              label={t('viagens.nova.rastreio')}
              className="sm:col-span-2"
            >
              {({ field, control }) => (
                <RadioGroup
                  {...control}
                  value={field.value}
                  onValueChange={(x) => field.onChange(x)}
                  className="flex flex-wrap gap-4"
                >
                  {(['celular', 'aparelho'] as const).map((r) => (
                    <label key={r} className="flex items-center gap-2 type-body">
                      <RadioGroupItem value={r} />
                      {t(`viagens.nova.rastreios.${r}`)}
                    </label>
                  ))}
                </RadioGroup>
              )}
            </RhfField>
            {rastreio === 'celular' ? (
              <p className="type-caption text-muted-foreground sm:col-span-2">
                {t('viagens.nova.celularAjuda')}
              </p>
            ) : (
              <div className="sm:col-span-2">
                <SeletorAparelho
                  id={`${id}-aparelho`}
                  rastreadores={rastreadores.data}
                  valor={rastreadorId}
                  onValor={(x) =>
                    form.setValue('rastreadorId', x, { shouldDirty: true, shouldValidate: true })
                  }
                />
                {form.formState.errors.rastreadorId && (
                  <p className="mt-1 type-caption text-danger-subtle-foreground">
                    {t('validation.required')}
                  </p>
                )}
              </div>
            )}
          </CadastroSecao>
        </form>
      }
    />
  )
}
